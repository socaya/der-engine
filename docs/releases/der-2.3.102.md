# der-2.3.102 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.101`

## Headline

**Four queued follow-ups cleared autonomously.** Workflow run
manifest now filters by state and offers one-click retry; the
tracker lineage drawer handles enrolments and stage events as
first-class rows; and Events + Tracker browse support an
occurred-at date range.

## 1. R-N — Manifest state filter

`GET /workflows/runs/{runId}/manifest?state=X` returns only
operations in that state. Response grows two fields so the client
keeps the full picture:

```
{
  total: 3,              // all operations for this run
  filteredState: "CENTRAL_REJECTED",
  filteredTotal: 1,      // operations after filter
  countsByEntityType:    // unfiltered (chip strip is always accurate)
  countsByState:         // unfiltered
  operations: [ ... ]    // filtered subset
}
```

The admin UI's `OutboundBundlePanel` renders every state chip as a
toggleable filter button. Clicking a chip re-queries with
`?state=`; clicking again or using "Clear filter" drops the filter.
Panel title shifts to "N of M shown · <state>" when active.

## 2. R-O — Per-kind tracker payload drawers

Two new server endpoints match the TEI drawer shape for the lower
tracker tiers:

```
GET /edge-api/v1/data/tracker/enrollment/{enrollmentUid}/payload
    → { endpoint: "/api/tracker",
        counts: { trackedEntities: 0, enrollments: 1, events: 0 },
        payload: { enrollments: [one row] },
        journal: [... enrolment-only history ...] }

GET /edge-api/v1/data/tracker/event/{eventUid}/payload
    → { endpoint: "/api/tracker",
        counts: { trackedEntities: 0, enrollments: 0, events: 1 },
        payload: { events: [one row with dataValues[]] },
        journal: [... stage-event-only history ...] }
```

`PayloadLineageDrawer` grows two new kinds (`enrollment`,
`tracker-event`). The Tracker table's **Lineage** button now opens
the drawer regardless of row kind — TEIs show TEI + all enrolments
+ all events; enrolment rows show just the enrolment envelope;
event rows show the single-event envelope.

## 3. R-P — Occurred-at date range

Server:

- `GET /data/events` accepts `?occurredFrom=YYYY-MM-DD&occurredTo=YYYY-MM-DD`
  — inclusive, applied against `event.occurred_at`. Upper bound uses
  `< (?::date + INTERVAL '1 day')` to catch all timestamps on the
  To date.
- `GET /data/tracker` accepts the same two params — the ENROLLMENT
  stream filters against `enrollment_date`, the EVENT stream
  against `occurred_date`. TEI rows are intentionally unfiltered so
  the `?teiUid=` zoom still works when combined with a range.

Client: new `DateRangePicker` component (two inline
`<input type="date">`) wired into DataEvents + DataTracker filter
rows next to the WorkflowPicker.

## 4. R-Q — Inline operation retry

New server endpoint:

```
POST /edge-api/v1/admin/ops/journal/{opId}/retry
    → 200  { operationId, state: "PENDING" }
    → 409  { code: "RETRY_NOT_APPLICABLE",
             message: "operation not found or in a terminal/already-pending state" }
```

Only moves rows out of **RETRYABLE / CENTRAL_REJECTED /
CONFLICT_REVIEW / QUARANTINED / UNKNOWN_OUTCOME** back to PENDING;
`last_error` is cleared, `attempt_count` is preserved (useful for
whack-a-mole debugging). Each call writes a `JOURNAL_RETRY` audit
entry attributed to the acting operator.

New `OperationJournalRepository.requeuePending()` method underpins
it with the state-guarded `UPDATE`.

Admin UI: a **Retry** button lands on each manifest row whose state
is retry-eligible. On success the panel re-queries so the row's
state shifts to PENDING immediately.

## 5. Live verification

```
# R-N — ?state= filter
GET /workflows/runs/.../manifest?state=CENTRAL_REJECTED
                                             → total=3, filteredTotal=1
                                               operations=[RFFF095525/CENTRAL_REJECTED]

# R-O — event-only payload (unknown uid returns 404)
GET /data/tracker/event/<unknown>/payload   → HTTP 404

# R-P — occurred-at range
GET /data/events?occurredFrom=2026-01-01&occurredTo=2026-12-31
                                             → 0 rows (no events in range)

# R-Q — retry a REJECTED op
POST /admin/ops/journal/e93c180f-.../retry  → HTTP 200
                                               state: "PENDING"
```

## 6. Files changed

```
server/.../workflows/aggregate/OperationJournalRepository.java
                                                       — requeuePending()
server/.../web/OperationsAdminController.java          — POST /retry endpoint
server/.../web/CaptureWorkflowController.java          — ?state= filter
                                                         + filteredTotal
server/.../web/DataModuleController.java               — enrollment+event
                                                         payload endpoints
                                                       + ?occurredFrom/To
                                                         on /events + /tracker

admin-ui/src/api/edgeApi.ts                            — + retryOperation()
                                                       + enrollmentRowPayload()
                                                       + trackerEventRowPayload()
                                                       + manifest opts.state
                                                       + occurredFrom/To
                                                         on listLocalEvents/Tracker
                                                       + filtered* fields
admin-ui/src/components/PayloadLineageDrawer.tsx       — + 2 kinds
admin-ui/src/components/DateRangePicker.tsx            — NEW
admin-ui/src/screens/DataEvents.tsx                    — + date range
admin-ui/src/screens/DataTracker.tsx                   — + date range
                                                       + Lineage on all rows
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx    — chip filter + Retry

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.102
```

## 7. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 74/74
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.102 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.102.jar
java -jar target/der-server-2.3.102.jar              ✓ /system/health 200
                                                     ✓ all four flows live
```

## 8. Follow-ups queued for 2.3.103+

- `PayloadLineageDrawer` currently shows a single global journal
  table even when the TEI drawer bundles three streams. A per-stream
  grouping would make the tracker-level drawer clearer.
- Manifest state filter is single-select; multi-select (e.g.
  "pending OR retryable") would help operators triage conflict
  storms.
- Retry endpoint operates one op at a time; a bulk variant that
  takes a `workflowRunId + state` would let a run-level
  "Retry all 7 rejected" land as one click.
- Occurred-at pickers accept any ISO date — a shortcut strip
  (today / this week / this month / last 30 days) would speed up
  the common cases.
