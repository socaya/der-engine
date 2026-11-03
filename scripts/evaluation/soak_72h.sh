#!/usr/bin/env bash
#
# Phase 11.2 — 72h soak orchestrator.
#
# What this script does
# ─────────────────────
#
# 1. Pre-flight: confirms DER + DHIS2 reachable, admin cookie present,
#    Prometheus endpoint responds.
# 2. Baseline snapshot of Prometheus metrics + journal row counts.
# 3. For the duration of the soak window (default 72 hours):
#    a. Every DER_FLAP_PERIOD_SEC (default 2 hours) the DHIS2 process
#       is stopped for DER_FLAP_DOWNTIME_SEC (default 20 min) via
#       DER_DHIS2_STOP_CMD / DER_DHIS2_START_CMD. This drives the
#       reachability-gate state machine (ADR-0014) and exercises the
#       requeue-on-reconnect path.
#    b. Twice daily (every DER_SPIKE_PERIOD_SEC, default 12 hours) a
#       write-spike runs for DER_SPIKE_DURATION_SEC (default 10 min)
#       at DER_SPIKE_RATE writes/s against the testing/soak endpoint.
#       Rate-shaping is server-side; the client just drives the HTTP
#       loop.
# 4. End-state assertions:
#     - No rows in state IN_FLIGHT for longer than the reaper window.
#     - No orphaned enrollments / events (TrackerGraphReconciler is
#       expected to have auto-healed them per Phase 12.4).
#     - No outstanding REFERRAL rows past escalation deadline.
#     - Prometheus `der_journal_drain_success_total` monotonic
#       increase across the window (not stuck).
# 5. Final snapshot + manifest.
#
# Everything lands under:
#   docs/evaluation/evidence/phase-11/11.2-soak-72h/<run-id>/
#     baseline-metrics.prom
#     baseline-journal.json
#     flap-N.log            — one per central-flap cycle
#     spike-N.log           — one per write-spike window
#     final-metrics.prom
#     final-journal.json
#     end-state-assertions.json
#     manifest.json
#     soak-72h.log          — full script output
#
# Env knobs (all optional with sane defaults)
# ───────────────────────────────────────────
#   DER_BASE_URL              default http://localhost:8080
#   DER_ADMIN_COOKIE          required (name=value for -H Cookie)
#   DER_DHIS2_BASE_URL        default http://localhost:8090
#   DER_DHIS2_STOP_CMD        default "brew services stop tomcat@10"
#   DER_DHIS2_START_CMD       default "brew services start tomcat@10"
#   DER_SOAK_DURATION_SEC     default 259200 (72 hours)
#   DER_FLAP_PERIOD_SEC       default 7200   (2 hours)
#   DER_FLAP_DOWNTIME_SEC     default 1200   (20 min)
#   DER_FLAP_START_AFTER_SEC  default 60     (grace after boot)
#   DER_SPIKE_PERIOD_SEC      default 43200  (12 hours)
#   DER_SPIKE_DURATION_SEC    default 600    (10 min)
#   DER_SPIKE_RATE            default 100
#   DER_SPIKE_CONCURRENCY     default 10
#
# Short-cycle smoke mode (for dev verification; recommended before
# starting the real 72h run):
#
#   DER_SOAK_DURATION_SEC=600 \
#   DER_FLAP_PERIOD_SEC=120 \
#   DER_FLAP_DOWNTIME_SEC=30 \
#   DER_SPIKE_PERIOD_SEC=300 \
#   DER_SPIKE_DURATION_SEC=20 \
#   DER_SPIKE_RATE=20 \
#   bash scripts/evaluation/soak_72h.sh
#
# Exit codes
#   0 all green including end-state assertions
#   1 pre-flight failure
#   2 end-state assertion failure (soak completed but contract broke)
#   3 interrupted by signal
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
DHIS2_URL="${DER_DHIS2_BASE_URL:-http://localhost:8090}"
COOKIE="${DER_ADMIN_COOKIE:-}"
DHIS2_STOP="${DER_DHIS2_STOP_CMD:-brew services stop tomcat@10}"
DHIS2_START="${DER_DHIS2_START_CMD:-brew services start tomcat@10}"
SOAK_SEC="${DER_SOAK_DURATION_SEC:-259200}"
FLAP_PERIOD="${DER_FLAP_PERIOD_SEC:-7200}"
FLAP_DOWN="${DER_FLAP_DOWNTIME_SEC:-1200}"
FLAP_START_AFTER="${DER_FLAP_START_AFTER_SEC:-60}"
SPIKE_PERIOD="${DER_SPIKE_PERIOD_SEC:-43200}"
SPIKE_DUR="${DER_SPIKE_DURATION_SEC:-600}"
SPIKE_RATE="${DER_SPIKE_RATE:-100}"
SPIKE_CONC="${DER_SPIKE_CONCURRENCY:-10}"

RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
OUT_DIR="${ROOT}/docs/evaluation/evidence/phase-11/11.2-soak-72h/${RUN_ID}"
mkdir -p "${OUT_DIR}"
LOG="${OUT_DIR}/soak-72h.log"
exec > >(tee -a "${LOG}") 2>&1

trap 'echo "soak-72h: interrupted — attempting DHIS2 restart"; eval "${DHIS2_START}" || true; exit 3' INT TERM

say()  { printf '\n\033[1m[%s]\033[0m %s\n' "$(date -u +%H:%M:%S)" "$*"; }
ok()   { printf '  \033[0;32mOK\033[0m    %s\n' "$1"; }
warn() { printf '  \033[1;33mWARN\033[0m  %s\n' "$1"; }
fail() { printf '  \033[0;31mFAIL\033[0m  %s\n' "$1" >&2; }

# ───────────── pre-flight ─────────────

say "pre-flight"

if [[ -z "${COOKIE}" ]]; then
    fail "DER_ADMIN_COOKIE required (name=value)"
    exit 1
fi

if ! curl -sf "${BASE_URL}/edge-api/v1/system/health" >/dev/null; then
    fail "DER not reachable at ${BASE_URL}"
    exit 1
fi
ok "DER reachable at ${BASE_URL}"

if ! curl -sf "${DHIS2_URL}/api/system/info" >/dev/null; then
    warn "DHIS2 not reachable at ${DHIS2_URL} — ensure DER_DHIS2_BASE_URL is correct before starting"
    # Not fatal — DHIS2 may be currently down from a prior run.
fi

if ! curl -sf "${BASE_URL}/actuator/prometheus" >/dev/null; then
    fail "Prometheus endpoint not reachable — check actuator exposure"
    exit 1
fi
ok "Prometheus endpoint reachable"

# ───────────── baseline snapshot ─────────────

say "baseline snapshot"
curl -sS "${BASE_URL}/actuator/prometheus" > "${OUT_DIR}/baseline-metrics.prom"
curl -sS -H "Cookie: ${COOKIE}" "${BASE_URL}/edge-api/v1/admin/metrics" \
    > "${OUT_DIR}/baseline-journal.json" 2>/dev/null || true
ok "snapshots written"

# ───────────── soak loop ─────────────

T0="$(date +%s)"
END_AT=$(( T0 + SOAK_SEC ))
NEXT_FLAP=$(( T0 + FLAP_START_AFTER ))
NEXT_SPIKE=$(( T0 + SPIKE_PERIOD ))
FLAP_N=0
SPIKE_N=0

say "soak window begins — duration ${SOAK_SEC}s (${SOAK_SEC}/3600 h)"
echo "  flap period ${FLAP_PERIOD}s, downtime ${FLAP_DOWN}s"
echo "  spike period ${SPIKE_PERIOD}s, duration ${SPIKE_DUR}s, rate ${SPIKE_RATE}/s"

