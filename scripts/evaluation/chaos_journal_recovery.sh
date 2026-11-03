#!/usr/bin/env bash
#
# Phase 11.1 chaos — journal state-machine recovery after SIGKILL.
#
# Scenario:
#   1. Seed the journal with N rows stuck in IN_FLIGHT. In a real
#      run this happens naturally when the drain worker flips to
#      IN_FLIGHT and the process dies before the terminal UPDATE.
#      We short-circuit by injecting the state directly in SQL so
#      the test is deterministic.
#   2. Kill -9 the running DER.
#   3. Boot DER back up.
#   4. Assert: 0 rows remain in IN_FLIGHT; the N rows are back to
#      PENDING with attempt_count incremented and last_error
#      marked as reaped.
#
# Env:
#   DER_JAR          path to the jar to re-launch
#   PGHOST / PGUSER / PGPASSWORD / PGDATABASE
#
# Exit code 0 on recovery, 1 on any stuck row remaining.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
JAR="${DER_JAR:-${ROOT}/server/target/der-server-2.3.122.jar}"
BASE_URL="${DER_BASE_URL:-http://localhost:8085}"
N="${CHAOS_N_ROWS:-3}"

ok()   { printf '  \033[0;32mOK\033[0m    %s\n' "$1"; }
warn() { printf '  \033[0;33mWARN\033[0m  %s\n' "$1" >&2; }
fail() { printf '  \033[0;31mFAIL\033[0m  %s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

psql_run() {
    PGPASSWORD="${PGPASSWORD:-der_phase01_devonly}" \
        psql -h "${PGHOST:-localhost}" -U "${PGUSER:-der}" \
             -d "${PGDATABASE:-der}" -tAc "$1"
}

step "Pre-flight — DER up on ${BASE_URL}"
curl -sf "${BASE_URL}/edge-api/v1/system/health" >/dev/null \
    || fail "DER not reachable at ${BASE_URL} — start it first"
ok "DER reachable"

step "Seed ${N} IN_FLIGHT rows"
psql_run "DELETE FROM der.operation_journal
          WHERE entity_ref LIKE 'chaos-recovery-%';" >/dev/null
for ((i = 0; i < N; i++)); do
    psql_run "INSERT INTO der.operation_journal
              (operation_id, entity_type, entity_ref, payload_json,
               state, attempt_count)
              VALUES (gen_random_uuid(), 'AGGREGATE_DATA_VALUE',
                      'chaos-recovery-${i}', '{}'::jsonb,
                      'IN_FLIGHT', 2);" >/dev/null
done
seeded=$(psql_run "SELECT COUNT(*) FROM der.operation_journal
                   WHERE entity_ref LIKE 'chaos-recovery-%'
                     AND state = 'IN_FLIGHT';")
(( seeded == N )) || fail "expected ${N} IN_FLIGHT seed rows, got ${seeded}"
ok "seeded ${seeded} IN_FLIGHT rows"

step "Chaos — SIGKILL running DER"
pid=$(lsof -nP -iTCP:8085 -sTCP:LISTEN -t 2>/dev/null | head -1 || true)
[[ -n "${pid}" ]] || fail "no DER process listening on 8085"
kill -9 "${pid}"
# Wait for the port to close
for ((i = 0; i < 20; i++)); do
    sleep 0.5
    if ! lsof -nP -iTCP:8085 -sTCP:LISTEN -t >/dev/null 2>&1; then
        break
    fi
done
lsof -nP -iTCP:8085 -sTCP:LISTEN -t >/dev/null 2>&1 \
    && fail "port 8085 still bound after SIGKILL"
ok "DER PID ${pid} killed; port 8085 released"

step "Reboot DER"
if [[ -f "${ROOT}/.env.local" ]]; then
    set -a; . "${ROOT}/.env.local"; set +a
fi
nohup java -jar "${JAR}" > "/tmp/der-chaos-recovery.log" 2>&1 &
until curl -sf "${BASE_URL}/edge-api/v1/system/health" >/dev/null 2>&1; do
    sleep 2
done
ok "DER back up"

step "Assert reaper did its job"
sleep 1  # ApplicationReadyEvent fires post-ready
stuck=$(psql_run "SELECT COUNT(*) FROM der.operation_journal
                  WHERE entity_ref LIKE 'chaos-recovery-%'
                    AND state = 'IN_FLIGHT';")
(( stuck == 0 )) || fail "${stuck} rows still stuck in IN_FLIGHT"
ok "0 rows stuck in IN_FLIGHT"

requeued=$(psql_run "SELECT COUNT(*) FROM der.operation_journal
                     WHERE entity_ref LIKE 'chaos-recovery-%'
                       AND state = 'PENDING'
                       AND attempt_count = 3
                       AND last_error LIKE '%reaped%DER restart%';")
(( requeued == N )) || fail "expected ${N} rows requeued with attempt_count=3 + reaped marker, got ${requeued}"
ok "${requeued} rows back to PENDING with attempt_count incremented and reaped marker"

# Clean up seeded rows so the next run starts from a clean slate.
psql_run "DELETE FROM der.operation_journal
          WHERE entity_ref LIKE 'chaos-recovery-%';" >/dev/null
ok "cleanup done"

echo
echo "=== chaos_journal_recovery: PASS ==="
