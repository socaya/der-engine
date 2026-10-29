#!/usr/bin/env bash
# §9 Testing — short-burst load run.
# Env:
#   DER_BASE_URL     default http://localhost:8080
#   DER_ADMIN_COOKIE required
#   CONCURRENCY      default 8
#   DURATION         default 5 (seconds)
set -Eeuo pipefail

BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
COOKIE="${DER_ADMIN_COOKIE:-}"
CONC="${CONCURRENCY:-8}"
DUR="${DURATION:-5}"

if [[ -z "${COOKIE}" ]]; then
    echo "load.sh: DER_ADMIN_COOKIE is required" >&2
    exit 2
fi

echo "load.sh: concurrency=${CONC} duration=${DUR}s base=${BASE_URL}"
curl -sf -X POST -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/testing/load?concurrency=${CONC}&durationSec=${DUR}"
echo
