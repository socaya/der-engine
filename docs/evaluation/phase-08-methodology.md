# Phase 08 — NFR evaluation methodology

This document is the operator-facing runbook for the measurement NFRs
in `docs/requirements/source-nonfunctional-register.csv`. The harness
itself lives at `scripts/evaluation/`; this file explains how to run it
and how to interpret the artifacts.

Each run writes an evidence bundle to
`docs/evaluation/evidence/phase-07/<utc-timestamp>-<commit>/` so the
Phase 08 release ships baseline numbers from the dev laptop and the
Phase 09 pilot bundle overlays the same shape measured on real
hardware. The bundle is referenced from the traceability matrix as the
evidence pointer for NFR-15..NFR-19, NFR-27, NFR-29, NFR-35.

## 1. Prerequisites

- DER running locally (`./server/mvnw spring-boot:run` or an installed
  tarball) at `$DER_BASE_URL` (default `http://localhost:8080`).
- A paired DHIS2 central reachable from the device, pinned to the
  version recorded in `README.md`.
- An admin user has been signed in and the session cookie exported as
  `DER_ADMIN_COOKIE` (e.g. `DER_ADMIN_COOKIE="SESSION=…"`).
- Optional: Postgres data directory exported as `DER_DATA_DIR` so the
  resource sampler captures disk growth.

## 2. Running the harness

```bash
export DER_ADMIN_COOKIE="SESSION=<token>"
export DER_DATA_DIR="/var/lib/postgresql/17/main"   # optional
bash scripts/evaluation/run_phase_08.sh
```

The runner writes a `manifest.json` plus per-NFR artifacts under
`docs/evaluation/evidence/phase-07/<run>/`. Exit code 0 means every
step succeeded; non-zero means the integrity check or a backlog
fixture failed and the operator must triage before shipping the
release.

## 3. Interpretation

### NFR-15 Performance latency (P1)

Each `bench-*.json` file reports p50 / p95 / p99 at concurrencies
1, 5, 10, 20. The register says: *"candidate p95 under 2 s for selected
simple requests, pending feasibility."* The pilot report publishes the
measured p95 alongside the target; a p95 above 2 s is a signal to
revisit DER's query plans before Phase 09 acceptance.

### NFR-16 Throughput (P1)

The `throughput_rps` field is the sustained-successful-requests/second
measured over `DER_BENCH_DURATION` seconds (default 15). Publish the
value at concurrency = 20 alongside the hardware fingerprint.

### NFR-17 Backlog recovery (P0)

`backlog-100.json` and `backlog-1000.json` report `drainedSeconds` and
`unresolved`. The register requires: *"time to stable central outcomes
after restoration for backlog sizes 100/1000"* with no unresolved items
once the drain completes. `timedOut: true` is a hard failure.

### NFR-18 Resource budget (P1)

`resource-sample.json.series[].process.rssMb` and `.cpuPct` are the
raw samples. Publish max + 95th-percentile RSS/CPU in the pilot report.
The register requires limits set before acceptance; those limits live
in the pilot hardware doc (Phase 09).

### NFR-19 Scalability (P1)

Each bench file's `levels` list covers 1 / 5 / 10 / 20 concurrent
sessions. The register asks for "saturation and errors"; the saturation
point is the concurrency after which `throughput_rps` stops growing
and errors are the sum of `failed` across levels.

### NFR-27 Test reproducibility (P0)

`manifest.json` records `runId`, `seed`, `commit`, `derVersion`,
`startedAt`, `finishedAt`. The seed is a fixed env var
(`DER_SEED=20261022` by default) so runs are repeatable; override to
re-sample the same configuration.

### NFR-29 Backup integrity (P1)

`backup-integrity.json.match` is the health-counters-before == after
check. A `false` here is a critical regression — restore produced a
different state than snapshotted. Pair with Phase 07's unit tests for
the subprocess paths.

### NFR-35 Deployment transparency (P0)

`manifest.json.derVersion`, `.commit` and `resource-sample.json.hardware`
form the deployment fingerprint. The pilot acceptance evidence bundle
must include this file verbatim.

## 4. Design NFRs (no measurement step)

The register NFRs that do not need live measurement are verified by
existing tests:

| NFR | Attribute | Evidence |
|---|---|---|
| NFR-01 | Availability (WAN partition) | Phase 03.6b journal replay tests + Phase 05 drift suite |
| NFR-02 | Durability | `OperationJournalRepositoryTest` + `JournalWorkerTest` restart cases |
| NFR-03 | Atomicity | `AggregateDataValueServiceTest.rollsBackOnJournalFailure` |
| NFR-04 | Consistency | `ConflictReviewServiceTest.suite()` seeded integrity cases |
| NFR-05 | Authorisation | `AuthControllerTest`, `SecurityConfigTest`, admin-ui `requireAuth.test.tsx` |
| NFR-06 | Confidentiality | `.env.local.example`, `deployment/tls/README.md`, `SecurityAuditRepositoryTest` |
| NFR-07 | Local visibility | `AggregateDataValueService.readByOrgUnitPeriod` + `ActivityControllerTest` |
| NFR-08 | API parity | `Dhis2CompatibilityControllerTest`, `Phase036bRecordsTest` |
| NFR-09 | Validation parity | `AggregateDataValueServiceTest.rejectsInvalidPayload` fixtures |
| NFR-10 | Conflict precision | `ConflictReviewServiceTest.seedCases` |
| NFR-11 | Retry safety | `OperationJournalRepository.insertIfIdempotencyKeyNew` + `JournalWorkerTest.duplicates()` |
| NFR-12 | Accounting | `OperationJournalEntry.State` state-machine tests |
| NFR-13 | Recoverability | `JournalWorkerConfigTest` restart suite |
| NFR-14 | Security freshness | `EdgeSessionRepositoryTest.expiryEnforced` |
| NFR-20 | Observability | `/edge-api/v1/system/health` + `/journal/worker` surface |
| NFR-21 | Auditability | `security_audit` table + `SecurityAuditRepositoryTest` |
| NFR-22 | Interoperability | ADR-0006 + `Dhis2ProfileRegistryTest` |
| NFR-23 | Maintainability | Module boundaries verified by package-level test organisation |
| NFR-24 | Portability | `deployment/dhis2/README.md` + `.env.local.example` runbook |
| NFR-25 | Usability | DC/EA screen tests enforce "Locally committed" / "Pending central" pills |
| NFR-26 | Accessibility | Playwright + axe-core E2E (Phase 06 R3) |
| NFR-28 | Time correctness | `TimePrecisionTest` + `ClockConfig` |
| NFR-30 | Graceful degradation | `AggregateDataValueServiceTest.rejectsOnJournalFailure` |
| NFR-31 | Data minimisation | Phase 00/01 synthetic-data policy in `docs/requirements/README.md` |
| NFR-32 | No central coupling | `AggregateDataValueService` writes to journal, not DHIS2 |
| NFR-33 | Metadata safety | ADR-0006 + `CapabilitySnapshotRepositoryTest` |
| NFR-34 | Failure isolation | `JournalWorker.drainBatch` catches + records; `JournalDrainJobTest` |

The Phase 08 report pins the current commit SHA for each row at
release time so reviewers can diff against future updates.
