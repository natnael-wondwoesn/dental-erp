#!/usr/bin/env bash
# Deploy one released image to one client stack on this VPS.
#
#   deploy.sh <client> <image-ref>
#   deploy.sh berhanu-dental ghcr.io/natnael-wondwoesn/dental-erp:0.1.21
#
# Two stack layouts are supported:
#
#   Standard  /opt/clients/<client>/{compose.yml,.env}; APP_IMAGE in .env; services
#             `mysql`, `migrate`, `app`. Used by Berhanu-style clinics.
#   Legacy    /opt/deploy/clients/<client>.conf names the directory, compose files,
#             services and database container (Lemlem and the control platform).
#             The image is injected through a generated overlay file last in the
#             compose file list, so existing overlays and networks are kept.
#
# Steps: pull, back up the database, switch the image, let compose run the
# migrate service and wait for the health check, confirm the public URL. Any
# failure restores the previous image. The database is not rolled back, so
# migrations must be additive (expand/contract).
set -euo pipefail

CLIENT="${1:?client required}"
IMAGE="${2:?image ref required}"
CONF_DIR="${CONF_DIR:-/opt/deploy/clients}"
CLIENTS_ROOT="${CLIENTS_ROOT:-/opt/clients}"
BACKUPS="${BACKUP_ROOT:-/opt/backups}"

[[ "$CLIENT" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "bad client name" >&2; exit 2; }
[[ "$IMAGE" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo "bad image ref" >&2; exit 2; }

LEGACY=0
if [[ -f "$CONF_DIR/$CLIENT.conf" ]]; then
  LEGACY=1
  # shellcheck disable=SC1090
  source "$CONF_DIR/$CLIENT.conf"
else
  DIR="$CLIENTS_ROOT/$CLIENT"
fi
[[ -d "$DIR" ]] || { echo "no stack directory $DIR" >&2; exit 2; }
cd "$DIR"

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OVERLAY=".deploy-image.yml"

if [[ $LEGACY -eq 1 ]]; then
  : "${COMPOSE_FILES:?}" "${WEB_SERVICE:?}" "${IMAGE_SERVICES:?}" "${DB_CONTAINER:?}"
  COMPOSE=(docker compose --env-file .env)
  for f in $COMPOSE_FILES; do COMPOSE+=(-f "$f"); done
  COMPOSE+=(-f "$OVERLAY")
  PREVIOUS="$(docker inspect --format '{{.Config.Image}}' "$(docker compose --env-file .env $(for f in $COMPOSE_FILES; do printf -- '-f %s ' "$f"; done) ps -q "$WEB_SERVICE" | head -1)" 2>/dev/null || echo unknown)"
  [[ -f "$OVERLAY" ]] || echo 'services: {}' > "$OVERLAY"   # no-op overlay on first run
  cp -p "$OVERLAY" "$OVERLAY.prev"
else
  [[ -f compose.yml && -f .env ]] || { echo "no compose.yml/.env in $DIR" >&2; exit 2; }
  COMPOSE=(docker compose)
  WEB_SERVICE=app
  PREVIOUS="$(grep -E '^APP_IMAGE=' .env | head -1 | cut -d= -f2-)"
  HEALTH_HOST="$(grep -E '^HOSTNAME=' .env | head -1 | cut -d= -f2-)"
  HEALTH_URL="${HEALTH_HOST:+https://$HEALTH_HOST/api/ready}"
  cp -p .env .env.prev
fi

[[ "$PREVIOUS" == "$IMAGE" ]] && log "$CLIENT already runs $IMAGE; re-checking health only"

log "pulling $IMAGE"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE"

log "backing up database"
mkdir -p "$BACKUPS/$CLIENT"
DUMP='mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --databases "${MYSQL_DATABASE:-dental_erp}"'
if [[ $LEGACY -eq 1 ]]; then
  docker exec "$DB_CONTAINER" sh -c "$DUMP" | gzip > "$BACKUPS/$CLIENT/$STAMP.sql.gz"
else
  "${COMPOSE[@]}" exec -T mysql sh -c "$DUMP" | gzip > "$BACKUPS/$CLIENT/$STAMP.sql.gz"
fi
[[ -s "$BACKUPS/$CLIENT/$STAMP.sql.gz" ]] || { echo "backup is empty, aborting" >&2; exit 1; }

set_image() {
  if [[ $LEGACY -eq 1 ]]; then
    { echo "services:"; for s in $IMAGE_SERVICES; do printf '  %s:\n    image: %s\n' "$s" "$1"; done; } > "$OVERLAY"
  else
    sed -i "s|^APP_IMAGE=.*|APP_IMAGE=$1|" .env
  fi
}

rollback() {
  log "FAILED - restoring $PREVIOUS"
  if [[ $LEGACY -eq 1 ]]; then cp -p "$OVERLAY.prev" "$OVERLAY"; else cp -p .env.prev .env; fi
  "${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 "$WEB_SERVICE" || true
  echo "$STAMP rollback $CLIENT $IMAGE -> $PREVIOUS" >> deployments.log
  exit 1
}
trap rollback ERR

log "switching $CLIENT to $IMAGE (migrations run first)"
set_image "$IMAGE"
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 240 "$WEB_SERVICE"

if [[ -n "${HEALTH_URL:-}" ]]; then
  log "checking $HEALTH_URL"
  code=000
  for _ in 1 2 3 4 5 6; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
    [[ "$code" == "200" ]] && break
    sleep 5
  done
  [[ "$code" == "200" ]]
fi

trap - ERR
echo "$STAMP ok $CLIENT $PREVIOUS -> $IMAGE" >> deployments.log
log "done: $CLIENT now runs $IMAGE (previous: $PREVIOUS, backup: $BACKUPS/$CLIENT/$STAMP.sql.gz)"

ls -1t "$BACKUPS/$CLIENT"/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
docker image prune -f >/dev/null
