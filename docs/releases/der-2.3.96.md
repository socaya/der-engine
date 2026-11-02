# der-2.3.96 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.95`

## Headline

**End-to-end tracker sync verified against Central DHIS2 2.44.**
A TEI posted through the DER API now reaches Central in ~1 s with
async job polling, a dedicated `TrackerService` wraps the three
tracker write paths in one transaction, and a repeatable smoke
script lives at `scripts/smoke/tracker_e2e.sh`.

## 1. R-D/tracker-svc — TrackerService

New `ug.ac.mak.der.workflows.tracker.TrackerService` with three
`@Transactional` methods (`upsertTei`, `upsertEnrollment`,
`upsertEvent`). Each one:

1. Calls the matching repository upsert.
2. Inserts the corresponding `operation_journal` row with the
   stored `workflowRunId` (one atomic unit of work).
3. Appends a `SecurityAuditRepository` entry — same vocabulary as
   `AggregateDataValueService` and `EventService`.

The three tracker controllers (`TrackedEntityController`,
`EnrollmentController`, `TrackerEventController`) now delegate to
the service rather than orchestrating repo + journal + audit
themselves. Removes a Spring crash window where an unlucky
exception between upsert and journal.insert could leave a row in
the local store with no outbox entry.

**Tests:** `TrackerServiceTest` — 4 cases covering happy-path upsert
for each entity type plus one atomicity test proving journal is not
touched when the upsert throws.

## 2. R-D/tracker-async — DHIS2 2.44 async job polling

Central 2.44 queues `/api/tracker` imports and returns a job id in
the response (`{"response":{"id":"<uid>"}}`). The DER sync worker
now follows the two-phase flow:

1. POST `/api/tracker` as before.
2. If the entity is TEI / ENROLLMENT / PROGRAM_STAGE_EVENT **and**
   the response body carries `response.id`, enter polling mode.
3. GET `/api/tracker/jobs/{id}` every 500 ms (up to 60 attempts =
   ~30 s). The newest log entry's `completed:true` field signals
   that the import finished.
4. GET `/api/tracker/jobs/{id}/report` for the final `ImportReport`.
   Classification:
   - `status: "OK"` or `"WARNING"` → `ACCEPTED` (synced).
   - `status: "ERROR"` → `CONFLICT` (lands in `/sync/attention`).
5. Timeout → `RETRYABLE`; the sync worker retries on the next
   drain tick with its usual exponential backoff.

Small batches that Central answers synchronously (no `response.id`)
fall through to the pre-existing classification — no behavioural
regression for aggregate / single events.

**Tests:** `JournalPublisherTest` grows three async-flow cases
(happy path, ERROR → CONFLICT, inline fallback). Existing 11
preserved.

## 3. R-D/tracker-smoke — live end-to-end

New script `scripts/smoke/tracker_e2e.sh` exercises the full
pipeline:

```
sign in to DER  →  POST /edge-api/v1/tracked-entities (new TEI)
               →  trigger JOURNAL_WORKER_DRAIN
               →  poll der.operation_journal until CENTRAL_ACCEPTED
               →  GET Central /api/tracker/trackedEntities/{teiUid}
               →  assert 200
```

Live run against DHIS2 2.44-SNAPSHOT at `localhost:8080/dhis`:

```
[08:03:19] attempt 1/60 — state=IN_FLIGHT
[08:03:20] attempt 2/60 — state=CENTRAL_ACCEPTED
[08:03:20] Central confirms TEI → {"trackedEntity":"SMOKE595788", ...}
[08:03:20] SMOKE PASSED
```

~1-second end-to-end latency with the async polling loop.

## 4. Files changed

```
server/.../workflows/tracker/TrackerService.java            — NEW
server/.../workflows/journal/JournalPublisher.java          — async job polling
                                                              + ObjectMapper
                                                              dep; @Autowired
                                                              on primary ctor
server/.../web/TrackedEntityController.java                 — delegate to svc
server/.../web/EnrollmentController.java                    — delegate to svc
server/.../web/TrackerEventController.java                  — delegate to svc

server/.../test/.../TrackerServiceTest.java                 — NEW (4 cases)
server/.../test/.../JournalPublisherTest.java               — + 3 async cases

scripts/smoke/tracker_e2e.sh                                — NEW live smoke

VERSION / server/pom.xml / admin-ui/package.json / sw.js    — 2.3.96
```

## 5. Verified

```
cd server && mvn test \
       -Dtest='TrackerServiceTest,JournalPublisherTest,
               ReferralPayloadEncoderTest'
                                             ✓ 32/32
cd server   && mvn -q -DskipTests compile    ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.96 bundle
bash scripts/smoke/tracker_e2e.sh            ✓ SMOKE PASSED
                                             TEI SMOKE595788 reached
                                             Central in ~1 s
```

## 6. Follow-ups

- Smoke script extensions: cover enrolment + stage-event flows
  (`scripts/smoke/tracker_enrol_e2e.sh`,
  `scripts/smoke/tracker_event_e2e.sh`). Pattern is identical.
- Backoff-aware wait inside the smoke script (currently fixed 1 s)
  so admins can see the actual drain cadence.
- `TrackerService` is close to a template for mirroring the aggregate
  / event service pattern across the remaining capture paths —
  anything that still writes repo directly should migrate.
