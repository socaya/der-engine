#!/usr/bin/env bash
#
# ADR-0035 chaos — pull/write interlock verification against live Postgres.
#
# Scenario:
#   1. Seed a CENTRAL_ACCEPTED (terminal) journal row at ou1 so a
#      central pull would normally take the overwrite path.
#   2. In a background shell, open a long-lived psql tx that holds a
#      SELECT ... FOR UPDATE on the row — simulating the drain
#      worker publishing mid-POST.
#   3. In the main shell, issue a probe psql SELECT ... FOR UPDATE
#      SKIP LOCKED and verify we see zero rows back (lock contention).
#   4. Release the long-held lock; probe again; verify the lock is
#      now acquirable.
#   5. Clean up seeded rows.
#
# Does NOT boot DER — this validates the Postgres contract the
# tryLockRowForPublish method depends on. The unit-test battery
# (TrackerPullerTest.drainHoldingLockDefersAllThreeFamilies...)
# proves the Java side wires the probe through correctly.
#
# Exit 0 on verified correctness; 1 on contract violation.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PGHOST="${PGHOST:-localhost}"
export PGUSER="${PGUSER:-der}"
export PGPASSWORD="${PGPASSWORD:-der_phase01_devonly}"
export PGDATABASE="${PGDATABASE:-der}"

ok()   { printf '  \033[0;32mOK\033[0m    %s\n' "$1"; }
fail() { printf '  \033[0;31mFAIL\033[0m  %s\n' "$1" >&2; exit 1; }
step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

psql_c() { psql -tAc "$1"; }

cleanup() {
    [[ -n "${BG_PID:-}" ]] && kill "${BG_PID}" 2>/dev/null || true
    psql_c "DELETE FROM der.operation_journal
            WHERE entity_ref LIKE 'adr-0035-chaos-%';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

OP_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
REF="adr-0035-chaos-$(date +%s)"

step "Pre-flight — Postgres reachable at ${PGHOST}"
psql_c "SELECT 1" >/dev/null || fail "cannot reach postgres"
ok "connected"

step "Seed one terminal journal row"
psql_c "INSERT INTO der.operation_journal
        (operation_id, entity_type, entity_ref, payload_json,
         state, attempt_count)
        VALUES ('${OP_ID}', 'AGGREGATE_DATA_VALUE', '${REF}',
                '{}'::jsonb, 'CENTRAL_ACCEPTED', 0);" >/dev/null
ok "seeded op=${OP_ID}"

step "Simulate drain holding the row (background tx + lock)"
# Keep a psql open with a transaction that SELECTs FOR UPDATE and sleeps.
# This stand-in for the drain's own UPDATE lock is bit-equivalent as far
# as SKIP LOCKED is concerned.
coproc BG {
    psql -q -X <<SQL
BEGIN;
SELECT 1 FROM der.operation_journal
 WHERE operation_id = '${OP_ID}' FOR UPDATE;
SELECT pg_sleep(10);
COMMIT;
SQL
}
BG_PID=$BG_PID
sleep 1   # give the BEGIN time to acquire the lock
ok "background tx holding lock (pid=${BG_PID})"

step "Probe while locked — SKIP LOCKED must return zero rows"
LOCKED_PROBE=$(psql_c "SELECT 1 FROM der.operation_journal
                       WHERE operation_id = '${OP_ID}'
                         FOR UPDATE SKIP LOCKED;" | wc -l | tr -d ' ')
if [[ "${LOCKED_PROBE}" != "0" ]]; then
    fail "contract violated — SKIP LOCKED returned ${LOCKED_PROBE} rows while \
another tx held FOR UPDATE on the same row"
fi
ok "probe returned 0 rows — tryLockRowForPublish will see false and defer"

step "Release the background lock + wait for commit"
# The coproc's pg_sleep will complete within 10s and COMMIT.
wait "${BG_PID}" 2>/dev/null || true
unset BG_PID
ok "background tx committed"

step "Probe after release — SKIP LOCKED must now return one row"
UNLOCKED_PROBE=$(psql_c "SELECT 1 FROM der.operation_journal
                         WHERE operation_id = '${OP_ID}'
                           FOR UPDATE SKIP LOCKED;" | wc -l | tr -d ' ')
if [[ "${UNLOCKED_PROBE}" != "1" ]]; then
    fail "contract violated — SKIP LOCKED returned ${UNLOCKED_PROBE} rows \
after the holder committed; expected 1"
fi
ok "probe returned 1 row — pull would proceed with the overwrite"

echo
echo "=== chaos_pull_write_interlock: PASS ==="
