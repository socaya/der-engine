# der-2.3.93 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.92`

## Headline

**R-C/3.1 — Central-DHIS2 download for tracker (cascaded TEI →
enrolment → events) and R-C/pick-lists — searchable metadata-mirror
pickers in every Pull-from-Central dialog.**

## 1. R-C/3.1 — Tracker central-download

A facility going fully local-first can now pull its tracker
history for one program/orgUnit cascade into DER's local store so
operators start capturing against the real baseline.

### Service

`CentralDownloadService.pullTracker(program, orgUnit, actor, ip, ua)`:

1. `SystemWorkflowService.ensureCentralDownloadRun(program, orgUnit, "tracker", actor)`
   — same CENTRAL_DOWNLOAD system workflow used by aggregate +
   events pulls (`0..03`); business key `program|orgUnit|tracker`
   so repeated tracker pulls for the same scope share one run.
2. One request to `/api/trackedEntityInstances.json` on Central
   with `fields=…` targeted to get TEI + attributes + enrolments
   + events + dataValues in a single response. `paging=false`;
   `includeAllAttributes=true`.
3. For each TEI returned, cascade through to the three local
   tables:
   - `tracked_entity` ← upsert via `TrackedEntityRepository`.
   - `edge_enrollment` ← upsert via `EnrollmentRepository`
     (status / enrollmentDate / incidentDate parsed).
   - `edge_tracker_event` ← upsert via `TrackerEventRepository`
     (status / occurredDate / dataValues JSON built from Central's
     `dataValues[]`).

Each upsert carries the system run id; repository `COALESCE`
guards preserve lineage on re-pulls. Per-row errors are collected
without stopping the batch and surfaced in the response.

### Endpoint

```
POST /edge-api/v1/data/tracker/pull-from-central
{ "program": "...", "orgUnit": "..." }

→ 200 { "runId", "teis", "enrolments", "events",
        "errors", "errorDetails": [{ "key", "reason" }] }
→ 400 missing program or orgUnit
→ 502 Central returned a malformed payload
→ 503 Central unreachable
```

### Admin UI

`/data/tracker` gains a **Pull from Central** button next to Open
DHIS2 capture. Dialog shows program + orgUnit pickers (R-C/pick-
lists); result panel shows per-level counts (TEIs / enrolments /
events) + any error count + deep-link to the resulting workflow
run page.

## 2. R-C/pick-lists — searchable metadata pickers

Pull dialogs previously accepted free-text UIDs. Operators don't
memorise 11-char DHIS2 UIDs, so we added a type-ahead picker
backed by the local metadata mirror.

### `MetadataPicker` component

- Resource-parametrised (`dataSets`, `programs`, `programStages`,
  `organisationUnits`).
- Lazy-loads the resource list from `/api/<resource>` on first
  focus; caches for the component's lifetime.
- Case-insensitive search over `id` + `displayName`; result list
  caps at 50 to keep the dropdown snappy.
- Shows the resolved display name under the input when a UID is
  selected but the picker is closed.
- Falls back silently to a plain text input if the mirror call
  fails so the dialog stays usable when metadata isn't synced
  yet.

### Dialogs upgraded

- **Pull aggregate** (`/data/aggregate`) — Dataset + OrgUnit are
  now pickers. Period stays a free-text input (periods aren't
  mirrored).
- **Pull events** (`/data/events`) — Program + Program stage +
  OrgUnit are pickers.
- **Pull tracker** (`/data/tracker`) — Program + OrgUnit are
  pickers.

## 3. Files changed

```
server/.../workflows/aggregate/CentralDownloadService.java    — + pullTracker,
                                                                 TrackerPullResult
                                                                 + new deps on
                                                                 TrackedEntity /
                                                                 Enrollment /
                                                                 TrackerEvent
                                                                 repositories
server/.../web/DataModuleController.java                      — POST
                                                                 /tracker/pull-from-central

admin-ui/src/components/MetadataPicker.tsx                   — NEW component
admin-ui/src/api/edgeApi.ts                                  — PullTrackerResult +
                                                                 pullTrackerFromCentral
admin-ui/src/screens/DataAggregate.tsx                        — dataset + orgUnit
                                                                 pickers in dialog
admin-ui/src/screens/DataEvents.tsx                           — program + stage +
                                                                 orgUnit pickers
admin-ui/src/screens/DataTracker.tsx                          — Pull button + modal
                                                                 + pickers

VERSION / server/pom.xml / admin-ui/package.json / sw.js      — 2.3.93
```

## 4. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd server   && mvn test \
       -Dtest='EventServiceTest,AggregateDataValueServiceTest,
               EnrollmentRepositoryTest,TrackedEntityRepositoryTest,
               TrackerEventRepositoryTest'
                                             ✓ 24 pass / 0 fail
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.93 bundle (790 ms)
```

## 5. R-C sequence — complete

With R-C/3.1 shipped, the Data module now has full parity across
all three data types:

| Data type | Browse | Row detail | Workflow lineage | Central pull |
|-----------|--------|------------|------------------|--------------|
| Aggregate | ✓ 2.3.81 | ✓ 2.3.92 | ✓ 2.3.84 | ✓ 2.3.86 |
| Events    | ✓ 2.3.87 | ✓ 2.3.92 | ✓ 2.3.87 | ✓ 2.3.91 |
| Tracker   | ✓ 2.3.89 | ✓ 2.3.92 | ✓ 2.3.89 | ✓ 2.3.93 |

## 6. Follow-ups

- Enrolment / event dedicated detail screens (currently they
  surface inside the parent TEI detail).
- Retry / resend actions on retryable journal rows.
- Scheduled pulls (cron CENTRAL_DOWNLOAD runs for programs with
  ongoing baseline refresh needs).
- Pre-existing wider test suite failures (DeviceControllerTest etc.)
  remain the baseline flakes noted in earlier releases.
