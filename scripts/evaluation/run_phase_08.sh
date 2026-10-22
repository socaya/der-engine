#!/usr/bin/env bash
# scripts/evaluation/run_phase_08.sh — Phase 08 NFR evaluation runner.
#
# Produces an evidence bundle under docs/evaluation/evidence/${DER_EVIDENCE_PHASE:-phase-07}/<run>/
# containing:
#   - manifest.json         — hardware, versions, timings (NFR-27, NFR-35)
#   - bench-health.json     — latency / throughput for /system/health (NFR-15/16/19)
#   - bench-metadata.json   — latency / throughput for /api/dataSets   (NFR-15/16/19)
#   - resource-sample.json  — RSS / CPU / disk time series             (NFR-18)
#   - backup-integrity.json — round-trip backup/restore check          (NFR-29)
#   - backlog-100.json      — journal drain for 100 ops                (NFR-17)
#   - backlog-1000.json     — journal drain for 1000 ops               (NFR-17)
#
# Prerequisites (checked at startup):
#   - DER running at $DER_BASE_URL  (default http://localhost:8080)
#   - Admin cookie exported in $DER_ADMIN_COOKIE (login via /auth/sign-in)
#   - Postgres data dir readable at $DER_DATA_DIR (optional)
#   - DER JVM pid in $DER_PID (optional; auto-detected via pgrep if blank)
set -Euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DER_BASE_URL="${DER_BASE_URL:-http://localhost:8080}"
DER_ADMIN_COOKIE="${DER_ADMIN_COOKIE:-}"
DER_DATA_DIR="${DER_DATA_DIR:-}"
DER_PID="${DER_PID:-}"
DER_BENCH_DURATION="${DER_BENCH_DURATION:-15}"
DER_RESOURCE_DURATION="${DER_RESOURCE_DURATION:-60}"
DER_RESOURCE_INTERVAL="${DER_RESOURCE_INTERVAL:-5}"
DER_SEED="${DER_SEED:-20261022}"
DER_INSECURE="${DER_INSECURE:-}"

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT}"
OUT_DIR="docs/evaluation/evidence/${DER_EVIDENCE_PHASE:-phase-07}/${RUN_ID}"
mkdir -p "${OUT_DIR}"
LOG="${OUT_DIR}/run.log"

exec > >(tee -a "${LOG}") 2>&1

echo "============================================================"
echo "DER Phase 08 NFR evaluation"
echo "run id        : ${RUN_ID}"
echo "DER base URL  : ${DER_BASE_URL}"
echo "data dir      : ${DER_DATA_DIR:-<not set>}"
echo "started at    : ${STARTED_AT}"
echo "============================================================"

if [[ -z "${DER_ADMIN_COOKIE}" ]]; then
  echo "ERROR: DER_ADMIN_COOKIE is not set (export it after signing in)."
  exit 2
fi

if [[ -z "${DER_PID}" ]]; then
  DER_PID="$(pgrep -f 'der-server' | head -n1 || true)"
fi

INSECURE_FLAG=""
[[ -n "${DER_INSECURE}" ]] && INSECURE_FLAG="--insecure"

# --- bench the health probe (unauthenticated) ---
python3 scripts/evaluation/der_bench.py \
  --base-url "${DER_BASE_URL}" \
  --path /edge-api/v1/system/health \
  --duration-seconds "${DER_BENCH_DURATION}" \
  ${INSECURE_FLAG} \
  > "${OUT_DIR}/bench-health.json"

# --- bench an authenticated metadata read (DHIS2 API parity) ---
python3 scripts/evaluation/der_bench.py \
  --base-url "${DER_BASE_URL}" \
  --path '/api/dataSets?fields=id,displayName&paging=false' \
  --duration-seconds "${DER_BENCH_DURATION}" \
  --cookie "${DER_ADMIN_COOKIE}" \
  ${INSECURE_FLAG} \
  > "${OUT_DIR}/bench-metadata.json"

# --- resource sample runs in the background during the backup/restore ---
python3 scripts/evaluation/resource_sampler.py \
  --pid "${DER_PID:-0}" \
  --data-dir "${DER_DATA_DIR}" \
  --duration-seconds "${DER_RESOURCE_DURATION}" \
  --interval-seconds "${DER_RESOURCE_INTERVAL}" \
  > "${OUT_DIR}/resource-sample.json" &
SAMPLER_PID=$!

# --- backup/restore round-trip ---
set +e
python3 scripts/evaluation/backup_integrity.py \
  --base-url "${DER_BASE_URL}" \
  --cookie "${DER_ADMIN_COOKIE}" \
  ${INSECURE_FLAG} \
  --kind FULL \
  > "${OUT_DIR}/backup-integrity.json"
BACKUP_RC=$?
set -e

# --- backlog recovery at 100 and 1000 (NFR-17 fixtures) ---
if [[ -f "scripts/evaluation/fixtures/aggregate-dataValueSet.json" ]]; then
  for N in 100 1000; do
    set +e
    python3 scripts/evaluation/backlog_recovery.py \
      --base-url "${DER_BASE_URL}" \
      --cookie "${DER_ADMIN_COOKIE}" \
      --count "${N}" \
      --payload-file scripts/evaluation/fixtures/aggregate-dataValueSet.json \
      ${INSECURE_FLAG} \
      > "${OUT_DIR}/backlog-${N}.json"
    echo "backlog-${N} rc=$?"
    set -e
  done
else
  echo "WARN: scripts/evaluation/fixtures/aggregate-dataValueSet.json missing; skipping backlog recovery."
fi

wait "${SAMPLER_PID}" || true

FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "${OUT_DIR}/manifest.json" <<EOF
{
  "runId": "${RUN_ID}",
  "commit": "${COMMIT}",
  "derVersion": "$(cat VERSION | tr -d '[:space:]')",
  "startedAt": "${STARTED_AT}",
  "finishedAt": "${FINISHED_AT}",
  "seed": ${DER_SEED},
  "derBaseUrl": "${DER_BASE_URL}",
  "dataDir": "${DER_DATA_DIR}",
  "jvmPid": ${DER_PID:-0},
  "benchDurationSeconds": ${DER_BENCH_DURATION},
  "resourceDurationSeconds": ${DER_RESOURCE_DURATION},
  "resourceIntervalSeconds": ${DER_RESOURCE_INTERVAL},
  "backupIntegrityExit": ${BACKUP_RC},
  "artifacts": [
    "bench-health.json",
    "bench-metadata.json",
    "resource-sample.json",
    "backup-integrity.json",
    "backlog-100.json",
    "backlog-1000.json"
  ]
}
EOF

echo
echo "evidence bundle: ${OUT_DIR}"
echo "manifest       : ${OUT_DIR}/manifest.json"
exit "${BACKUP_RC}"
