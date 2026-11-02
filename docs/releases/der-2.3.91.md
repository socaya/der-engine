# der-2.3.91 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.90`

## Headline

**R-D/1 — Sync Attention → Data row backlink, and R-C/2.1 —
Central-DHIS2 download for events. Two P2 gaps from the data-module
audit closed.**

## 1. R-D/1 — Sync Attention → Data row backlink

Conflict detail (`/sync/attention/:operationId`) previously
exposed the DHIS2 metadata deep-link but had no way to jump to the
actual local Data row that caused the sync failure. Admins
troubleshooting a conflict had to navigate manually to the right
Data module.

- **`shared.tsx`** gains `dataModuleRouteForEntity(entityType)` +
  `dataModuleLabelForEntity(entityType)` helpers mirroring
  `metadataResourceForEntity`:

| Entity type                                    | Data route        |
|------------------------------------------------|-------------------|
| AGGREGATE_DATA_VALUE / AGGREGATE / DATA_VALUE_SET | `/data/aggregate` |
| EVENT                                          | `/data/events`    |
| TRACKED_ENTITY_* / ENROLLMENT / PROGRAM_STAGE_EVENT | `/data/tracker` |

- **`MockupConflictDetail`** renders a new action button
  (**"Open in Aggregate / Events / Tracker"**) alongside the
  existing "DHIS2 metadata" button. For TEI / enrolment ops the
  button pre-scopes the Tracker browse via
  `?teiUid=<entityRef>`.

The button only appears when the entity type has a Data route —
generic METADATA ops stay unchanged.

## 2. R-C/2.1 — Central-DHIS2 download for events

Mirror of 2.3.86's aggregate pull. A facility going fully
local-first can now also pull existing event history for a
specific program / orgUnit into DER's local `event` table so
operators have the baseline before they start capturing against
it.

### New service method

```java
CentralDownloadService.pullEvents(
    programUid, programStageUid?, orgUnitUid,
    startDate?, endDate?, actor, ip, ua)
```

Flow:

1. `SystemWorkflowService.ensureCentralDownloadRun(program, orgUnit, "<start>:<end>", actor)`
   — reuses the shared CENTRAL_DOWNLOAD system workflow (`0..03`),
   business-keyed on the pull window so repeated pulls for the
   same scope share one run.
2. `Dhis2ReferenceClient.fetchJson(/api/events.json?program=…&orgUnit=…&paging=false&…)`.
3. Each returned event is converted to an `EventInput` (with the
   `dataValues` array flattened to a `dataElement → value` map),
   carrying the system run id, then fed through
   `EventService.submit()` — same validation + rule engine +
   journal / outbox machinery as a local write.

Returns `{ runId, imported, ignored, errors[] }`.

### New endpoint

```
POST /edge-api/v1/data/events/pull-from-central
{ "program": "...", "programStage": "...?", "orgUnit": "...",
  "startDate": "YYYY-MM-DD?", "endDate": "YYYY-MM-DD?" }

→ 200 { "runId", "imported", "ignored", "errors": [] }
→ 400 missing program/orgUnit
→ 502 Central returned a malformed payload
→ 503 Central unreachable
```

### Admin UI

`/data/events` gains a **Pull from Central** button next to Open
DHIS2 capture. Opens a modal dialog with program / stage / orgUnit
inputs + a date-range picker (both bounds optional). On submit:

- Busy indicator → import counts → deep-link to the resulting
  workflow run page.
- The browse auto-refreshes when the dialog closes so the pulled
  events show up immediately.

## 3. Files changed

```
admin-ui/src/screens/shared.tsx                              — dataModuleRouteForEntity,
                                                                dataModuleLabelForEntity
admin-ui/src/screens/MoreScreens.tsx                         — conflict detail Data
                                                                backlink button
server/.../workflows/aggregate/CentralDownloadService.java    — pullEvents(...)
server/.../web/DataModuleController.java                      — POST
                                                                /events/pull-from-central
admin-ui/src/api/edgeApi.ts                                  — PullEventsResult +
                                                                pullEventsFromCentral
admin-ui/src/screens/DataEvents.tsx                          — Pull from Central
                                                                action + modal
VERSION / server/pom.xml / admin-ui/package.json / sw.js     — 2.3.91
```

## 4. Verified

```
cd server   && mvn -q -DskipTests compile    ✓ clean
cd server   && mvn test \
       -Dtest='AggregateDataValueServiceTest,EventServiceTest'
                                             ✓ 22 pass / 0 fail
cd admin-ui && npx tsc --noEmit              ✓ clean
cd admin-ui && npm run build                 ✓ 2.3.91 bundle (788 ms)
```

## 5. Follow-ups

- **R-C/3.1** — Central-download for tracker (TEIs + enrolments +
  tracker events; probably `/api/trackedEntityInstances` on
  Central).
- **R-C/2.2** — Row-detail pages for aggregate / event / tracker
  (click row → full payload + journal history + sync retry log).
- Pick lists for the pull dialogs populated from the local mirror
  so admins don't have to paste UIDs.
- Scheduled pulls (cron-based CENTRAL_DOWNLOAD runs for programs
  with ongoing baseline refresh needs).
