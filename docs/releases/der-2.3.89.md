# der-2.3.89 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.88`

## Headline

**R-C/3 — Tracker module. TEIs, enrolments, and tracker-stage
events now browseable in a unified `/data/tracker` view with
end-to-end workflow lineage.**

## 1. Schema

### V077 — nullable `workflow_run_id` on tracker edge tables

```sql
ALTER TABLE tracked_entity      ADD COLUMN workflow_run_id UUID
   REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
ALTER TABLE edge_enrollment     ADD COLUMN workflow_run_id UUID
   REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
ALTER TABLE edge_tracker_event  ADD COLUMN workflow_run_id UUID
   REFERENCES capture_workflow_run(run_id) ON DELETE SET NULL;
```

Per-table indexes on `(workflow_run_id)`.

### V078 — TRACKER_CAPTURE system workflow + backfill + enforce

Seeds the fifth and final system workflow:

```
workflow_id             | 00000000-0000-0000-0000-000000000005
display_name            | System · DHIS2 Tracker capture
bound_metadata_kind     | SYSTEM
bound_metadata_id       | TRACKER_CAPTURE
kind                    | SYSTEM
```

Then backfills every untagged row onto a TRACKER_CAPTURE run keyed
on `(program, orgUnit, createdBy)` (for enrolments + events) or
`(_TEI_, orgUnit, createdBy)` (for TEIs), and flips
`workflow_run_id` to `NOT NULL` on all three tables. A couple of
pre-feature TEIs with no `created_by` are dropped — the controller
has required it since day one so the backfill target set is clean.

## 2. Java — threading

- **`Enrollment`**, **`TrackerEvent`**, **`TrackedEntityRepository.TrackedEntity`**
  all grow a nullable `workflowRunId` field + a back-compat ctor
  so legacy callers compile unchanged.
- **`EnrollmentRepository.upsert`**, **`TrackerEventRepository.upsert`**,
  **`TrackedEntityRepository.upsert`** SQL grow `workflow_run_id`
  on INSERT + COALESCE on UPDATE; all SELECTs + row mappers
  updated.
- **`SystemWorkflowService.ensureTrackerCaptureRun(program, orgUnit, actor)`**
  — upserts on the canonical `(workflow_id, workflow_version,
  business_key)`.

## 3. Auto-wrap on passthrough

- **`TrackedEntityController`** stamps every TEI with a
  `_TEI_|orgUnit|user` system run (the enrolment program is not
  known until the first enrolment ships).
- **`EnrollmentController`** stamps every enrolment with a
  `program|orgUnit|user` run. TEI → enrol by the same operator
  gets two trackable runs, which matches how DHIS2 Tracker
  Capture structures the operator journey.
- **`TrackerEventController`** stamps every tracker-stage event
  with the same `program|orgUnit|user` run as its parent
  enrolment, so a session's enrol + first visit roll up under one
  run.

## 4. New endpoint

```
GET /edge-api/v1/data/tracker
  ?kind=TEI|ENROLLMENT|EVENT&program=…&orgUnit=…&teiUid=…
  &workflowRunId=…&limit=100

→ { rows: [ { kind, rowId, teiUid, (enrollmentUid|eventUid),
              programUid/Name, programStageUid/Name,
              orgUnitUid, status, enrollmentDate/occurredDate,
              version, workflowRunId, workflowName,
              workflowBusinessKey, workflowKind } ],
    limit }
```

Union of three per-kind queries, each LEFT JOIN'd against
`metadata_program` / `metadata_program_stage` /
`metadata_tracked_entity_type` / `capture_workflow_run` /
`capture_workflow`, then merged and sorted by `updated_at desc`.

## 5. Admin UI — `/data/tracker`

New `DataTracker.tsx` replaces `CapTracker`:

- Breadcrumb · status bar · pill filters (kind / program / orgUnit /
  TEI UID / page size).
- `ScopedFilterChip` for both `?workflowRunId=` and `?teiUid=`;
  the TEI chip is also offered via a button on each row (zoom to a
  single TEI's full history).
- Rows table combines TEI / enrolment / event in one time-sorted
  view with a per-kind colour chip, program + stage names,
  per-row sync-independent status chip, and the Workflow column
  (deep-link + `SYS` chip, identical to Aggregate / Events).
- **Open DHIS2 capture** → `/dhis-web-tracker-capture/`.

## 6. Workflow run → Data: completeness

`WorkflowRunDetail` action bar now exposes drill-downs for all
four data kinds:

- **Aggregate** · **Events** · **Tracker** · **Drafts** · plus the
  Sync pair.

A single run's `?workflowRunId=` click now surfaces every piece of
data the run touched.

## 7. Files changed

```
database/migrations/V077__tracker_workflow_run_link.sql       — NEW
database/migrations/V078__tracker_workflow_run_required.sql   — NEW

server/.../workflows/tracker/Enrollment.java                   — + workflowRunId
server/.../workflows/tracker/EnrollmentRepository.java         — upsert + mapper
server/.../workflows/tracker/TrackerEvent.java                 — + workflowRunId
server/.../workflows/tracker/TrackerEventRepository.java       — upsert + mapper
server/.../workflows/tracker/TrackedEntityRepository.java      — + workflowRunId
                                                                 on inner TrackedEntity
                                                                 record; upsert +
                                                                 mapper
server/.../workflow/SystemWorkflowService.java                 — + TRACKER_CAPTURE
                                                                 + ensureTrackerCaptureRun
server/.../web/EnrollmentController.java                       — auto-wrap
server/.../web/TrackedEntityController.java                    — auto-wrap
server/.../web/TrackerEventController.java                     — auto-wrap
server/.../web/DataModuleController.java                       — GET /data/tracker

admin-ui/src/api/edgeApi.ts                                   — LocalTrackerRow +
                                                                 listLocalTracker
admin-ui/src/screens/DataTracker.tsx                           — NEW browse
admin-ui/src/App.tsx                                           — /data/tracker →
                                                                 DataTracker
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx            — + Tracker action

VERSION / server/pom.xml / admin-ui/package.json / sw.js      — 2.3.89
```

## 8. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd server   && mvn test \
       -Dtest='EnrollmentRepositoryTest,TrackedEntityRepositoryTest,
               TrackerEventRepositoryTest'
                                             ✓ existing tracker repo tests pass

cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.89 bundle (785 ms)
```

## 9. System workflow directory (complete)

| ID       | Name                                      | Kind   |
|----------|-------------------------------------------|--------|
| `0..01`  | System · DHIS2 Data Entry capture         | SYSTEM |
| `0..02`  | System · Referral ingest                  | SYSTEM |
| `0..03`  | System · Central DHIS2 download           | SYSTEM |
| `0..04`  | System · DHIS2 Event / Tracker capture    | SYSTEM |
| `0..05`  | System · DHIS2 Tracker capture            | SYSTEM |

## 10. Follow-ups

- **R-C/2.1** — Central-download for events (not yet shipped).
- **R-C/3.1** — Central-download for tracker (search Central by
  dataSet-equivalent program + orgUnit; stage events can follow
  via `/tracker/trackedEntities`).
- **R-C/2.2** — Row-detail pages for aggregate / event / tracker
  (click row → full payload + journal history + sync retry log).
- **Sync Attention ↔ Data** — conflict detail backlink to the
  originating row (entityType → route mapping).
