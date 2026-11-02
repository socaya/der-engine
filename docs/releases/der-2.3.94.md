# der-2.3.94 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.93`

## Headline

**R-C/3.2 — Tracker writes now flow through `operation_journal`.
TEIs, enrolments, and tracker-stage events are now queued for Sync
to Central with their workflow lineage, and the `/data/tracker`
browse gains a sync-state chip per row.**

## 1. Why

Earlier R-C/3 releases wired `workflow_run_id` into the three
tracker tables, but the tracker controllers persisted directly via
their repositories and **never enqueued an `operation_journal`
entry**. The sync worker therefore never saw tracker writes:
tracker rows stayed stuck in the local store, invisible to the
Sync surface, and `?workflowRunId=` filtering from Sync side
missed them.

This release closes the loop: every tracker write now **both**
hits the local table **and** enqueues a `PENDING` outbox entry
tagged with `workflow_run_id` + the originating `created_by` user,
with a JSON payload shaped for whatever downstream processor
(sync worker or admin UI) needs to interpret it.

## 2. Server — journal insert on each tracker write

### `TrackedEntityController.upsert`

After `TrackedEntityRepository.upsert(...)` succeeds, inserts
`OperationJournalEntry(EntityType.TRACKED_ENTITY, teiUid, payload,
PENDING, ..., workflowRunId)` where `payload` is a flat JSON of the
stored row:

```json
{
  "teiUid": "...",
  "trackedEntityType": "...",
  "orgUnit": "...",
  "attributes": { ... },
  "teiVersion": 1
}
```

### `EnrollmentController.upsert`

Same pattern: `EntityType.ENROLLMENT`, `entityRef = enrollmentUid`,
payload includes the enrolment identity + dates + status +
teiUid link.

### `TrackerEventController.upsert`

`EntityType.PROGRAM_STAGE_EVENT`, `entityRef = eventUid`, payload
includes event identity + stage + status + occurredDate +
dataValues map.

All three controllers inject `OperationJournalRepository` +
`ObjectMapper` as new constructor dependencies.

## 3. Server — sync-state surfaced in `/data/tracker`

The three fetch helpers in `DataModuleController.tracker()` grew
correlated subqueries so each returned row carries the latest
`operation_journal.state` and `operation_id` for its entity:

- TEI rows → latest `TRACKED_ENTITY` journal row.
- Enrolment rows → latest `ENROLLMENT` journal row.
- Event rows → latest `PROGRAM_STAGE_EVENT` journal row.

Same compound-key pattern as aggregate / events uses, no schema
changes.

## 4. Admin UI — sync-state chip in the tracker browse

`DataTracker.tsx` gets a new **Sync state** column + a
`TrackerSyncChip` component that mirrors the Aggregate / Events
vocabulary:

- `PENDING` → *Pending push* · info · deep-links to `/sync/data`.
- `IN_FLIGHT` → *Sending…* · info.
- `RETRYABLE` → *Retrying* · warning.
- `CENTRAL_ACCEPTED` → *Synced* · success.
- `CENTRAL_REJECTED` / `QUARANTINED` → *Rejected* / *Quarantined* ·
  danger · deep-links to `/sync/attention/:operationId`.
- `CONFLICT_REVIEW` → *Conflict* · warning · deep-links to Sync
  Attention.
- `REQUIRES_APPROVAL` → *Awaiting approval* · warning.
- `UNKNOWN_OUTCOME` → *Unknown* · warning.
- `null` (pre-R-C/3.2 writes or CENTRAL_DOWNLOAD rows) → *Local
  only* · neutral.

The chip is a `Link` when the state has a meaningful destination.

## 5. What this enables immediately

- **Sync visibility** — tracker rows now appear in `/sync/data`.
- **Workflow-run scoped sync** — a workflow run's Sync queue /
  Attention tabs populated via `?workflowRunId=` include tracker
  ops.
- **Conflict routing** — a rejected tracker op lands in
  `/sync/attention`; the new backlink helper from 2.3.91 routes it
  back to `/data/tracker` (TEI UID auto-scoped for TEI entity
  types).
- **Browse feedback** — operators capturing in the DHIS2 Tracker
  Capture web app can see on the admin page whether their data
  reached Central.

## 6. What this does *not* do yet

- The sync worker's actual push to Central's
  `/api/trackedEntityInstances` / `/api/events` endpoints is
  still future work; today the entries sit `PENDING` and stay
  there. Shipping that is R-D/sync-worker-tracker.
- Pre-R-C/3.2 tracker rows in the local store have no journal
  entry; they continue to show *Local only*. A backfill task
  would re-enqueue them on demand but isn't shipped here.
- Transactional wrapping of upsert + journal.insert is not yet
  atomic — a crash between the two leaves a tracker row without a
  journal entry. Low-risk given the controllers run under the
  Spring MVC request thread, but a dedicated `TrackerService`
  layer would make this bulletproof (follow-up R-D/tracker-svc).

## 7. Files changed

```
server/.../web/TrackedEntityController.java       — + OperationJournalRepository
                                                    + ObjectMapper deps;
                                                    + journal.insert() after upsert
server/.../web/EnrollmentController.java          — same
server/.../web/TrackerEventController.java        — same
server/.../web/DataModuleController.java          — fetchTeis / fetchEnrolments /
                                                    fetchTrackerEvents LEFT JOIN
                                                    operation_journal subqueries

admin-ui/src/api/edgeApi.ts                      — LocalTrackerRow +
                                                    syncState + operationId
admin-ui/src/screens/DataTracker.tsx              — Sync state column +
                                                    TrackerSyncChip component

VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.94
```

## 8. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.94 bundle (979 ms)
```

## 9. Follow-ups

- **R-D/sync-worker-tracker** — teach the sync worker to actually
  push `TRACKED_ENTITY`, `ENROLLMENT`, `PROGRAM_STAGE_EVENT` ops to
  Central (`/api/trackedEntityInstances`, `/api/events`,
  `/api/tracker`).
- **R-D/tracker-svc** — move the controller upsert + journal
  insert into a `TrackerService` so it's a single `@Transactional`
  unit of work (mirrors `AggregateDataValueService`,
  `EventService`).
- Backfill task for pre-R-C/3.2 tracker rows with no journal
  entry.
- Journal-row click → full operation payload drawer (shared across
  all three data types).
