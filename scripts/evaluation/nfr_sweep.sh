#!/usr/bin/env bash
# NFR evaluation sweep. Captures evidence for:
#   NFR-15 latency (p50/p95) at 5/10/20 users
#   NFR-16 throughput (writes/s + reads/s)
#   NFR-18 CPU/mem/disk budget
#   NFR-19 concurrency 1/5/10/20
#   NFR-20 operator metrics snapshot
#   NFR-29 backup integrity round-trip
#
# Produces:
#   docs/evaluation/evidence/phase-15/<run-id>/
#     bench-{health,metadata}-{1,5,10,20}.json
#     resource-sample.json
#     operator-metrics.json
#     backup-integrity.json
#     manifest.json
#
# Env:
#   DER_BASE_URL       default http://localhost:8080
#   DER_ADMIN_COOKIE   required for admin-gated endpoints
#   DER_BENCH_DURATION default 15 (seconds per level)
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DER_BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
DUR="${DER_BENCH_DURATION:-15}"
COMMIT="$(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT}"
OUT_DIR="${ROOT}/docs/evaluation/evidence/phase-15/${RUN_ID}"
mkdir -p "${OUT_DIR}"
LOG="${OUT_DIR}/nfr-sweep.log"
exec > >(tee -a "${LOG}") 2>&1

echo "nfr-sweep: run ${RUN_ID} at ${DER_BASE_URL}"

# Start resource sampler in background.
python3 "${ROOT}/scripts/evaluation/resource_sampler.py" \
    --data-dir "${ROOT}" --interval 2 --duration 120 \
    > "${OUT_DIR}/resource-sample.json" 2>/dev/null &
SAMPLER_PID=$!

# NFR-15/16/19 bench across every concurrency level in one run so
# the budget checker can see the full 1/5/10/20 table.
echo "nfr-sweep: bench health across c=1,5,10,20"
python3 "${ROOT}/scripts/evaluation/der_bench.py" \
    --base-url "${DER_BASE_URL}" \
    --path "/edge-api/v1/system/health" \
    --concurrency "1,5,10,20" --duration-seconds "${DUR}" \
    > "${OUT_DIR}/bench-health.json" 2>/dev/null || true

# NFR-20 operator metrics snapshot (requires auth).
if [[ -n "${DER_ADMIN_COOKIE:-}" ]]; then
    curl -sS -b "${DER_ADMIN_COOKIE}" \
        "${DER_BASE_URL}/edge-api/v1/admin/metrics" \
        > "${OUT_DIR}/operator-metrics.json" 2>/dev/null || true
fi

# NFR-29 backup integrity (dry-run).
python3 "${ROOT}/scripts/evaluation/backup_integrity.py" --dry-run \
    > "${OUT_DIR}/backup-integrity.json" 2>/dev/null || true

wait "${SAMPLER_PID}" 2>/dev/null || true

# NFR-18 budget assertion. Reads the sampler output we just wrote and
# asserts every pinned percentile respects the budget. Writes a
# Markdown report + a structured JSON result alongside the evidence.
echo "nfr-sweep: NFR-18 resource budget check"
BUDGET_RC=0
python3 "${ROOT}/scripts/evaluation/check_resource_budget.py" \
    --report "${OUT_DIR}/resource-sample.json" \
    --json-out "${OUT_DIR}/resource-budget-result.json" \
    --out "${OUT_DIR}/resource-budget-report.md" || BUDGET_RC=$?
if [[ "${BUDGET_RC}" -ne 0 ]]; then
    echo "nfr-sweep: resource budget FAILED (rc=${BUDGET_RC}) — see ${OUT_DIR}/resource-budget-report.md"
fi

# NFR-15 / NFR-16 bench-budget assertion. Reads the per-concurrency
# bench output + asserts latency ceilings and throughput floors at
# every level.
echo "nfr-sweep: NFR-15/16 bench budget check"
BENCH_BUDGET_RC=0
python3 "${ROOT}/scripts/evaluation/check_bench_budget.py" \
    --report "${OUT_DIR}/bench-health.json" \
    --json-out "${OUT_DIR}/bench-budget-result.json" \
    --out "${OUT_DIR}/bench-budget-report.md" || BENCH_BUDGET_RC=$?
if [[ "${BENCH_BUDGET_RC}" -ne 0 ]]; then
    echo "nfr-sweep: bench budget FAILED (rc=${BENCH_BUDGET_RC}) — see ${OUT_DIR}/bench-budget-report.md"
fi
# Combine both exit codes so the sweep fails if either budget is broken.
if [[ "${BENCH_BUDGET_RC}" -ne 0 && "${BUDGET_RC}" -eq 0 ]]; then
    BUDGET_RC="${BENCH_BUDGET_RC}"
fi

# Manifest.
cat > "${OUT_DIR}/manifest.json" <<EOF
{
  "runId": "${RUN_ID}",
  "commit": "${COMMIT}",
  "baseUrl": "${DER_BASE_URL}",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "benchDurationSeconds": ${DUR},
  "concurrencyLevels": [1, 5, 10, 20],
  "nfrCovered": ["NFR-15", "NFR-16", "NFR-18", "NFR-19", "NFR-20", "NFR-29"]
}
EOF

echo "nfr-sweep: evidence bundled under ${OUT_DIR}"
exit "${BUDGET_RC}"
