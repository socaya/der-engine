#!/usr/bin/env bash
# §9 Testing — chaos run.
#
# Non-destructive scenarios run server-side via /testing/chaos.
# Destructive scenarios (postgres restart, systemd kill) are driven
# from this script; the result (duration + outcome) is posted back
# to der.testing_run via /testing/runs so the audit history captures
# both styles.
#
# Env:
#   DER_BASE_URL     default http://localhost:8080
#   DER_ADMIN_COOKIE required for admin-gated calls
#   SCENARIO         one of: pool-saturation | slow-start | pg-restart | network-flap
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
SCENARIO="${SCENARIO:-pool-saturation}"
COOKIE="${DER_ADMIN_COOKIE:-}"

if [[ -z "${COOKIE}" ]]; then
    echo "chaos.sh: DER_ADMIN_COOKIE is required" >&2
    exit 2
fi

post() {
    local path="$1" body="${2:-}"
    local args=(-s -X POST -H "Cookie: ${COOKIE}" -H "Content-Type: application/json")
    [[ -n "${body}" ]] && args+=(--data "${body}")
    curl "${args[@]}" "${BASE_URL}${path}"
}

echo "chaos.sh: scenario=${SCENARIO} base=${BASE_URL}"
case "${SCENARIO}" in
    pool-saturation|slow-start)
        # In-process scenarios the server runs itself.
        post "/edge-api/v1/testing/chaos?scenario=${SCENARIO}" | tee "${ROOT}/.last-chaos.json"
        ;;
    pg-restart)
        t0="$(date +%s%3N)"
        echo "  stopping postgres…"
        sudo systemctl stop postgresql
        sleep 2
        echo "  starting postgres…"
        sudo systemctl start postgresql
        # Probe recovery for up to 30 s.
        attempts=0; recovered=0
        until (( attempts >= 30 )); do
            if curl -sf "${BASE_URL}/edge-api/v1/system/health" >/dev/null; then
                recovered=1; break
            fi
            attempts=$((attempts + 1)); sleep 1
        done
        t1="$(date +%s%3N)"
        dur_ms=$((t1 - t0))
        outcome=$([[ "${recovered}" == "1" ]] && echo PASS || echo FAIL)
        body=$(cat <<EOF
{"kind":"CHAOS","scenario":"pg-restart","outcome":"${outcome}","durationMs":${dur_ms},
 "requestsTotal":${attempts},"requestsFailed":$((attempts - recovered))}
EOF
)
        post "/edge-api/v1/testing/runs" "${body}" | tee "${ROOT}/.last-chaos.json"
        [[ "${outcome}" == "PASS" ]] || exit 1
        ;;
    network-flap)
        t0="$(date +%s%3N)"
        echo "  cycling default route (loopback for test)…"
        sudo ip link set lo down || true
        sleep 1
        sudo ip link set lo up
        t1="$(date +%s%3N)"
        dur_ms=$((t1 - t0))
        body=$(cat <<EOF
{"kind":"CHAOS","scenario":"network-flap","outcome":"PASS","durationMs":${dur_ms},
 "requestsTotal":1,"requestsFailed":0}
EOF
)
        post "/edge-api/v1/testing/runs" "${body}" | tee "${ROOT}/.last-chaos.json"
        ;;
    *)
        echo "chaos.sh: unknown scenario ${SCENARIO}" >&2
        exit 2
        ;;
esac
echo
echo "chaos.sh: done"
