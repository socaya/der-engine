# phase unknown gate report

- **Run id:** `20261121T092611Z-26b448fc`
- **Commit:** `26b448fc`
- **Started:** 2026-11-21T09:26:11Z
- **Finished:** 2026-11-21T09:28:14Z
- **Pinned DHIS2 reference:** `2.44-SNAPSHOT}`
- **Evidence source:** local only; no CI claim per repository decision
- **Approver:** socaya &lt;socaya@stephocay.com&gt; — signed 2026-11-21
- **Sign-off scope:** gate decision PASS accepted; 27/33 steps PASS, 0 FAIL, 6 opt-in NOT RUN (dhis2-live-probe, chaos-journal-recovery, chaos-pull-write-interlock, server-dependency-check, admin-ui-e2e, client-e2e) — deferred to the pilot evidence run per the opt-in flag convention.
- **Sign-off narrative:** Compact single-line data tables across `/data/aggregate`, `/data/events`, `/data/tracker` per the "clean single line rows" ask. Workflow + Org unit columns removed from all three tables (workflow provenance moved into the per-row Lineage drawer — the canonical "all details of this row" surface). New primary-identifier-first column order: Dataset → Data element (Aggregate); Program → Stage (Events); Kind → Row → TEI → Program (Tracker). The "updated / occurred / last check" timestamp moved to the right as a secondary hint. Row click now opens the Lineage drawer; the trailing `Lineage` button column was removed since the whole row is the trigger. New CSS: `.ea-table--nowrap` clamps every cell with `white-space:nowrap + text-overflow:ellipsis + max-width:0`; `.ea-data-filterbar` is a single-row `flex-wrap:nowrap` container with horizontal overflow so filters never wrap onto a second visual line; `.ea-input--compact` keeps pickers + selects at 28 px / 160 px; `.ea-panel` + `.ea-panel-head` margins tightened (20/14 → 12/8) so the gap between SyncStatusBar / Panel title / filter bar / table is noticeably tighter. `.ea-screen` padding fully removed so the content gutter comes from `.ea-main-inner` (10 px) only — applied once, not twice. Test IDs preserved: `data-{area}-row-*`, `data-{area}-chip-*`, `data-{area}-search`, `data-{area}-limit`, `data-{area}-table`, `data-{area}-{pull,preview}-open`. Dropped: `data-{area}-lineage-*` (column removed) and `data-{area}-workflow` (filter removed). Unit tests updated accordingly; **1749/1749 admin-ui unit tests PASS** (one net removal from the Lineage-button test consolidation). Live browser smoke confirms all three screens render the new column set with single-line rows and the filter bar on a single row.

## Decision: **PASS**

- Steps run:       33
- Pass:            27
- Fail:            0
- Not run:         6 (opt-in network/E2E steps)

## Step results

| Step | Status | Duration | Log |
|---|---|---|---|
| version-consistency | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/version-consistency.log |
| version-consistency-tests | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/version-consistency-tests.log |
| registers-live | PASS | 1s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/registers-live.log |
| registers-tests | PASS | 1s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/registers-tests.log |
| structure | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/structure.log |
| server-verify | PASS | 39s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/server-verify.log |
| server-separation-lint | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/server-separation-lint.log |
| deploy-lifecycle-smoke | PASS | 1s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/deploy-lifecycle-smoke.log |
| backup-integrity-comparator | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/backup-integrity-comparator.log |
| resource-sampler-tests | PASS | 2s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/resource-sampler-tests.log |
| resource-budget-comparator | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/resource-budget-comparator.log |
| der-bench-tests | PASS | 6s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/der-bench-tests.log |
| bench-budget-comparator | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/bench-budget-comparator.log |
| experiment-export-tests | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/experiment-export-tests.log |
| workflow-catalogue-tests | PASS | 1s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/workflow-catalogue-tests.log |
| workflow-catalogue-live | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/workflow-catalogue-live.log |
| nfr-sweep-synthetic-e2e | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/nfr-sweep-synthetic-e2e.log |
| dhis2-live-probe | NOT RUN | 0s | (not run: DER_DHIS2_CENTRAL_URL not set) |
| chaos-journal-recovery | NOT RUN | 0s | (not run: DER_RUN_CHAOS not set to true (needs live PG + jar)) |
| chaos-pull-write-interlock | NOT RUN | 0s | (not run: DER_RUN_CHAOS not set to true (needs live PG)) |
| server-dependency-check | NOT RUN | 0s | (not run: DER_RUN_DEPENDENCY_CHECK not set to true (network scan)) |
| admin-ui-typecheck | PASS | 7s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-typecheck.log |
| admin-ui-lint | PASS | 4s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-lint.log |
| admin-ui-build | PASS | 8s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-build.log |
| admin-ui-coverage | PASS | 20s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-coverage.log |
| admin-ui-cross-module-lint | PASS | 2s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-cross-module-lint.log |
| admin-ui-cross-module-targets-lint | PASS | 0s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/admin-ui-cross-module-targets-lint.log |
| admin-ui-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set (dev-time). Set 'true' to run, 'mandatory' to fail if browsers absent.) |
| client-typecheck | PASS | 7s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/client-typecheck.log |
| client-lint | PASS | 3s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/client-lint.log |
| client-build | PASS | 5s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/client-build.log |
| client-coverage | PASS | 15s | docs/evaluation/evidence/phase-unknown/26b448fc/logs/client-coverage.log |
| client-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set (dev-time). Set 'true' to run, 'mandatory' to fail if browsers absent.) |

## Phase 00 scope confirmation

- Deliverables: version governance, FR/NFR/screen register validation, server + both frontend quality gates, local-evidence bundle, honest documentation.
- Explicit non-goals (do NOT claim complete): DHIS2 integration, authentication, journal, synchronisation, UI screens beyond test harness, measured NFRs.

## Environment

```
run-id:    20261121T092611Z-26b448fc
commit:    26b448fc
started:   2026-11-21T09:26:11Z
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
