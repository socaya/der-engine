# Verification strategy and controlled experiment plan

> **Project baseline:** Design and Implementation of a Conflict-Aware Edge Synchronisation Runtime for Offline-First Distributed DHIS2 Workflows. **DER target:** DHIS2 2.43+, initially pin one tested 2.43.x patch. **Status:** Design specification; neither DHIS2 integration nor passing tests is asserted. **Audience:** Student developer, supervisor, reviewers and future maintainers.

## Test hierarchy
Unit tests: state transitions, policy rules, version parsing, validation; integration: database transactions, migrations, DHIS2 API behaviours; end-to-end: two real/simulated LAN clients; fault: WAN isolation, lost response, worker crash, database restart; security: access and token misuse; compatibility: DHIS2 patch pin; performance: defined workloads, p50/p95 request latency, throughput, resource usage; accessibility: keyboard/focus/labels and responsive widths.

## 20 test suites
| ID | Test suite | Required evidence |
|---|---|---|
| T01 | Edge install/provisioning | Idempotent setup and registration |
| T02 | Offline login | Auth without central reachability |
| T03 | Authorisation | Wrong OU, role and direct API denied |
| T04 | Metadata | Required dependencies and rule behaviour |
| T05 | Aggregate | Complete selected aggregate workflow offline |
| T06 | Event | Create/edit/retrieve offline |
| T07 | Tracker | Dependent two-user pathway offline |
| T08 | Shared visibility | Other session sees committed record |
| T09 | Durability and atomic journal | Restart retains record and sync intent |
| T10 | Local concurrency | Stale write is detected, no lost update |
| T11 | Divergent central/edge | Conflict correctly classified |
| T12 | Duplicate replay | No unintended duplicate central effect |
| T13 | Lost acknowledgement | Remote effect inspected, no false success |
| T14 | Metadata drift | Affected pending operations quarantined/revalidated |
| T15 | WAN partition | Supported local workflow remains usable |
| T16 | Reconnection | Queue resumes; local operations uninterrupted |
| T17 | Worker restart | Durable state and retry recovered |
| T18 | Backup/restore | Recovery verified with consistent state |
| T19 | Performance | p95, throughput, CPU/RAM, queue lag with workload |
| T20 | Behavioural parity | Matched tests against pinned central DHIS2 |

## Experiment procedure
Provision two identical scenario fixtures using synthetic data and same metadata; document release/hardware/network configuration; snapshot pristine state; run connected baseline -> isolated WAN -> WAN restored; inject competing writes and lost replies; repeat trials (predeclare sample size), capture raw logs and timings; verify DB effects; report pass/fail/conflicts/unknown and descriptive statistics. Distinguish local-commit latency from central-reconciliation latency. Never label a simulation as a live API test.

## Quality gates
Every applicable mandatory scenario passes; no outstanding data-integrity/security-critical defects; test failures included in report; target availability and numeric NFR thresholds approved **before** observing results; no claim of 100% correctness based only on code coverage.
