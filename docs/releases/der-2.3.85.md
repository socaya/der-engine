# der-2.3.85 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.84`

## Headline

**Every write is now a workflow run.** User captures continue to
flow through operator-authored workflows; passthrough writes (DHIS2
Data Entry web app, referral ingest) auto-wrap in **system
workflow runs** so every row in every data table carries lineage.

## 1. Schema

### V072 — nullable `workflow_run_id` across data tables

Added to `aggregate_data_value`, `event`, `enrollment`,
`tracked_entity_instance`, `operation_journal`, `draft`. Each FK to
`capture_workflow_run(run_id) ON DELETE SET NULL`. Indexes on
`(workflow_run_id, …)` tuned per table.

### V073 — SYSTEM workflow kind + seed rows

```sql
ALTER TABLE capture_workflow
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'USER'
        CHECK (kind IN ('USER', 'SYSTEM'));
```

Deterministic SYSTEM workflow UUIDs seeded:

- `0..01` — **DHIS2 Data Entry capture** (web app passthrough).
- `0..02` — **Referral ingest**.

### V074 — `aggregate_data_value.workflow_run_id` NOT NULL

Backfills untagged rows with a system WEB_APP_CAPTURE run derived
from `(data_set, org_unit, period, submitted_by)`, then enforces
`NOT NULL`. Events / enrolments / TEIs stay nullable until their
services are wired in R-C/2 and R-C/3.

## 2. New service — `SystemWorkflowService`

```java
UUID ensureWebAppCaptureRun(dataSet, orgUnit, period, actor);
UUID ensureReferralIngestRun(inboxId, actor);
```

Each call upserts a run on
`(workflow_id, workflow_version, business_key)` so parallel writes
for the same scope collapse to one run — no run-per-request fanout.

## 3. Write-path auto-wrap

- **`DataValueSetsController`** — before building `DataValueInput`
  rows, calls `ensureWebAppCaptureRun(dataSet, orgUnit, period, user)`
  and stamps every input + the resulting journal entry with the
  returned UUID.
- **`ReferralIngestService`** — stamps per inbox entry via
  `ensureReferralIngestRun(inboxId, actor)`.

Operator-authored writes (through `WorkflowRunCoordinator`) already
carry a run UUID — unchanged.

## 4. Read-path visibility

- **`GET /edge-api/v1/data/aggregate`** now returns
  `workflowRunId`, `workflowName`, `workflowBusinessKey`,
  `workflowKind` per row (LEFT JOIN
  `capture_workflow_run` + `capture_workflow`) and accepts a new
  `?workflowRunId=<uuid>` filter.
- **`OperationJournalRepository.findByWorkflowRun(runId, limit)`**
  for Sync-side filtering.
- Admin UI `/data/aggregate` gains a **Workflow** column
  (deep-links to `/workflows/monitoring/runs/:runId`; `SYS` chip
  marks system workflows) and the `ScopedFilterChip` from 2.3.80
  so `/data/aggregate?workflowRunId=…` becomes a real server-side
  filter.

## 5. Backward compatibility

- `OperationJournalEntry` gets a secondary ctor accepting
  `nextHopOrgUnitUid` without the workflow run — old callers
  compile.
- `AggregateDataValue` keeps the 12-arg ctor that defaults
  `workflowRunId` to null; the DB NOT NULL guard catches any write
  path that forgot to supply one.
- `DataValueInput` keeps the 8-arg ctor; new 9-arg form carries
  the run id.

## 6. Files changed

```
database/migrations/V072__data_workflow_run_link.sql         — NEW
database/migrations/V073__system_workflow_kinds.sql          — NEW
database/migrations/V074__aggregate_workflow_run_required.sql — NEW

server/.../workflow/SystemWorkflowService.java               — NEW
server/.../workflows/aggregate/AggregateDataValue.java        — + workflowRunId
server/.../workflows/aggregate/AggregateDataValueRepository.java — upsert +
                                                                 mapper + SELECTs
server/.../workflows/aggregate/AggregateDataValueService.java — DataValueInput
                                                                 + threading
server/.../workflows/aggregate/OperationJournalEntry.java     — + workflowRunId
server/.../workflows/aggregate/OperationJournalRepository.java— insert +
                                                                 mapper +
                                                                 findByWorkflowRun
server/.../dhis2emulator/DataValueSetsController.java         — auto-wrap
server/.../workflows/referral/ReferralIngestService.java      — auto-wrap
server/.../web/DataModuleController.java                      — workflow fields
                                                                 + ?workflowRunId=
server/.../test/.../DataValueSetsControllerTest.java          — SystemWorkflowService
                                                                 mock
server/.../test/.../ReferralIngestServiceTest.java            — SystemWorkflowService
                                                                 mock helper
server/.../test/.../AggregateDataValueRepositoryTest.java     — 13-arg mock

admin-ui/src/api/edgeApi.ts                                  — LocalAggregateRow +
                                                                 workflow fields;
                                                                 workflowRunId
                                                                 filter
admin-ui/src/screens/DataAggregate.tsx                        — Workflow column +
                                                                 ScopedFilterChip
VERSION / server/pom.xml / admin-ui/package.json / sw.js     — 2.3.85
```

## 7. Verified

```
cd server && mvn test \
  -Dtest='AggregateDataValueTest,AggregateDataValueRepositoryTest,
          AggregateDataValueServiceTest,DataValueSetsControllerTest,
          ReferralIngestServiceTest'
                                            ✓ 46 pass / 0 fail

cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.85 bundle (797 ms)
```

## 8. Follow-ups

- **R-C/1.4** — `CENTRAL_DOWNLOAD` system workflow + "pull from
  Central DHIS2" trigger for facilities going fully local-first.
- **R-C/2 / R-C/3** — thread `workflowRunId` through
  `EventService`, `EnrollmentService`, `TrackedEntityService` and
  flip their NOT NULL guards.
- Sync Queue / Attention / Drafts chip filters: now that
  `operation_journal.workflow_run_id` is populated for every new
  write, upgrade the existing chip from "scope marker" to real
  server-side filter.
- Pre-existing wider suite failures (DeviceControllerTest,
  MetadataListControllerTest, …) unchanged from baseline.
