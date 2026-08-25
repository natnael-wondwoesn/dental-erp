#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root" >&2
  exit 1
fi

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_DIR=/opt/product-platform-worker
SERVICE_FILE=/etc/systemd/system/product-platform-worker.service
ENV_FILE=/etc/sunny-smile/platform-worker.env

install -d -m 0755 "$TARGET_DIR" "$TARGET_DIR/templates" "$TARGET_DIR/templates/postgres-init"
install -d -m 0700 /etc/sunny-smile /opt/clients /opt/backups/clients
install -d -m 0755 /opt/kora/sites
install -m 0755 "$SOURCE_DIR/platform_worker.py" "$TARGET_DIR/platform_worker.py"
install -m 0644 "$SOURCE_DIR/templates/dental-erp.compose.yml" "$TARGET_DIR/templates/dental-erp.compose.yml"
install -m 0644 "$SOURCE_DIR/templates/clinic-cms.compose.yml" "$TARGET_DIR/templates/clinic-cms.compose.yml"
install -m 0644 "$SOURCE_DIR/templates/postgres-init/00-roles.sql" "$TARGET_DIR/templates/postgres-init/00-roles.sql"
install -m 0755 "$SOURCE_DIR/templates/postgres-init/01-prod-passwords.sh" "$TARGET_DIR/templates/postgres-init/01-prod-passwords.sh"
install -m 0644 "$SOURCE_DIR/product-platform-worker.service" "$SERVICE_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE does not exist; create it with CONTROL_PLANE_URL and PLATFORM_WORKER_TOKEN." >&2
  exit 2
fi
chmod 0600 "$ENV_FILE"
systemctl daemon-reload
systemctl enable --now product-platform-worker.service
systemctl --no-pager --full status product-platform-worker.service