do_flap() {
    FLAP_N=$(( FLAP_N + 1 ))
    local flog="${OUT_DIR}/flap-${FLAP_N}.log"
    {
        echo "flap=${FLAP_N} started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "  running: ${DHIS2_STOP}"
        eval "${DHIS2_STOP}" || warn "stop returned non-zero (continuing)"
        sleep "${FLAP_DOWN}"
        echo "  running: ${DHIS2_START}"
        eval "${DHIS2_START}" || warn "start returned non-zero (continuing)"
        # Give Tomcat 30s to warm.
        sleep 30
        local back_up
        back_up=$(curl -sf "${DHIS2_URL}/api/system/info" >/dev/null && echo yes || echo no)
        echo "  dhis2 reachable after restart: ${back_up}"
        echo "flap=${FLAP_N} ended=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } > "${flog}" 2>&1
    ok "flap ${FLAP_N} complete → ${flog}"
}

do_spike() {
    SPIKE_N=$(( SPIKE_N + 1 ))
    local slog="${OUT_DIR}/spike-${SPIKE_N}.log"
    {
        echo "spike=${SPIKE_N} started=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        # Server-side testing endpoint caps duration at 600s; the
        # soak harness drives it in that unit. For higher throughput
        # we fan it out across SPIKE_CONC workers that call in parallel.
        local per_worker_dur=$(( SPIKE_DUR < 600 ? SPIKE_DUR : 600 ))
        local per_worker_rate=$(( SPIKE_RATE / SPIKE_CONC ))
        [[ ${per_worker_rate} -lt 1 ]] && per_worker_rate=1
        echo "  concurrency=${SPIKE_CONC} per-worker rate=${per_worker_rate} duration=${per_worker_dur}s"
        for w in $(seq 1 "${SPIKE_CONC}"); do
            curl -sS -X POST -H "Cookie: ${COOKIE}" \
                "${BASE_URL}/edge-api/v1/testing/soak?concurrency=${per_worker_rate}&durationSec=${per_worker_dur}" \
                > "${OUT_DIR}/spike-${SPIKE_N}-w${w}.json" 2>&1 &
        done
        wait
        echo "spike=${SPIKE_N} ended=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } > "${slog}" 2>&1
    ok "spike ${SPIKE_N} complete → ${slog}"
}

while [[ $(date +%s) -lt ${END_AT} ]]; do
    NOW=$(date +%s)
    if [[ ${NOW} -ge ${NEXT_FLAP} ]]; then
        say "central-flap cycle ${FLAP_N} starting"
        do_flap
        NEXT_FLAP=$(( NEXT_FLAP + FLAP_PERIOD ))
    fi
    if [[ ${NOW} -ge ${NEXT_SPIKE} ]]; then
        say "write-spike cycle ${SPIKE_N} starting"
        do_spike
        NEXT_SPIKE=$(( NEXT_SPIKE + SPIKE_PERIOD ))
    fi
    # Idle poll — the loop just sleeps until the next event.
    NOW=$(date +%s)
    WAIT_UNTIL=$(( NEXT_FLAP < NEXT_SPIKE ? NEXT_FLAP : NEXT_SPIKE ))
    [[ ${WAIT_UNTIL} -gt ${END_AT} ]] && WAIT_UNTIL=${END_AT}
    SLEEP_FOR=$(( WAIT_UNTIL - NOW ))
    [[ ${SLEEP_FOR} -lt 1 ]] && SLEEP_FOR=1
    sleep "${SLEEP_FOR}"
done

say "soak window complete — ${FLAP_N} flaps, ${SPIKE_N} spikes"

# ───────────── final snapshot ─────────────

curl -sS "${BASE_URL}/actuator/prometheus" > "${OUT_DIR}/final-metrics.prom"
curl -sS -H "Cookie: ${COOKIE}" "${BASE_URL}/edge-api/v1/admin/metrics" \
    > "${OUT_DIR}/final-journal.json" 2>/dev/null || true

# ───────────── end-state assertions ─────────────

say "end-state assertions"

STUCK_INFLIGHT=$(curl -sS -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/admin/journal/stuck-inflight-count" 2>/dev/null \
    | grep -oE '[0-9]+' | head -1)
STUCK_INFLIGHT=${STUCK_INFLIGHT:-unknown}

ORPHAN_COUNT=$(curl -sS -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/admin/tracker/orphan-conflict-count" 2>/dev/null \
    | grep -oE '[0-9]+' | head -1)
ORPHAN_COUNT=${ORPHAN_COUNT:-unknown}

OVERDUE_REF=$(curl -sS -H "Cookie: ${COOKIE}" \
    "${BASE_URL}/edge-api/v1/admin/referrals/overdue-count" 2>/dev/null \
    | grep -oE '[0-9]+' | head -1)
OVERDUE_REF=${OVERDUE_REF:-unknown}

DRAIN_FIRST=$(grep -oE 'der_journal_drain_success_total [0-9]+' "${OUT_DIR}/baseline-metrics.prom" \
    | tail -1 | awk '{print $NF}')
DRAIN_LAST=$(grep -oE 'der_journal_drain_success_total [0-9]+' "${OUT_DIR}/final-metrics.prom" \
    | tail -1 | awk '{print $NF}')
DRAIN_FIRST=${DRAIN_FIRST:-0}
DRAIN_LAST=${DRAIN_LAST:-0}

PASS=true
check() {
    local name="$1" cond="$2" detail="$3"
    if eval "${cond}"; then
        ok "${name} — ${detail}"
    else
        fail "${name} — ${detail}"
        PASS=false
    fi
}

check "stuck IN_FLIGHT = 0" "[[ '${STUCK_INFLIGHT}' == '0' ]]" "found ${STUCK_INFLIGHT}"
check "orphan conflicts = 0" "[[ '${ORPHAN_COUNT}' == '0' ]]" "found ${ORPHAN_COUNT}"
check "overdue referrals = 0" "[[ '${OVERDUE_REF}' == '0' ]]" "found ${OVERDUE_REF}"
check "drain monotonic increasing" "[[ ${DRAIN_LAST} -gt ${DRAIN_FIRST} ]]" \
    "baseline=${DRAIN_FIRST} final=${DRAIN_LAST}"

cat > "${OUT_DIR}/end-state-assertions.json" <<EOF
{
  "runId": "${RUN_ID}",
  "stuckInFlight": "${STUCK_INFLIGHT}",
  "orphanConflicts": "${ORPHAN_COUNT}",
  "overdueReferrals": "${OVERDUE_REF}",
  "drainSuccessBaseline": "${DRAIN_FIRST}",
  "drainSuccessFinal": "${DRAIN_LAST}",
  "passed": ${PASS}
}
EOF

# ───────────── manifest ─────────────

cat > "${OUT_DIR}/manifest.json" <<EOF
{
  "runId": "${RUN_ID}",
  "commit": "$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)",
  "baseUrl": "${BASE_URL}",
  "dhis2Url": "${DHIS2_URL}",
  "soakDurationSec": ${SOAK_SEC},
  "flaps": ${FLAP_N},
  "spikes": ${SPIKE_N},
  "flapPeriodSec": ${FLAP_PERIOD},
  "flapDowntimeSec": ${FLAP_DOWN},
  "spikePeriodSec": ${SPIKE_PERIOD},
  "spikeDurationSec": ${SPIKE_DUR},
  "spikeRate": ${SPIKE_RATE},
  "startedAt": "$(date -u -r "${T0}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

say "evidence bundle under ${OUT_DIR}"

if ${PASS}; then
    echo "=== soak_72h: PASS ==="
    exit 0
else
    echo "=== soak_72h: FAIL — end-state assertions broke ==="
    exit 2
fi
