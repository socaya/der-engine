# phase 03 gate report

- **Run id:** `20261022T061515Z-0a9091a`
- **Commit:** `0a9091a`
- **Started:** 2026-10-22T06:15:15Z
- **Finished:** 2026-10-22T06:15:49Z
- **Pinned DHIS2 reference:** `2.44-SNAPSHOT}`
- **Evidence source:** local only; no CI claim per repository decision
- **Approver:** _unsigned — reviewer must counter-sign before the next phase starts_

## Decision: **PASS**

- Steps run:       18
- Pass:            15
- Fail:            0
- Not run:         3 (opt-in network/E2E steps)

## Step results

| Step | Status | Duration | Log |
|---|---|---|---|
| version-consistency | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/version-consistency.log |
| version-consistency-tests | PASS | 0s | docs/evaluation/evidence/phase-03/0a9091a/logs/version-consistency-tests.log |
| registers-live | PASS | 0s | docs/evaluation/evidence/phase-03/0a9091a/logs/registers-live.log |
| registers-tests | PASS | 4s | docs/evaluation/evidence/phase-03/0a9091a/logs/registers-tests.log |
| structure | PASS | 0s | docs/evaluation/evidence/phase-03/0a9091a/logs/structure.log |
| server-verify | PASS | 14s | docs/evaluation/evidence/phase-03/0a9091a/logs/server-verify.log |
| dhis2-live-probe | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/dhis2-live-probe.log |
| server-dependency-check | NOT RUN | 0s | (not run: DER_RUN_DEPENDENCY_CHECK not set to true (network scan)) |
| admin-ui-typecheck | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/admin-ui-typecheck.log |
| admin-ui-lint | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/admin-ui-lint.log |
| admin-ui-build | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/admin-ui-build.log |
| admin-ui-coverage | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/admin-ui-coverage.log |
| admin-ui-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set to true (requires 'npm run test:e2e:install')) |
| client-typecheck | PASS | 2s | docs/evaluation/evidence/phase-03/0a9091a/logs/client-typecheck.log |
| client-lint | PASS | 1s | docs/evaluation/evidence/phase-03/0a9091a/logs/client-lint.log |
| client-build | PASS | 3s | docs/evaluation/evidence/phase-03/0a9091a/logs/client-build.log |
| client-coverage | PASS | 3s | docs/evaluation/evidence/phase-03/0a9091a/logs/client-coverage.log |
| client-e2e | NOT RUN | 0s | (not run: DER_RUN_E2E not set to true (requires 'npm run test:e2e:install')) |

## Phase 00 scope confirmation

- Deliverables: version governance, FR/NFR/screen register validation, server + both frontend quality gates, local-evidence bundle, honest documentation.
- Explicit non-goals (do NOT claim complete): DHIS2 integration, authentication, journal, synchronisation, UI screens beyond test harness, measured NFRs.

## Environment

```
run-id:    20261022T061515Z-0a9091a
commit:    0a9091a
started:   2026-10-22T06:15:15Z
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
