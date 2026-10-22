# ADR-0008: Scheduled metadata resync + drift detection via Quartz Postgres JobStore

- Status: **ACCEPTED**
- Date decided: 2026-10-22
- Deciders: socaya
- Related requirements: FR-05-11, FR-11-04, FR-12-05, NFR-27
- Related ADRs: ADR-0004 (hybrid), ADR-0006 (compat engine)

## Decision

DER schedules three durable jobs via Quartz with the Postgres JobStore
(`spring-boot-starter-quartz`):

- **`METADATA_SYNC_FULL`** — invokes `MetadataSyncService.syncAll(null)`,
  then feeds `DriftDetectionService.recordLatestDelta(...)`.
  Default cron: every 4 h.
- **`COMPAT_PROBE_REFRESH`** — invokes
  `Dhis2CompatibilityEngine.refresh(systemUser)`. Default cron: nightly 03:00.
- **`DRIFT_SNAPSHOT`** — stand-alone drift re-run (admin can trigger
  without a full metadata pull). Default cron: 10 min after metadata sync.

All cadences are configurable via `der.sync.*.cron` properties.

Quartz's JobStore schema is auto-initialised by Spring Boot
(`spring.quartz.jdbc.initialize-schema=always`); DER's own sidecar table
`scheduled_job_run` records every start/finish/outcome/duration/detail so
operators have a stable view independent of Quartz version.

Each job is `@DisallowConcurrentExecution` to prevent a long-running sync
from overlapping with the next tick.

Admin REST surface at `/edge-api/v1/sync/jobs` (list + trigger) and
`/edge-api/v1/sync/drift` (latest snapshot + optional refresh).

## Non-goals

- Multi-node coordination (`isClustered=false`); Phase 06+ addresses it.
- Programmatic cadence changes at runtime; a restart is required if the
  cron property changes.
- Audit UI; Phase 06.

## Consequences

- Durable schedule survives restart; stuck jobs are recoverable via
  Quartz's own recovery.
- Observability through SQL on `scheduled_job_run` and `drift_snapshot`.
- Adds the Quartz dependency and schema; the migration is additive-only.
