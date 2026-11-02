# der-2.3.105 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.104`

## Headline

**Two deferred follow-ups shipped.** The payload lineage drawer now
offers per-stream Retry buttons (R-Y), and every single-row drawer
uses the same `journalByStream` rendering as the TEI drawer (R-Z) —
one consistent code path for all five entity flavours.

## 1. R-Y — Per-stream retry inside drawer

New server endpoint:

```
POST /edge-api/v1/admin/ops/journal/retry-batch
     { "operationIds": ["<uuid>", "<uuid>", ...] }
   → 200 { requested: N, rowsRequeued: M }
   → 400 { code: "OPERATION_IDS_REQUIRED" | "OPERATION_ID_INVALID" }
```

Semantics match the single-op and run-wide retry endpoints: state-
guarded `UPDATE` (only moves out of RETRYABLE / CENTRAL_REJECTED /
CONFLICT_REVIEW / QUARANTINED / UNKNOWN_OUTCOME), clears `last_error`,
preserves `attempt_count`. Writes a `JOURNAL_RETRY_BATCH` audit entry
with the requested count + rows actually requeued.

Backed by new `OperationJournalRepository.requeuePendingByIds()`.

**Client**: `JournalGroup` grows a right-aligned "Retry N" button that
appears when the group holds ≥1 retry-eligible row. Clicking it
collects that group's retry-eligible operation ids and POSTs them to
`/retry-batch`. The drawer refreshes on success so state chips flip
to PENDING in-place.

Scope precision — the TEI drawer's three JournalGroups each target
only their own stream's ids, so "Retry 3 failed enrolments on this
TEI" is one click without touching the TEI stub or stage events.

## 2. R-Z — journalByStream for single-row drawers

Server: the four single-row payload endpoints now also return
`journalByStream` with a single appropriate key:

| Endpoint                                | journalByStream key |
|-----------------------------------------|---------------------|
| `/data/aggregate/{id}/payload`          | `dataValues`        |
| `/data/events/{id}/payload`             | `events`            |
| `/data/tracker/enrollment/{id}/payload` | `enrollments`       |
| `/data/tracker/event/{id}/payload`      | `events`            |
| `/data/tracker/tei/{teiUid}/payload`    | `trackedEntity` + `enrollments` + `events` |

Flat `journal` is still returned for backward compatibility (older
clients continue to work).

**Client**: `PayloadLineageDrawer` now always renders via
`JournalGroup`, iterating whichever of the four known stream keys
is present. Headings become stream-specific ("Data-value journal",
"Enrolment journal", etc.) instead of the generic "Operation journal
(3)". The fallback flat renderer stays for forward-compat but is no
longer reached in practice.

## 3. Shared refinements

- New exported `JournalEntry` + `isRetryable(state)` from `edgeApi`
  / drawer so consumers outside the drawer can use the same vocab.
- `RowPayloadLineage<E>.journalByStream` is now part of the base
  type (optional), with keys `trackedEntity | enrollments | events |
  dataValues` — fully typed everywhere it's consumed.

## 4. Files changed

```
server/.../workflows/aggregate/OperationJournalRepository.java
                                                        — requeuePendingByIds()
server/.../web/OperationsAdminController.java           — POST /retry-batch
                                                        + RetryBatchRequest
server/.../web/DataModuleController.java                — journalByStream on
                                                          aggregate / events /
                                                          enrolment / event
                                                          single-row endpoints

admin-ui/src/api/edgeApi.ts                             — JournalEntry type
                                                        + journalByStream on
                                                          base RowPayloadLineage
                                                        + retryBatch()
admin-ui/src/components/PayloadLineageDrawer.tsx        — unified rendering
                                                        + per-stream Retry
                                                        + isRetryable export

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.105
```

## 5. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 74/74
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.105 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.105.jar
java -jar target/der-server-2.3.105.jar              ✓ /system/health 200
```

Live verification against DHIS2 2.44-SNAPSHOT @ `localhost:8080/dhis`,
PG restored, DER 2.3.105 up:

```
Sign-in                                          → 200 role=ADMIN
GET  /data/tracker/tei/RFFF095525/payload        → journalByStream keys:
                                                     [enrollments, events,
                                                      trackedEntity]
                                                   tei history: 1
GET  /data/tracker/enrollment/<uid>/payload      → journalByStream key:
                                                     [enrollments]
POST /admin/ops/journal/retry-batch (empty)      → 400 OPERATION_IDS_REQUIRED
POST /admin/ops/journal/retry-batch
     { operationIds: [e93c180f-...] }            → { requested: 1,
                                                     rowsRequeued: 1 }
```

## 6. Autonomous arc complete (2.3.102 → 2.3.105)

Across four releases the full post-2.3.101 queue cleared end-to-end:

| Release  | Items  | Theme                                            |
|----------|--------|--------------------------------------------------|
| 2.3.102  | R-N R-O R-P R-Q | manifest state filter · per-kind drawers · occurred-at range · inline retry |
| 2.3.103  | R-R R-S R-T R-U | per-stream journal · multi-select filter · bulk retry · date shortcuts |
| 2.3.104  | R-V R-X         | bulk-retry confirm · more date shortcuts |
| 2.3.105  | R-Y R-Z         | per-stream Retry button · journalByStream everywhere |

**12 queued follow-ups shipped autonomously** · 74/74 server tests
green throughout · live-verified against DHIS2 2.44 after the swap ·
the queue is now genuinely empty.
