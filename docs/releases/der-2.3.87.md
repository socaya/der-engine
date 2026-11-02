# der-2.3.87 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.86`

## Headline

**R-C/2 — Events module. Local-event browse page replaces the DHIS2
Event Capture launch tile; events carry workflow lineage end-to-end
(record / repo / outbox / NOT NULL).**

## 1. Schema — V076

Seeds the EVENT_CAPTURE system workflow:

```
workflow_id             | 00000000-0000-0000-0000-000000000004
display_name            | System · DHIS2 Event / Tracker capture
bound_metadata_kind     | SYSTEM
bound_metadata_id       | EVENT_CAPTURE
kind                    | SYSTEM
```

Then backfills untagged `event` rows to the EVENT_CAPTURE run keyed
on `(program, programStage, orgUnit, created_by)` and flips
`event.workflow_run_id NOT NULL`.

## 2. Java — workflowRunId threaded through

- `Event` record gains a nullable `workflowRunId` field + a
  back-compat 11-arg ctor. The compact ctor still requires the DB
  invariant (NOT NULL) to be caught at JDBC time for forgotten
  threads.
- `EventService.EventInput` gets `workflowRunId` at position 11,
  with 9-arg and 10-arg back-compat ctors so legacy callers compile
  unchanged.
- `EventService.handleOne` passes `input.workflowRunId()` into the
  stored `Event` and into the `OperationJournalEntry`.
- `EventRepository.upsert` SQL grows `workflow_run_id` on INSERT +
  `COALESCE` on UPDATE so a null-in-update doesn't clobber a
  previously-set tag; all SELECTs and the row mapper updated.

## 3. Auto-wrap on passthrough

- `SystemWorkflowService.ensureEventCaptureRun(program, programStage, orgUnit, actor)`
  — upserts on the standard `(workflow_id, workflow_version, business_key)`.
- `EventsController` (both `/api/events` and `/api/tracker`) derives
  the EVENT_CAPTURE scope from the first well-formed row in the
  batch and stamps every input with the resulting run id.
- `ReferralIngestService.ingestEvent` now attaches events to the
  per-inbox `REFERRAL_INGEST` run (same pattern as aggregate
  referrals).

## 4. New endpoint

```
GET /edge-api/v1/data/events
  ?program=…&programStage=…&orgUnit=…&status=…&workflowRunId=…&limit=100

→ { rows: [ { eventId, programUid/Name, programStageUid/Name,
              orgUnitUid, occurredAt, status, eventVersion,
              dataValueCount, workflowRunId, workflowName,
              workflowBusinessKey, workflowKind, syncState,
              operationId } ], limit }
```

LEFT JOINs `metadata_program`, `metadata_program_stage`,
`capture_workflow_run`, `capture_workflow` and the latest matching
`operation_journal` row.

## 5. Admin UI — `/data/events`

New screen `DataEvents.tsx` replaces `CapEvents`:

- Breadcrumb · status bar · filters (search / program UID / program
  stage UID / orgUnit UID / status / page size).
- Rows table with **Program**, **Stage**, **Org unit**, **Status**
  chip (colour-coded by DHIS2 Event.Status), **Workflow** column
  (deep-link to `/workflows/monitoring/runs/:runId`; `SYS` chip for
  system workflows), **Vals** count, **version**, and
  **Sync state** chip (identical cross-link vocabulary to the
  aggregate browse).
- `ScopedFilterChip` support for `?workflowRunId=…` so cross-module
  drill-ins land scoped.
- **Open DHIS2 capture** action still deep-links to the DHIS2 web
  app (`/dhis-web-event-capture/`).

## 6. Files changed

```
database/migrations/V076__event_workflow_run_required.sql     — NEW

server/.../workflows/events/Event.java                        — + workflowRunId
server/.../workflows/events/EventService.java                 — EventInput
                                                                 + threading
server/.../workflows/events/EventRepository.java              — upsert + mapper
                                                                 + SELECTs
server/.../workflow/SystemWorkflowService.java                — + EVENT_CAPTURE
                                                                 + ensureEventCaptureRun
server/.../dhis2emulator/EventsController.java                — auto-wrap +
                                                                 toInputWithRun
server/.../workflows/referral/ReferralIngestService.java      — event ingest
                                                                 wraps in
                                                                 REFERRAL_INGEST run
server/.../web/DataModuleController.java                      — GET /data/events

server/.../test/.../EventRepositoryTest.java                  — upsert mock
                                                                 gains any() arg
server/.../test/.../EventsControllerTest.java                 — SystemWorkflowService
                                                                 mock bean

admin-ui/src/api/edgeApi.ts                                  — LocalEventRow +
                                                                 listLocalEvents
admin-ui/src/screens/DataEvents.tsx                          — NEW browse
admin-ui/src/App.tsx                                         — /data/events →
                                                                 DataEvents

VERSION / server/pom.xml / admin-ui/package.json / sw.js     — 2.3.87
```

## 7. Verified

```
cd server   && mvn test -Dtest='EventRepositoryTest,EventsControllerTest'
                                             ✓ 24 pass / 0 fail
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.87 bundle (783 ms)
```

## 8. Follow-ups

- **R-C/3** — `enrollment` + `tracked_entity_instance` same
  treatment (`EnrollmentService` / `TrackedEntityService`
  workflowRunId threading + NOT NULL via V077).
- **R-C/2.1** — Central-DHIS2 download system workflow for events
  (sibling of 2.3.86's aggregate pull).
- **R-C/2.2** — Event detail page (`/data/events/:eventId`) listing
  the per-data-value rows + the raw payload JSON.
- Workflow kinds: expose a dropdown picker in Workflows admin that
  lets operators filter workflow definitions by `USER` vs `SYSTEM`.
