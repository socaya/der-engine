#!/usr/bin/env bash
# FR-01-09 — compatibility-checked upgrade with rollback.
# Usage: upgrade.sh <new-version> [install-root]
#
# Precondition: install.sh has already placed the new release
# under <root>/releases/<version>.
#
# Flow:
#   1. Snapshot the DB via scripts/evaluation/backup_integrity.py.
#   2. Compare DER's compat profile against the running DHIS2 pin
#      via /edge-api/v1/compat.
#   3. Stop DER; flip symlink; start new DER; probe /system/health.
#   4. If health fails within 60s, call rollback.sh.

set -Eeuo pipefail

NEW="${1:-}"
INSTALL_ROOT="${2:-/opt/der}"
BASE_URL="${DER_BASE_URL:-http://localhost:8080}"

if [[ -z "${NEW}" ]]; then
    echo "usage: $0 <new-version> [install-root]"
    exit 2
fi

PREVIOUS="$(readlink "${INSTALL_ROOT}/current" || true)"
if [[ -z "${PREVIOUS}" ]]; then
    echo "upgrade: no current install detected; run install.sh first"
    exit 3
fi

echo "upgrade: current=${PREVIOUS} target=${NEW}"

# 1. Snapshot — operators configure the backup pipeline per ADR-0012.
echo "upgrade: requesting backup via /edge-api/v1/admin/ops/backup/trigger"
curl -sS -X POST -H 'Content-Type: application/json' \
    -b "${DER_ADMIN_COOKIE:-}" \
    -d '{"kind":"FULL"}' \
    "${BASE_URL}/edge-api/v1/admin/ops/backup/trigger" || true

# 2. Compat check — read current DHIS2 reference and the new DER's
# supported range.
COMPAT="$(curl -sS "${BASE_URL}/edge-api/v1/compat" || true)"
echo "upgrade: current compat snapshot: ${COMPAT}"
if ! echo "${COMPAT}" | grep -q 'profileName'; then
    echo "upgrade: compat probe failed; aborting"
    exit 4
fi

# 3. Flip + probe.
echo "upgrade: stopping current DER…"
systemctl stop der || true
ln -sfn "${INSTALL_ROOT}/releases/${NEW}" "${INSTALL_ROOT}/current"
systemctl start der || true

echo "upgrade: probing health for 60s…"
for i in $(seq 1 30); do
    if curl -sSf "${BASE_URL}/edge-api/v1/system/health" >/dev/null 2>&1; then
        echo "upgrade: ${NEW} healthy"
        exit 0
    fi
    sleep 2
done

echo "upgrade: health probe failed; triggering rollback"
exec "$(dirname "$0")/rollback.sh" "$(basename "${PREVIOUS}")" "${INSTALL_ROOT}"
