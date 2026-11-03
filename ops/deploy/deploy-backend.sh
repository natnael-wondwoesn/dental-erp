#!/usr/bin/env bash
# Roll the SaaS control backend (migrate + api) to one released image.
#
#   deploy-backend.sh <client> <backend-image-ref>
#
# Needs BACKEND_COMPOSE_FILE, BACKEND_ENV_FILE and BACKEND_SERVICE in
# /opt/deploy/clients/<client>.conf. Backs up the control Postgres database,
# swaps SAAS_BACKEND_IMAGE, lets compose run the alembic migrate service and wait
# for the API health check, and restores the previous image on any failure. The
# database is not rolled back, so migrations must be additive.
set -euo pipefail

CLIENT="${1:?client required}"
IMAGE="${2:?image ref required}"
CONF_DIR="${CONF_DIR:-/opt/deploy/clients}"
BACKUPS="${BACKUP_ROOT:-/opt/backups}"

[[ "$CLIENT" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "bad client name" >&2; exit 2; }
[[ "$IMAGE" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo "bad image ref" >&2; exit 2; }
[[ -f "$CONF_DIR/$CLIENT.conf" ]] || { echo "no conf for $CLIENT" >&2; exit 2; }
# shellcheck disable=SC1090
source "$CONF_DIR/$CLIENT.conf"
: "${BACKEND_COMPOSE_FILE:?}" "${BACKEND_ENV_FILE:?}" "${BACKEND_SERVICE:?}"
[[ -f "$BACKEND_COMPOSE_FILE" && -f "$BACKEND_ENV_FILE" ]] || { echo "backend stack files missing" >&2; exit 2; }

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
compose() { docker compose --env-file "$BACKEND_ENV_FILE" -f "$BACKEND_COMPOSE_FILE" "$@"; }

PREVIOUS="$(grep -E '^SAAS_BACKEND_IMAGE=' "$BACKEND_ENV_FILE" | head -1 | cut -d= -f2-)"
if [[ "$PREVIOUS" == "$IMAGE" ]]; then log "backend already runs $IMAGE"; exit 0; fi

log "pulling $IMAGE"
docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE"

log "backing up control database"
PG="$(docker ps -q --filter label=com.docker.compose.project=dental-saas --filter label=com.docker.compose.service=postgres | head -1)"
[[ -n "$PG" ]] || { echo "control postgres is not running" >&2; exit 1; }
mkdir -p "$BACKUPS/saas-control"
docker exec "$PG" pg_dump -U dental_saas -Fc dental_saas > "$BACKUPS/saas-control/$STAMP.dump"
[[ -s "$BACKUPS/saas-control/$STAMP.dump" ]] || { echo "backup is empty, aborting" >&2; exit 1; }

cp -p "$BACKEND_ENV_FILE" "$BACKEND_ENV_FILE.bak-$STAMP"
rollback() {
  log "FAILED - restoring $PREVIOUS"
  cp -p "$BACKEND_ENV_FILE.bak-$STAMP" "$BACKEND_ENV_FILE"
  compose up -d --no-build --wait --wait-timeout 180 "$BACKEND_SERVICE" || true
  echo "$STAMP rollback backend $IMAGE -> $PREVIOUS" >> "$(dirname "$BACKEND_ENV_FILE")/deployments.log"
  exit 1
}
trap rollback ERR

log "switching backend to $IMAGE (alembic runs first)"
sed -i "s|^SAAS_BACKEND_IMAGE=.*|SAAS_BACKEND_IMAGE=$IMAGE|" "$BACKEND_ENV_FILE"
compose up -d --no-build --wait --wait-timeout 240 "$BACKEND_SERVICE"

trap - ERR
echo "$STAMP ok backend $PREVIOUS -> $IMAGE" >> "$(dirname "$BACKEND_ENV_FILE")/deployments.log"
log "done: backend now runs $IMAGE (previous: $PREVIOUS, backup: $BACKUPS/saas-control/$STAMP.dump)"

ls -1t "$BACKUPS"/saas-control/*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
ls -1t "$BACKEND_ENV_FILE".bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f
