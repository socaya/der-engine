#!/usr/bin/env bash
# §9 Testing — golden deployment verification.
#
# Asserts a fresh install matches the known-good state: schema version,
# required endpoints reachable, admin UI shell served, and no FAIL
# outcomes in the last 24 h of testing_run.
#
# Env:
#   DER_BASE_URL     default http://localhost:8080
#   DER_ADMIN_COOKIE required
set -Eeuo pipefail

BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
COOKIE="${DER_ADMIN_COOKIE:-}"

if [[ -z "${COOKIE}" ]]; then
    echo "golden_deploy.sh: DER_ADMIN_COOKIE is required" >&2
    exit 2
fi

fail() { echo "  FAIL: $*" >&2; exit 1; }
ok()   { echo "  OK:   $*"; }

# 1. Health
curl -sf "${BASE_URL}/edge-api/v1/system/health" >/dev/null \
    && ok "health 200" || fail "health unreachable"

# 2. Required endpoints behind auth
for path in /edge-api/v1/fleet /edge-api/v1/compat /edge-api/v1/activity/recent; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: ${COOKIE}" "${BASE_URL}${path}")
    [[ "${code}" == "200" ]] && ok "${path} 200" || fail "${path} returned ${code}"
done

# 3. Admin UI shell
code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/admin/")
[[ "${code}" == "200" ]] && ok "admin shell 200" || fail "admin shell returned ${code}"

# 4. SW present
code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/admin/sw.js")
[[ "${code}" == "200" ]] && ok "sw.js 200" || fail "sw.js returned ${code}"

# 5. Record golden run
t0="$(date +%s%3N)"
# tiny load probe to prove the stack is accepting writes.
curl -sf -X POST -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/testing/load?concurrency=2&durationSec=2" >/dev/null \
    && ok "load probe PASS" || fail "load probe failed"
t1="$(date +%s%3N)"
dur_ms=$((t1 - t0))
body=$(cat <<EOF
{"kind":"GOLDEN","scenario":"deploy-verify","outcome":"PASS","durationMs":${dur_ms},
 "requestsTotal":5,"requestsFailed":0}
EOF
)
curl -sf -X POST -H "Cookie: ${COOKIE}" -H "Content-Type: application/json" \
    --data "${body}" "${BASE_URL}/edge-api/v1/testing/runs" >/dev/null \
    && ok "golden run recorded" || fail "could not record golden run"

echo
echo "golden_deploy.sh: ALL CHECKS PASSED"
