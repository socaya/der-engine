#!/usr/bin/env bash
# scripts/run_all_checks.sh — Phase 00 local-evidence runner.
#
# This script produces the authoritative evidence bundle for the Phase 00 gate,
# because the user chose "Local evidence only" over a CI provider. Per
# DER-ENG-001 §5.2 we must NOT claim "CI passed" in this mode; the gate report
# produced here is signed as "local-evidence-only".
#
# Exit code 0 => every check passed, gate decision = PASS.
# Exit code 1 => at least one check failed OR was NOT RUN unexpectedly.
#
# Playwright and OWASP dependency-check are opt-in (require network / browser
# downloads). When they are not available they are reported as NOT RUN rather
# than as PASS.
set -Euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-${COMMIT}"

# Phase label is derived from the current VERSION. 0.1.x -> phase-00, 0.2.x -> phase-01, etc.
# Documented deviation OK as long as this stays in sync with docs/releases/.
VERSION_FILE="$(cat VERSION | tr -d '[:space:]')"
case "$VERSION_FILE" in
  0.1.*) PHASE="phase-00" ;;
  0.2.*) PHASE="phase-01" ;;
  0.3.*) PHASE="phase-02" ;;
  0.4.*) PHASE="phase-03" ;;
  0.5.*) PHASE="phase-04" ;;
  0.6.*) PHASE="phase-05" ;;
  0.7.*) PHASE="phase-06" ;;
  0.8.*) PHASE="phase-07" ;;
  0.9.*) PHASE="phase-08" ;;
  1.*)   PHASE="phase-09" ;;
  *)     PHASE="phase-unknown" ;;
esac
OUT_DIR="docs/evaluation/evidence/${PHASE}/${COMMIT}"
LOG_DIR="${OUT_DIR}/logs"
TEST_DIR="${OUT_DIR}/test-results"
COV_DIR="${OUT_DIR}/coverage"
mkdir -p "${LOG_DIR}" "${TEST_DIR}" "${COV_DIR}" "${COV_DIR}/server" "${COV_DIR}/admin-ui" "${COV_DIR}/client"

GATE="${OUT_DIR}/gate-report.md"

# ----- step runner ---------------------------------------------------------
declare -a STEP_NAMES=()
declare -a STEP_STATUS=()
declare -a STEP_LOGS=()
declare -a STEP_DURATIONS=()

run_step() {
  local name="$1"; shift
  local logfile="${LOG_DIR}/$(echo "$name" | tr '/ ' '__').log"
  local start end dur rc=0

  start=$(date -u +%s)
  echo "============================================================"
  echo "STEP: $name"
  echo "LOG : $logfile"
  echo "RUN : $*"
  echo "============================================================"
  if "$@" >"$logfile" 2>&1; then
    rc=0
  else
    rc=$?
  fi
  end=$(date -u +%s)
  dur=$((end - start))

  STEP_NAMES+=("$name")
  STEP_DURATIONS+=("${dur}s")
  STEP_LOGS+=("$(realpath --relative-to="$ROOT" "$logfile" 2>/dev/null || echo "$logfile")")
  if [[ $rc -eq 0 ]]; then
    STEP_STATUS+=("PASS")
    echo "  -> PASS (${dur}s)"
  else
    STEP_STATUS+=("FAIL")
    echo "  -> FAIL (${dur}s, rc=${rc}) — see ${logfile}"
  fi
}

skip_step() {
  local name="$1" reason="$2"
  STEP_NAMES+=("$name")
  STEP_STATUS+=("NOT RUN")
  STEP_DURATIONS+=("0s")
  STEP_LOGS+=("(not run: ${reason})")
  echo "============================================================"
  echo "STEP: $name"
  echo "  -> NOT RUN (${reason})"
  echo "============================================================"
}

