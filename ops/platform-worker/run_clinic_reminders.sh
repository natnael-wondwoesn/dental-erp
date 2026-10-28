#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]{1,62}$ ]] || {
  echo "Invalid clinic slug" >&2
  exit 2
}

env_file="/opt/clients/$slug/.env"
test -r "$env_file"

cron_secret="$(sed -n 's/^CRON_SECRET=//p' "$env_file" | head -n 1)"
base_url="$(sed -n 's/^NEXTAUTH_URL=//p' "$env_file" | head -n 1)"
if [[ -z "$base_url" ]]; then
  hostname="$(sed -n 's/^HOSTNAME=//p' "$env_file" | head -n 1)"
  [[ "$hostname" =~ ^[a-z0-9.-]+$ ]] || {
    echo "Invalid clinic hostname" >&2
    exit 2
  }
  base_url="https://$hostname"
fi
test -n "$cron_secret"
[[ "$base_url" =~ ^https://[a-z0-9.-]+$ ]]

exec curl --fail --silent --show-error \
  --max-time 120 \
  --header "Authorization: Bearer $cron_secret" \
  "$base_url/api/cron/reminders"
