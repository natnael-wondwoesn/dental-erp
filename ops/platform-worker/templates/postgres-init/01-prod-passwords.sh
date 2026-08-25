#!/bin/sh
set -eu
: "${CLINIC_OWNER_PASSWORD:?required}"
: "${CLINIC_APP_PASSWORD:?required}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set owner_password="$CLINIC_OWNER_PASSWORD" --set app_password="$CLINIC_APP_PASSWORD" <<'SQL'
ALTER ROLE clinic_owner WITH PASSWORD :'owner_password';
ALTER ROLE clinic_app WITH PASSWORD :'app_password';
SQL