# ----- environment report --------------------------------------------------
ENV_LOG="${LOG_DIR}/environment.log"
{
  echo "run-id:    ${RUN_ID}"
  echo "commit:    ${COMMIT}"
  echo "started:   ${STARTED_AT}"
  echo "host:      $(uname -mnrs)"
  echo "cwd:       ${ROOT}"
  echo
  echo "java:"
  java -version 2>&1 | sed 's/^/  /'
  echo
  echo "maven:"
  (cd server && ./mvnw -version 2>&1 | sed 's/^/  /')
  echo
  echo "node:   $(node --version)"
  echo "npm:    $(npm --version)"
  echo "python: $(python3 --version)"
  echo "docker: $(command -v docker >/dev/null && docker --version || echo 'not available')"
} > "$ENV_LOG"
cat "$ENV_LOG"
echo

# ----- scripts: version + registers + structure ----------------------------
run_step "version-consistency"              python3 scripts/check_version_consistency.py
run_step "version-consistency-tests"        python3 scripts/test_check_version_consistency.py
run_step "registers-live"                   python3 scripts/check_registers.py
run_step "registers-tests"                  python3 scripts/test_check_registers.py
run_step "structure"                        python3 scripts/check_structure.py

# ----- server --------------------------------------------------------------
run_step "server-verify" bash -c "cd server && ./mvnw -q -Dder.dependency-check.skip=true verify"

# Collect server coverage report into the evidence bundle.
if [[ -d server/target/site/jacoco ]]; then
  cp -R server/target/site/jacoco "${COV_DIR}/server/jacoco"
fi
if [[ -f server/target/jacoco.exec ]]; then
  cp server/target/jacoco.exec "${COV_DIR}/server/jacoco.exec"
fi
if [[ -d server/target/surefire-reports ]]; then
  cp -R server/target/surefire-reports "${TEST_DIR}/server-surefire"
fi

# Phase 01+ live DHIS2 compatibility probe.
if [[ -n "${DER_DHIS2_CENTRAL_URL:-}" ]]; then
  run_step "dhis2-live-probe" python3 scripts/verify_dhis2_reference.py
else
  skip_step "dhis2-live-probe" "DER_DHIS2_CENTRAL_URL not set"
fi

# Optional: OWASP dependency-check — opt-in because it needs network for NVD data.
if [[ "${DER_RUN_DEPENDENCY_CHECK:-false}" == "true" ]]; then
  run_step "server-dependency-check" bash -c "cd server && ./mvnw -q org.owasp:dependency-check-maven:check"
  [[ -f server/target/dependency-check-report.html ]] && cp server/target/dependency-check-report.html "${OUT_DIR}/"
  [[ -f server/target/dependency-check-report.json ]] && cp server/target/dependency-check-report.json "${OUT_DIR}/"
else
  skip_step "server-dependency-check" "DER_RUN_DEPENDENCY_CHECK not set to true (network scan)"
fi

# ----- frontends -----------------------------------------------------------
for app in admin-ui client; do
  if [[ ! -d "${app}/node_modules" ]]; then
    skip_step "${app}-tests" "node_modules missing — run 'cd ${app} && npm install' first"
    continue
  fi

  run_step "${app}-typecheck" bash -c "cd ${app} && npm run --silent typecheck"
  run_step "${app}-lint"      bash -c "cd ${app} && npm run --silent lint"
  run_step "${app}-build"     bash -c "cd ${app} && npm run --silent build"
  run_step "${app}-coverage"  bash -c "cd ${app} && npm run --silent test:coverage"

  [[ -d "${app}/coverage" ]] && cp -R "${app}/coverage" "${COV_DIR}/${app}/vitest"

  # Playwright. der-1.1.0-alpha.4: three modes via DER_RUN_E2E:
  #   true      — run it; graceful NOT RUN if browsers missing
  #   mandatory — pilot-cut mode; browsers missing becomes FAIL
  #   anything else (default) — skip + record NOT RUN
  case "${DER_RUN_E2E:-false}" in
    true)
      run_step "${app}-e2e" bash -c "cd ${app} && npm run --silent test:e2e"
      [[ -d "${app}/playwright-report" ]] && cp -R "${app}/playwright-report" "${TEST_DIR}/${app}-playwright"
      ;;
    mandatory)
      if ! bash -c "cd ${app} && npx playwright --version" >/dev/null 2>&1; then
        run_step "${app}-e2e" bash -c "echo 'Playwright CLI not available; mandatory mode requires npm run test:e2e:install'; exit 1"
      else
        run_step "${app}-e2e" bash -c "cd ${app} && npm run --silent test:e2e"
        [[ -d "${app}/playwright-report" ]] && cp -R "${app}/playwright-report" "${TEST_DIR}/${app}-playwright"
      fi
      ;;
    *)
      skip_step "${app}-e2e" "DER_RUN_E2E not set (dev-time). Set 'true' to run, 'mandatory' to fail if browsers absent."
      ;;
  esac
