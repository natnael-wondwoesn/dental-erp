#!/usr/bin/env bash
# Deploy one released image to one client stack on this VPS.
#
#   deploy.sh <client-slug> <image-ref>
#   deploy.sh berhanu-dental ghcr.io/natnael-wondwoesn/dental-erp:0.1.20
#
# A client lives in /opt/clients/<slug>/ with a compose.yml and a .env that sets
# APP_IMAGE. Steps: pull, back up the database, switch APP_IMAGE, let compose run
# the migrate service and wait for the app healthcheck, then confirm the public
# URL. On any failure the previous APP_IMAGE is restored. The database is not
# rolled back, so migrations must be additive (expand/contract).
set -euo pipefail

SLUG="${1:?client slug required}"
IMAGE="${2:?image ref required}"
ROOT="${CLIENTS_ROOT:-/opt/clients}"
BACKUPS="${BACKUP_ROOT:-/opt/backups}"
KEEP_IMAGES="${KEEP_IMAGES:-4}"
DIR="$ROOT/$SLUG"

[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "bad client slug" >&2; exit 2; }
[[ "$IMAGE" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo "bad image ref" >&2; exit 2; }
[[ -f "$DIR/compose.yml" && -f "$DIR/.env" ]] || { echo "no compose.yml/.env in $DIR" >&2; exit 2; }
cd "$DIR"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
get_env() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
set_image() { sed -i "s|^APP_IMAGE=.*|APP_IMAGE=$1|" .env; }

PREVIOUS="$(get_env APP_IMAGE)"
HOSTNAME_PUBLIC="$(get_env HOSTNAME)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ "$PREVIOUS" == "$IMAGE" ]]; then
  log "$SLUG already runs $IMAGE; re-checking health only"
fi

log "pulling $IMAGE"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE"

log "backing up database"
mkdir -p "$BACKUPS/$SLUG"
docker compose exec -T mysql sh -c 'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines dental_erp' \
  | gzip > "$BACKUPS/$SLUG/$STAMP.sql.gz"
[[ -s "$BACKUPS/$SLUG/$STAMP.sql.gz" ]] || { echo "backup is empty, aborting" >&2; exit 1; }

cp -p .env ".env.prev"
rollback() {
  log "FAILED - restoring $PREVIOUS"
  cp -p .env.prev .env
  docker compose up -d --wait --wait-timeout 180 app || true
  echo "$STAMP rollback $SLUG $IMAGE -> $PREVIOUS" >> deployments.log
  exit 1
}
trap rollback ERR

log "switching $SLUG to $IMAGE (migrations run first)"
set_image "$IMAGE"
docker compose up -d --wait --wait-timeout 240

if [[ -n "$HOSTNAME_PUBLIC" ]]; then
  log "checking https://$HOSTNAME_PUBLIC/api/ready"
  for _ in 1 2 3 4 5 6; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://$HOSTNAME_PUBLIC/api/ready" || true)"
    [[ "$code" == "200" ]] && break
    sleep 5
  done
  [[ "$code" == "200" ]]
fi

trap - ERR
echo "$STAMP ok $SLUG $PREVIOUS -> $IMAGE" >> deployments.log
log "done: $SLUG now runs $IMAGE (previous: $PREVIOUS, backup: $BACKUPS/$SLUG/$STAMP.sql.gz)"

# Housekeeping: keep the newest backups and drop dangling images.
ls -1t "$BACKUPS/$SLUG"/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
docker image prune -f >/dev/null
