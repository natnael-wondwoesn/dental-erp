#!/usr/bin/env bash
# Record one rollout in the control platform so it shows on /owner/releases.
#
#   record.sh <client> <version> <SUCCEEDED|FAILED|ROLLED_BACK> [previous] [detail] [run-url]
#
# Runs inside the control API container, which already holds the admin token, so
# no extra secret is stored in GitHub or on the VPS. Never fails the release: if
# the control API is down or not yet updated, it only prints a warning.
set -uo pipefail
CLIENT="${1:?}" VERSION="${2:?}" STATUS="${3:?}" PREVIOUS="${4:-}" DETAIL="${5:-}" RUN_URL="${6:-}"

API="$(docker ps -q --filter label=com.docker.compose.project=dental-saas --filter label=com.docker.compose.service=api | head -1)"
[[ -n "$API" ]] || { echo "record: control API not running, skipped" >&2; exit 0; }

docker exec -i \
  -e R_CLIENT="$CLIENT" -e R_VERSION="$VERSION" -e R_STATUS="$STATUS" \
  -e R_PREVIOUS="$PREVIOUS" -e R_DETAIL="$DETAIL" -e R_RUN="$RUN_URL" \
  "$API" /app/.venv/bin/python - <<'PY' || echo "record: could not store rollout, continuing" >&2
import json, os, urllib.request

body = {
    "client": os.environ["R_CLIENT"],
    "version": os.environ["R_VERSION"],
    "status": os.environ["R_STATUS"],
    "previousVersion": os.environ["R_PREVIOUS"] or None,
    "detail": os.environ["R_DETAIL"][:2000] or None,
    "runUrl": os.environ["R_RUN"] or None,
}
request = urllib.request.Request(
    "http://127.0.0.1:8000/api/saas/admin/deployments",
    data=json.dumps(body).encode(),
    headers={
        "Authorization": "Bearer " + os.environ["BACKEND_SAAS_ADMIN_TOKEN"],
        "X-Actor": "release-pipeline",
        "Content-Type": "application/json",
    },
)
urllib.request.urlopen(request, timeout=10).read()
print("record: stored", body["client"], body["version"], body["status"])
PY
exit 0
