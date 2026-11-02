# der-2.3.95 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.94`

## Headline

**R-D/sync-worker-tracker — tracker ops now have the correct wire
shape for DHIS2's `/api/tracker` endpoint. V079 backfills every
pre-R-C/3.2 tracker row so it enters the sync pipeline.**

## 1. R-D/sync-worker-tracker — payload shaping

`JournalPublisher` already dispatched `TRACKED_ENTITY` /
`ENROLLMENT` / `PROGRAM_STAGE_EVENT` to the right endpoints
(`/api/tracker`, `/api/tracker/events`), but the body was the flat
JSON the tracker controllers wrote. DHIS2's tracker endpoints
expect wrapped envelopes:

```json
{"trackedEntities":[{...}]}
{"enrollments":[{...}]}
{"events":[{...}]}
```

`ReferralPayloadEncoder.body()` now runs a `shapeForCentral` pass
on the payload before any referral marker / `storedBy` stamping,
converting:

| Entity type | DER local payload | DHIS2 wire shape |
|---|---|---|
| TRACKED_ENTITY | `{teiUid, trackedEntityType, orgUnit, attributes: {uid: val}, teiVersion}` | `{"trackedEntities":[{"trackedEntity", "trackedEntityType", "orgUnit", "attributes":[{"attribute":X,"value":Y}, …]}]}` |
| ENROLLMENT | `{enrollmentUid, teiUid, program, orgUnit, status, enrollmentDate, incidentDate?}` | `{"enrollments":[{"enrollment", "trackedEntity", "program", "orgUnit", "status", "enrolledAt", "occurredAt"?}]}` |
| PROGRAM_STAGE_EVENT | `{eventUid, enrollmentUid, program, programStage, orgUnit, status, occurredDate, dataValues:{uid:val}}` | `{"events":[{"event", "enrollment", "program", "programStage", "orgUnit", "status", "occurredAt", "dataValues":[{"dataElement":X,"value":Y}, …]}]}` |

Field renames follow the DHIS2 2.44 tracker API spec
(`occurredAt` not `occurredDate`, `trackedEntity` not `tei`, etc.).

### Referral marker + `storedBy` updated

Both now drill into the wrapped envelope so the `[DER-next-hop:…]`
note and ADR-0032 `storedBy` field land on the inner tracker
object, not the top-level array wrapper. Aggregate + single
events keep their legacy flat behaviour unchanged.

### Tests

`ReferralPayloadEncoderTest` updated to assert the wrapped shape:
`root.trackedEntities[0].notes` instead of `root.notes`, etc.
Encoder suite (14) and publisher suite (11) both green.

## 2. V079 — backfill pre-R-C/3.2 tracker rows

R-C/3.2 enqueued outbox entries on every *new* tracker write; rows
that existed before 2.3.94 shipped stayed invisible to the sync
worker (and showed *Local only* in the admin tracker browse).

V079 inserts a `PENDING` `operation_journal` row for every
`tracked_entity` / `edge_enrollment` / `edge_tracker_event` row
that doesn't already have one, carrying:

- The entity-type-appropriate reference (teiUid / enrollmentUid /
  eventUid).
- The `workflow_run_id` already stamped on the row (never null
  post-V074/V076/V078).
- A payload matching exactly what the controllers write for new
  rows — the encoder reshapes it the same way.

Idempotent via `NOT EXISTS` guards, so re-running against a DB
that already has journal entries skips those rows.

## 3. Files changed

```
database/migrations/V079__backfill_tracker_journal.sql       — NEW
server/.../workflows/journal/ReferralPayloadEncoder.java      — shapeForCentral
                                                                + wrapTei /
                                                                wrapEnrollment /
                                                                wrapTrackerEvent;
                                                                applyNextHop +
                                                                stampStoredBy
                                                                drill into
                                                                wrapped envelopes
server/.../test/.../ReferralPayloadEncoderTest.java           — three tests
                                                                updated for
                                                                wrapped shape

VERSION / server/pom.xml / admin-ui/package.json / sw.js      — 2.3.95
```

## 4. Verified

```
cd server   && mvn test \
       -Dtest='ReferralPayloadEncoderTest,JournalPublisherTest'
                                             ✓ 25/25
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npm run build                 ✓ (no client changes;
                                               2.3.95 bundle)
```

## 5. Follow-ups

- Verify end-to-end push to a running Central DHIS2 2.44
  (`/api/tracker` import summary parsing is already handled by
  the existing publish-result classifier). Live smoke test is
  queued once we have a Central with tracker programs mirrored.
- **R-D/tracker-svc** — move the three tracker controllers'
  upsert + journal.insert into a dedicated `TrackerService` so
  both land in one `@Transactional` unit of work (mirrors
  `AggregateDataValueService` / `EventService`).
- Pending status readback for individual tracker ops (`/api/tracker/jobs/{id}`
  polling) — present for events, not yet for tracker.
