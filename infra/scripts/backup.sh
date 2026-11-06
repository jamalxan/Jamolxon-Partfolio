#!/usr/bin/env bash
# PostgreSQL backup (TZ 11): pg_dump -Fc, encrypted with age, kept locally with 7 daily / 4 weekly / 6 monthly
# rotation and uploaded to Cloudflare R2 when BACKUP_S3_* is set. Records a heartbeat (dashboard + optional ping URL).
# Daily via systemd timer jamolxon-backup@production.timer at 03:00 Asia/Tashkent; also run before every deploy.
set -euo pipefail

ENV_NAME="${1:-production}"
case "$ENV_NAME" in production) PROJECT=jamolxon ;; staging) PROJECT=jamolxon-staging ;; *) exit 64 ;; esac
BASE=/opt/jamolxon
set -a; . "$BASE/$ENV_NAME/.env"; set +a
DEST="/var/backups/jamolxon/$ENV_NAME"
mkdir -p "$DEST"/{daily,weekly,monthly}
chmod 700 /var/backups/jamolxon "$DEST"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REASON="${BACKUP_REASON:-daily}"
PG="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=postgres")"
[ -n "$PG" ] || { echo "postgres container not running" >&2; exit 1; }

if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "BACKUP_AGE_RECIPIENT is not set: refusing to write an unencrypted backup" >&2
  exit 1
fi
FILE="$DEST/daily/jamolxon-$ENV_NAME-$STAMP-$REASON.dump.age"
docker exec "$PG" pg_dump -U jamolxon -d jamolxon -Fc --no-owner | age -r "$BACKUP_AGE_RECIPIENT" > "$FILE.part"
mv "$FILE.part" "$FILE"
chmod 600 "$FILE"
SIZE="$(stat -c %s "$FILE")"
[ "$SIZE" -gt 1024 ] || { echo "backup suspiciously small ($SIZE bytes)" >&2; exit 1; }

# weekly (Monday) and monthly (1st) copies — hard links, no extra space
[ "$(date -u +%u)" = 1 ] && [ "$REASON" = daily ] && ln -f "$FILE" "$DEST/weekly/" || true
[ "$(date -u +%d)" = 01 ] && [ "$REASON" = daily ] && ln -f "$FILE" "$DEST/monthly/" || true
prune() { { ls -1t "$1"/*.age 2>/dev/null || true; } | tail -n +"$(( $2 + 1 ))" | xargs -r rm -f; }
prune "$DEST/daily" 7; prune "$DEST/weekly" 4; prune "$DEST/monthly" 6

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  docker run --rm -v "$DEST:/backup:ro" \
    -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
    -e AWS_DEFAULT_REGION=auto amazon/aws-cli:2.22.0 \
    s3 sync /backup "s3://$BACKUP_S3_BUCKET/$ENV_NAME/" --endpoint-url "$BACKUP_S3_ENDPOINT" --delete --only-show-errors
fi

docker exec "$PG" psql -U jamolxon -d jamolxon -qc \
  "INSERT INTO heartbeats(name, at, info) VALUES ('backup', now(), '$REASON $SIZE') ON CONFLICT (name) DO UPDATE SET at = now(), info = EXCLUDED.info" || true
[ -n "${BACKUP_HEARTBEAT_URL:-}" ] && curl -fsS -m 10 -o /dev/null "$BACKUP_HEARTBEAT_URL" || true
echo "backup ok: $FILE ($SIZE bytes)"
