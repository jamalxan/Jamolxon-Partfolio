#!/usr/bin/env bash
# Restore a backup into an environment's database (see infra/RESTORE.md).
#   AGE_IDENTITY=/root/age-key.txt infra/scripts/restore.sh <production|staging> <file.dump.age>
# The age private key is NOT kept on the server: copy it from the password manager for the restore only.
set -euo pipefail
ENV_NAME="$1"; FILE="$2"
case "$ENV_NAME" in production) PROJECT=jamolxon ;; staging) PROJECT=jamolxon-staging ;; *) exit 64 ;; esac
: "${AGE_IDENTITY:?path to the age private key}"
PG="$(docker ps -q --filter "label=com.docker.compose.project=$PROJECT" --filter "label=com.docker.compose.service=postgres")"
[ -n "$PG" ] || { echo "start postgres first: docker compose -p $PROJECT ... up -d postgres" >&2; exit 1; }
START=$(date +%s)
age -d -i "$AGE_IDENTITY" "$FILE" | docker exec -i "$PG" pg_restore -U jamolxon -d jamolxon --clean --if-exists --no-owner
docker exec "$PG" psql -U jamolxon -d jamolxon -tc "select 'projects='||count(*) from projects; select 'leads='||count(*) from leads"
echo "restore finished in $(( $(date +%s) - START ))s"
