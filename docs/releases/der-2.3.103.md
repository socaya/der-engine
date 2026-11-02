# der-2.3.103 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.102`

## Headline

**Four more queued follow-ups cleared autonomously.** TEI drawer
groups journal history by stream (R-R); manifest filter is multi-
select (R-S); one-click bulk retry for an entire run or scoped state
set (R-T); and the date-range picker gains Today / Week / Month /
Last-30 shortcuts (R-U).

## 1. R-R — Per-stream journal grouping in TEI drawer

The TEI `/payload` response gains a `journalByStream` field:

```
{
  "payload": { trackedEntities, enrollments, events },
  "journal": [ ... flat, backward-compat ... ],
  "journalByStream": {
    "trackedEntity": [ ... TEI history ... ],
    "enrollments":   [ ... all enrolment history ... ],
    "events":        [ ... all stage-event history ... ]
  }
}
```

The drawer renders a dedicated `JournalGroup` for each stream when
`journalByStream` is present; falls back to the flat journal table
for single-row drawers (aggregate / event / enrolment / tracker-
event). Each group shows `(count)` in its heading and a muted "No
outbox entry" row when the stream is empty.

## 2. R-S — Multi-select manifest state filter

Manifest endpoint now accepts a comma-separated list:

```
GET /workflows/runs/{runId}/manifest?state=PENDING,CENTRAL_ACCEPTED
    → filteredState: "PENDING,CENTRAL_ACCEPTED"
      filteredTotal: 1
      operations:   [ ... matching subset ... ]
```

Admin UI chip row toggles each state in/out of the set — click
multiple chips to OR them, click again to drop. The panel title lists
the active set ("1 of 3 shown · PENDING, CENTRAL_ACCEPTED"); the
Clear-filter button drops them all.

## 3. R-T — Bulk retry

New server endpoint:

```
POST /admin/ops/journal/retry-run?workflowRunId=<uuid>&state=<CSV>
    → 200 { workflowRunId, rowsRequeued: N }
```

`state` is optional — defaults to all five retry-eligible states
(RETRYABLE / CENTRAL_REJECTED / CONFLICT_REVIEW / QUARANTINED /
UNKNOWN_OUTCOME). Writes a `JOURNAL_RETRY_RUN` audit entry attributed
to the operator with the run id, state set, and row count.

New `OperationJournalRepository.requeuePendingByRun()` underpins it:
same semantics as the single-op requeue (preserve attempt_count,
clear last_error, state-guarded UPDATE).

Admin UI adds a right-aligned primary button to the manifest panel
toolbar:

- When no filter is active and ≥1 retry-eligible row is shown:
  "Retry 7 operations" → calls `/retry-run` with default states.
- When a filter is active (e.g. only CENTRAL_REJECTED chip): the
  button scopes to the filtered state set.
- Button disables + reads "Retrying…" during the request; on success
  the panel re-queries so rows transition to PENDING immediately.

## 4. R-U — Date shortcut strip

The `DateRangePicker` grows four shortcut buttons before the two
date inputs:

| Button          | Range                                   |
|-----------------|-----------------------------------------|
| Today           | from = to = today                       |
| This week       | ISO-week Monday → today                 |
| This month      | first-of-month → today                  |
| Last 30 days    | today-29 → today (inclusive 30-day set) |

Click sets both `from` and `to` in one update. Date inputs stay
free-form for custom ranges. Local timezone is used (operators pick
by calendar date, not UTC).

## 5. Live verification

```
# R-R — TEI drawer carries journalByStream
GET /data/tracker/tei/RFFF095525/payload
                                      → journalByStream keys:
                                          [enrollments, events, trackedEntity]
                                        tei history len: 1

# R-S — multi-state filter
GET /workflows/runs/.../manifest?state=PENDING,CENTRAL_ACCEPTED
                                      → rows: 1 of 3
                                        filter: PENDING,CENTRAL_ACCEPTED

# R-T — bulk retry
POST /admin/ops/journal/retry-run
    ?workflowRunId=11c272fe-...&state=CENTRAL_REJECTED
                                      → rowsRequeued: 1
```

## 6. Files changed

```
server/.../workflows/aggregate/OperationJournalRepository.java
                                                       — requeuePendingByRun()
server/.../web/OperationsAdminController.java          — POST /retry-run
server/.../web/CaptureWorkflowController.java          — ?state= CSV parsing
server/.../web/DataModuleController.java               — TEI journalByStream

admin-ui/src/api/edgeApi.ts                            — retryRun()
                                                       + manifest state[]
                                                       + journalByStream type
admin-ui/src/components/PayloadLineageDrawer.tsx       — JournalGroup helper
                                                       + per-stream render
admin-ui/src/components/DateRangePicker.tsx            — 4 shortcut buttons
                                                       + range generators
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx    — multi-select chips
                                                       + bulk retry button

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.103
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
                                                     ✓ 2.3.103 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.103.jar
java -jar target/der-server-2.3.103.jar              ✓ /system/health 200
                                                     ✓ all three server
                                                       surfaces live
```

## 8. Follow-ups queued for 2.3.104+

- Bulk retry needs confirmation UX for large sets (e.g. "Retry 1,247
  operations?" dialog) — current one-click is fine for small runs
  but risky at scale.
- Per-stream journal groups could offer their own retry buttons (e.g.
  "retry 3 failed enrolments on this TEI" from inside the drawer).
- Date shortcut strip currently fixed to the four presets. "Yesterday"
  and "Last week" occasionally come up in triage — add if operators
  ask.
- `journalByStream` only ships on the TEI drawer. If the single-row
  drawers ever need to render multiple attempts per op, they should
  reuse `JournalGroup` with a scoped label.
