# phase unknown gate report

- **Run id:** `20261121T124304Z-d86c52eb`
- **Commit:** `d86c52eb`
- **Started:** 2026-11-21T12:43:04Z
- **Finished:** 2026-11-21T12:59:45Z
- **Pinned DHIS2 reference:** `2.44-SNAPSHOT}`
- **Evidence source:** local only; no CI claim per repository decision
- **Approver:** socaya &lt;socaya@stephocay.com&gt; — signed 2026-11-21 **with override note**
- **Sign-off scope:** gate decision BLOCKED is being **overridden** after confirming the single failing test is the same pre-existing pg_restore timing-sensitive flake family (`RestoreWorker` pg_restore timed out after 60 s under full-gate CPU load). 26/33 steps PASS, 1 FAIL, 6 opt-in NOT RUN. Fourth gate run in this session showing this identical flake family (prior: `BackupWorkerTest.successPathCallsPgDumpAndMarksSuccess`, `RestoreWorkerTest.failedExitMarksFailedWithExitInfo`, `BackupEncryptionTest.encryptAndDecryptRoundTripWithFakeOpenssl`). Deflake treatment already applied to `BackupWorkerTest` in commit `90dabdb5`; the remaining cases are tracked as a bundled deferred follow-up. This commit only touches admin-ui/src/screens/{Metadata,UsersDashboard,SignIn,metadata/SnapshotList}.tsx + shared.tsx + styles.css + Metadata.test.tsx — no Java, no Maven config, no openssl/pg code.
- **Sign-off narrative:** Phase-4B continuation covering three more screens + login polish. **`/dhis2/metadata`**: Panel gained a title with the match count; filter inputs wrapped in `.ea-data-filterbar` + `.ea-input--compact` for single-row layout; table uses `.ea-table--nowrap`; "Mirror" column renamed to "Status" with user-facing "Local" tag; empty copy "No metadata mirrored for this resource" → "No metadata available locally for this resource". **`/provisioning/users`**: search wrapped in `.ea-data-filterbar`; table switched to `.ea-table--nowrap`; "Central permissions verified" column header → "Verified"; "Last login" moved right. **`/metadata/snapshots`**: full compact-table rebuild — page title "Snapshots" → "Metadata snapshots", status filter select added, table switched to `.ea-table--nowrap`, stacked sub-lines collapsed with tooltips, inline Retire/Reinstate buttons folded into a per-row `RowMenu`, pagination added via `usePaged(25)` + `TablePager`. `RowMenuItem` gained an optional `dataTest` prop so existing per-item test contracts keep working after being folded into the menu. **Login polish**: brand image swapped from the 56×56 icon-only mark to the full 72-px lockup (`/admin/assets/der-logo.svg`) with graceful fallback; sign-in card glass lightened from `rgba(1,1,1,0.42)` + 18 px blur to `rgba(1,1,1,0.28)` + 6 px blur so the uploaded background is clearly visible through the card instead of being blurred into a wash. Follow-on: `.ea-main-inner` padding removed per direct ask (commented out); `.ea-main` given 10 px padding per subsequent ask so the content area still has a consistent gutter. `Metadata.test.tsx` updated for the new empty-state + match-count copy. **1749/1749 admin-ui unit tests PASS.**

## Decision: **BLOCKED**

- Steps run:       33
- Pass:            26
- Fail:            1
- Not run:         6 (opt-in network/E2E steps)

## Step results

| Step | Status | Duration | Log |
|---|---|---|---|
| version-consistency | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/version-consistency.log |
| version-consistency-tests | PASS | 1s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/version-consistency-tests.log |
| registers-live | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/registers-live.log |
| registers-tests | PASS | 1s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/registers-tests.log |
| structure | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/structure.log |
| server-verify | FAIL | 808s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/server-verify.log |
| server-separation-lint | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/server-separation-lint.log |
| deploy-lifecycle-smoke | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/deploy-lifecycle-smoke.log |
| backup-integrity-comparator | PASS | 1s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/backup-integrity-comparator.log |
| resource-sampler-tests | PASS | 2s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/resource-sampler-tests.log |
| resource-budget-comparator | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/resource-budget-comparator.log |
| der-bench-tests | PASS | 6s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/der-bench-tests.log |
| bench-budget-comparator | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/bench-budget-comparator.log |
| experiment-export-tests | PASS | 1s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/experiment-export-tests.log |
| workflow-catalogue-tests | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/workflow-catalogue-tests.log |
| workflow-catalogue-live | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/workflow-catalogue-live.log |
| nfr-sweep-synthetic-e2e | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/nfr-sweep-synthetic-e2e.log |
| dhis2-live-probe | NOT RUN | 0s | (not run: DER_DHIS2_CENTRAL_URL not set) |
| chaos-journal-recovery | NOT RUN | 0s | (not run: DER_RUN_CHAOS not set to true (needs live PG + jar)) |
| chaos-pull-write-interlock | NOT RUN | 0s | (not run: DER_RUN_CHAOS not set to true (needs live PG)) |
| server-dependency-check | NOT RUN | 0s | (not run: DER_RUN_DEPENDENCY_CHECK not set to true (network scan)) |
| admin-ui-typecheck | PASS | 8s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-typecheck.log |
| admin-ui-lint | PASS | 4s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-lint.log |
| admin-ui-build | PASS | 9s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-build.log |
| admin-ui-coverage | PASS | 17s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-coverage.log |
| admin-ui-cross-module-lint | PASS | 2s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-cross-module-lint.log |
| admin-ui-cross-module-targets-lint | PASS | 0s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/admin-ui-cross-module-targets-lint.log |
| admin-ui-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set (dev-time). Set 'true' to run, 'mandatory' to fail if browsers absent.) |
| client-typecheck | PASS | 2s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/client-typecheck.log |
| client-lint | PASS | 3s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/client-lint.log |
| client-build | PASS | 4s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/client-build.log |
| client-coverage | PASS | 9s | docs/evaluation/evidence/phase-unknown/d86c52eb/logs/client-coverage.log |
| client-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set (dev-time). Set 'true' to run, 'mandatory' to fail if browsers absent.) |

## Phase 00 scope confirmation

- Deliverables: version governance, FR/NFR/screen register validation, server + both frontend quality gates, local-evidence bundle, honest documentation.
- Explicit non-goals (do NOT claim complete): DHIS2 integration, authentication, journal, synchronisation, UI screens beyond test harness, measured NFRs.

## Environment

```
run-id:    20261121T124304Z-d86c52eb
commit:    d86c52eb
started:   2026-11-21T12:43:04Z
host:      Darwin Stephens-MacBook-Pro.local 25.2.0 arm64
cwd:       /Users/stephocay/projects/msdcse-project/der

java:
  openjdk version "21.0.10" 2026-01-20
  OpenJDK Runtime Environment Homebrew (build 21.0.10)
  OpenJDK 64-Bit Server VM Homebrew (build 21.0.10, mixed mode, sharing)

maven:
  Apache Maven 3.9.9 (8e8579a9e76f7d015ee5ec7bfcdc97d260186937)
  Maven home: /Users/stephocay/.m2/wrapper/dists/apache-maven-3.9.9/3477a4f1
  Java version: 21.0.10, vendor: Homebrew, runtime: /opt/homebrew/Cellar/openjdk@21/21.0.10/libexec/openjdk.jdk/Contents/Home
  Default locale: en_US, platform encoding: UTF-8
  OS name: "mac os x", version: "26.2", arch: "aarch64", family: "mac"

node:   v20.19.6
npm:    10.8.2
python: Python 3.11.9
docker: not available
```
