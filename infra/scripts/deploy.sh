#!/usr/bin/env bash
# jamolxon deploy (TZ 10): backup -> build -> migrate -> start new containers -> health -> smoke -> rollback on failure.
# Installed as /usr/local/bin/jamolxon-deploy (root:root 0755). CI reaches it only through a forced-command SSH key:
#   command="sudo /usr/local/bin/jamolxon-deploy",restrict ssh-ed25519 ... jamolxon-ci
# CI sends "<env> <git-sha>" as the SSH command; it cannot run anything else.
# Only touches compose projects jamolxon / jamolxon-staging and /opt/jamolxon/* — never other projects.
set -euo pipefail

REPO_URL="https://github.com/jamalxan/Jamolxon-Partfolio.git"
BASE=/opt/jamolxon
SRC="$BASE/src"
LOG_DIR=/var/log/jamolxon
mkdir -p "$LOG_DIR"

read -r ENV_NAME REF _ <<<"${SSH_ORIGINAL_COMMAND:-${*:-}}"
case "${ENV_NAME:-}" in
  production) PROJECT=jamolxon; HOST=jamolxon.uz ;;
  staging)    PROJECT=jamolxon-staging; HOST=staging.jamolxon.uz ;;
  *) echo "usage: jamolxon-deploy production|staging <40-char git sha>" >&2; exit 64 ;;
esac
[[ "${REF:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "ref must be a full git sha" >&2; exit 64; }

ENV_FILE="$BASE/$ENV_NAME/.env"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 66; }
exec 9>"/run/lock/jamolxon-deploy.lock"
flock -w 600 9 || { echo "another deploy is running" >&2; exit 75; }
exec > >(tee -a "$LOG_DIR/deploy-$ENV_NAME.log") 2>&1
echo "=== $(date -u +%FT%TZ) deploy $ENV_NAME $REF"

set -a; . "$ENV_FILE"; set +a
notify() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  curl -fsS -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=$1" >/dev/null || true
}

# 1. Source at the exact commit
if [ ! -d "$SRC/.git" ]; then git clone --quiet "$REPO_URL" "$SRC"; fi
git -C "$SRC" fetch --quiet --tags --force origin
# Only commits that are on main (staging) or carry a v* tag (production) may be deployed.
if [ "$ENV_NAME" = production ]; then
  [ -n "$(git -C "$SRC" tag --points-at "$REF" --list 'v*')" ] || { echo "production: $REF has no v* tag" >&2; exit 65; }
else
  git -C "$SRC" merge-base --is-ancestor "$REF" origin/main || { echo "staging: $REF is not on main" >&2; exit 65; }
fi
git -C "$SRC" -c advice.detachedHead=false checkout --quiet --force "$REF"
TAG="${REF:0:12}"

compose() {
  APP_TAG="$1" ENV_FILE="$ENV_FILE" COMPOSE_PROJECT_NAME="$PROJECT" \
    docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$SRC/infra/docker-compose.prod.yml" "${@:2}"
}
PREV_TAG="$(cat "$BASE/$ENV_NAME/current_tag" 2>/dev/null || true)"

# 2. Build (on the server: no registry credentials needed for a public repo)
docker build --quiet -f "$SRC/infra/Dockerfile" --target app -t "jamolxon-app:$TAG" "$SRC" >/dev/null
docker build --quiet -f "$SRC/infra/Dockerfile" --target web -t "jamolxon-web:$TAG" "$SRC" >/dev/null

# 3. Data stores up, then a backup before touching the schema
compose "$TAG" up -d postgres redis
for _ in $(seq 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose "$TAG" ps -q postgres)")" = healthy ] && break; sleep 2
done
if [ -n "$PREV_TAG" ]; then BACKUP_REASON=predeploy bash "$SRC/infra/scripts/backup.sh" "$ENV_NAME" || { notify "❌ $ENV_NAME: deploydan oldingi backup yiqildi, deploy to'xtatildi"; exit 1; }; fi

# 4. Migrations (expand-only, backwards compatible) with the NEW image
compose "$TAG" run --rm --no-deps api alembic upgrade head

# 5. New api/worker/nginx
compose "$TAG" up -d --remove-orphans api worker nginx

healthy() {
  local cid; cid="$(compose "$TAG" ps -q api)"
  for _ in $(seq 40); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null)" = healthy ] && return 0; sleep 3
  done
  return 1
}
# Smoke hits the new nginx container directly (independent of DNS, Cloudflare and Caddy).
smoke() {
  local ip c
  ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$PROJECT-nginx" | awk '{print $1}')"
  [ -n "$ip" ] || return 1
  c() { curl -fsS -m 15 -H "Host: $HOST" -H "X-Forwarded-Proto: https" "$@"; }
  for _ in $(seq 30); do c -o /dev/null "http://$ip/" 2>/dev/null && break; sleep 2; done  # first site build
  c -o /dev/null "http://$ip/" &&
  c "http://$ip/api/v1/ready" | grep -q '"ok"' &&
  c -o /dev/null "http://$ip/loyihalar/" &&
  c -o /dev/null "http://$ip/sitemap.xml"
}

if healthy && sleep 8 && smoke; then
  echo "$TAG" > "$BASE/$ENV_NAME/current_tag"
  echo "deploy ok: $TAG"
  notify "✅ $ENV_NAME deploy: ${TAG}"
  # keep the last 3 image tags per target
  for img in jamolxon-app jamolxon-web; do
    docker images "$img" --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | awk 'NR>3{print $2}' |
      while read -r t; do
        grep -qx "$t" "$BASE"/*/current_tag 2>/dev/null || docker rmi -f "$img:$t" >/dev/null 2>&1 || true
      done
  done
  exit 0
fi

echo "!! health/smoke failed for $TAG"
if [ -n "$PREV_TAG" ]; then
  compose "$PREV_TAG" up -d api worker nginx
  notify "⚠️ $ENV_NAME deploy ${TAG} yiqildi — ${PREV_TAG} ga qaytarildi"
else
  notify "❌ $ENV_NAME birinchi deploy ${TAG} yiqildi"
fi
exit 1
