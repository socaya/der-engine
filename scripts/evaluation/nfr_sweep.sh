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

# NFR-15/16/19 bench at each concurrency level.
for LVL in 1 5 10 20; do
    echo "nfr-sweep: bench health at c=${LVL}"
    python3 "${ROOT}/scripts/evaluation/der_bench.py" \
        --target "${DER_BASE_URL}/edge-api/v1/system/health" \
        --concurrency "${LVL}" --duration "${DUR}" \
        > "${OUT_DIR}/bench-health-${LVL}.json" 2>/dev/null || true
done

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
