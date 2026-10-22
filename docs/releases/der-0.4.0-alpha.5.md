# DER 0.4.0-alpha.5 — Phase 05, scheduled sync + drift detection + conflict-review API

> **Project baseline:** DHIS2 Edge Runtime. **Phase scope:** durable Quartz scheduler driving metadata resync + compat probe + drift detection, with admin REST surface for job history, drift inspection, and conflict review/resolve. **ADRs:** 0008 (scheduler + drift), 0009 (conflict-review API). The metadata-sync extension unlocks the full Phase 03.6b E2E (program-stages + TEA + rules mirrored).

**Release label:** `der-0.4.0-alpha.5`
**Git tag:** `der-0.4.0-alpha.5`

## New in this release

| Area | Deliverable |
|---|---|
| ADR | ADR-0008 ACCEPTED (scheduler + drift); ADR-0009 ACCEPTED (conflict-review API). |
| Dep | `spring-boot-starter-quartz` + Quartz Postgres JobStore (auto-initialised). |
| Schema | `V006__phase05_scheduler_drift_conflict.sql` — `scheduled_job_run`, `drift_snapshot`, journal `supersedes`/`resolved_*` columns. |
| Scheduler | `MetadataSyncJob`, `CompatRefreshJob`, `DriftSnapshotJob` — each `@DisallowConcurrentExecution`, writes a `scheduled_job_run` row. Durable triggers in `SchedulerConfig`. |
| Metadata-sync extension | `MetadataSyncService` now pulls COC, program-stages (+PSDE), tracked-entity-attributes, program-rules (+ actions) alongside the Phase 03 five. |
| Drift detection | `DriftDetectionService` + `DriftSnapshotRepository` — compares the top two `metadata_snapshot` rows per entity type and persists added/removed/changed uids with top-level fingerprints. |
| Conflict review | `ConflictReviewService` + repository extensions — list CONFLICT_REVIEW rows, resolve to ACCEPTED/REJECTED with rationale, re-journal clone with `supersedes`. |
| Admin REST | `GET /edge-api/v1/sync/jobs`, `POST /sync/jobs/{name}/trigger`, `GET /sync/drift`, `GET /journal/conflicts`, `POST /journal/conflicts/{id}/resolve`, `POST /journal/conflicts/{id}/re-journal`. |
| Config | `der.sync.{metadata,compat,drift}.cron` + `der.sync.enabled`. |

## Test state

- Server tests: **681 pass**. JaCoCo gate at 94% line / 80% branch (same threshold as alpha.4-fix).
- SpotBugs clean (28 reviewed suppressions).
- Checkstyle clean.
- Flyway V001-V006 applied cleanly.

## Deliberate non-goals

- Payload-hash "changed" diff in drift (reports `added`/`removed`, `changed` list is empty for alpha.5).
- Multi-node Quartz coordination (`isClustered=false`).
- Conflict-resolution UI (Phase 06).
- Journal worker drain to central (Phase 04 / `der-0.5.0-alpha.1`).
- Live-verify of a tracker-program rule firing end-to-end (deferred until Phase 04 drains and the full write path closes).
