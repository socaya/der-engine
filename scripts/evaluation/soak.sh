#!/usr/bin/env bash
# §9 Testing — longer-duration soak probe.
# Env:
#   DER_BASE_URL     default http://localhost:8080
#   DER_ADMIN_COOKIE required
#   CONCURRENCY      default 2
#   DURATION         default 60 (seconds; server clamps to 600)
set -Eeuo pipefail

BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
COOKIE="${DER_ADMIN_COOKIE:-}"
CONC="${CONCURRENCY:-2}"
DUR="${DURATION:-60}"

if [[ -z "${COOKIE}" ]]; then
    echo "soak.sh: DER_ADMIN_COOKIE is required" >&2
    exit 2
fi

echo "soak.sh: concurrency=${CONC} duration=${DUR}s base=${BASE_URL}"
curl -sf -X POST -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/testing/soak?concurrency=${CONC}&durationSec=${DUR}"
echo