done

# ----- gate decision -------------------------------------------------------
FAIL_COUNT=0
NOT_RUN_COUNT=0
for s in "${STEP_STATUS[@]}"; do
  [[ "$s" == "FAIL" ]] && FAIL_COUNT=$((FAIL_COUNT+1))
  [[ "$s" == "NOT RUN" ]] && NOT_RUN_COUNT=$((NOT_RUN_COUNT+1))
done

# A Phase 00 gate PASS requires:
#   * zero FAIL steps
#   * all mandatory steps PASS (NOT RUN permitted only for opt-in network/E2E)
FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ $FAIL_COUNT -eq 0 ]]; then
  DECISION="PASS"
else
  DECISION="BLOCKED"
fi

{
  echo "# ${PHASE/-/ } gate report"
  echo
  echo "- **Run id:** \`${RUN_ID}\`"
  echo "- **Commit:** \`${COMMIT}\`"
  echo "- **Started:** ${STARTED_AT}"
  echo "- **Finished:** ${FINISHED_AT}"
  echo "- **Pinned DHIS2 reference:** \`$(grep -o 'pinned-version:.*' server/src/main/resources/application.yml | head -1 | sed 's/.*: *//')\`"
  echo "- **Evidence source:** local only; no CI claim per repository decision"
  echo "- **Approver:** _unsigned — reviewer must counter-sign before the next phase starts_"
  echo
  echo "## Decision: **${DECISION}**"
  echo
  echo "- Steps run:       ${#STEP_NAMES[@]}"
  echo "- Pass:            $(( ${#STEP_NAMES[@]} - FAIL_COUNT - NOT_RUN_COUNT ))"
  echo "- Fail:            ${FAIL_COUNT}"
  echo "- Not run:         ${NOT_RUN_COUNT} (opt-in network/E2E steps)"
  echo
  echo "## Step results"
  echo
  echo "| Step | Status | Duration | Log |"
  echo "|---|---|---|---|"
  for i in "${!STEP_NAMES[@]}"; do
    echo "| ${STEP_NAMES[$i]} | ${STEP_STATUS[$i]} | ${STEP_DURATIONS[$i]} | ${STEP_LOGS[$i]} |"
  done
  echo
  echo "## Phase 00 scope confirmation"
  echo
  echo "- Deliverables: version governance, FR/NFR/screen register validation, server + both frontend quality gates, local-evidence bundle, honest documentation."
  echo "- Explicit non-goals (do NOT claim complete): DHIS2 integration, authentication, journal, synchronisation, UI screens beyond test harness, measured NFRs."
  echo
  echo "## Environment"
  echo
  echo '```'
  cat "$ENV_LOG"
  echo '```'
} > "$GATE"

echo
echo "============================================================"
echo "Gate report: $GATE"
echo "Decision   : ${DECISION}"
echo "Steps      : ${#STEP_NAMES[@]} (fail=${FAIL_COUNT}, not run=${NOT_RUN_COUNT})"
echo "============================================================"

[[ "$DECISION" == "PASS" ]] && exit 0 || exit 1
