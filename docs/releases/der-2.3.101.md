# der-2.3.101 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.100`

## Headline

**All three queued follow-ups from 2.3.98 shipped as one release.**
Per-row payload lineage drawer (R-K), workflow-run → outbound bundle
manifest (R-L), and capability-flag gating of binding kinds (R-M).
Admins can now trace any Data row to its exact DHIS2 payload + full
journal history, see every outbox entry a workflow run produced, and
only pick binding kinds Central actually supports.

## 1. R-K — Per-row payload lineage drawer

Three new server endpoints emit the single-row DHIS2 envelope + the
`operation_journal` history for one entity_ref:

```
GET /edge-api/v1/data/aggregate/{valueId}/payload
    → { endpoint: "/api/dataValueSets",
        payload: { dataValues: [one row] },
        journal: [...] }

GET /edge-api/v1/data/events/{eventId}/payload
    → { endpoint: "/api/events",
        payload: { events: [one row] },
        journal: [...] }

GET /edge-api/v1/data/tracker/tei/{teiUid}/payload
    → { endpoint: "/api/tracker",
        counts: { trackedEntities, enrollments, events },
        payload: {
          trackedEntities: [one TEI with attributes[]],
          enrollments:     [this TEI's enrolments],
          events:          [this TEI's stage events]
        },
        journal: [...  all three streams merged ...] }
```

New client component `PayloadLineageDrawer.tsx` mounts from a
**Lineage** button added to each Data table row (Aggregate, Events,
Tracker). Shows:

- target HTTP endpoint,
- the exact JSON Central would receive with a one-click `Copy JSON`,
- a per-attempt journal history table with state chip + attempt count
  + last error + updated-at.

For tracker, the drawer button only appears on rows with a resolved
TEI UID (TEI rows + enrolment/event rows that know their parent TEI).

## 2. R-L — Workflow-run outbound bundle manifest

New endpoint `GET /edge-api/v1/workflows/runs/{runId}/manifest`
returns the full outbound picture for one run:

```json
{
  "runId": "...",
  "total": 3,
  "countsByEntityType": { "TRACKED_ENTITY": 3 },
  "countsByState":      { "CENTRAL_ACCEPTED": 1, "IN_FLIGHT": 1, "CENTRAL_REJECTED": 1 },
  "operations": [
    { "operationId": "...", "entityType": "TRACKED_ENTITY",
      "entityRef": "SMOKE595788", "state": "CENTRAL_ACCEPTED",
      "attemptCount": 0, "endpoint": "/api/tracker",
      "lastError": null, "createdAt": "...", "updatedAt": "..." }
    …
  ]
}
```

A new `OutboundBundlePanel` lands at the bottom of
`WorkflowRunDetail` (route `/workflows/monitoring/runs/:runId`). Shows:

- chip strip with counts per entity type **and** per state (so admins
  spot "7 captured, 3 synced, 4 pending" at a glance),
- per-operation table where each state chip links directly to
  `/sync/attention/{operationId}` — closing the loop between workflow
  runs and the sync queue.

## 3. R-M — Capability-flag gating of binding kinds

`CompatSnapshotView` now carries `supportedBindingKinds` so the admin
UI's create-workflow dropdown only offers what Central can actually
handle:

```
GET /edge-api/v1/compat
→ capabilities.supportedBindingKinds:
    ["DATA_SET", "DATA_SET_SECTION", "DATA_ELEMENT",
     "PROGRAM", "PROGRAM_SECTION",
     "PROGRAM_STAGE", "PROGRAM_STAGE_SECTION",
     "TRACKED_ENTITY_TYPE", "TRACKED_ENTITY_ATTRIBUTE",
     "SYSTEM"]
```

DHIS2 2.44+ advertises the full catalogue. Pre-2.40 profiles get a
conservative subset (DATA_SET / DATA_ELEMENT / PROGRAM /
PROGRAM_STAGE / PROGRAM_STAGE_SECTION / TRACKED_ENTITY_TYPE / SYSTEM
— the long-standing kinds that stable Centrals have surfaced for
years).

Client (`EACoreScreens` workflow designer) fetches the capability
list once on mount, falls back silently to the full catalogue if
compat is unavailable, and filters the `<optgroup>` options
accordingly.

## 4. Live verification

```
# R-K (per-row payload lineage, TEI with 2 attrs)
GET /data/tracker/tei/RFFF095525/payload
                                          → endpoint /api/tracker
                                            counts {te:1, enr:0, ev:0}
                                            journal 1 entry
                                            attributes [{w75KJ2mc4zz:Fidelity},
                                                        {zDhUuAYrxNC:Patient}]

# R-L (manifest for a run with 3 operations)
GET /workflows/runs/11c272fe-.../manifest
                                          → total 3
                                            countsByEntityType {TRACKED_ENTITY:3}
                                            countsByState {CENTRAL_ACCEPTED:1,
                                                            IN_FLIGHT:1,
                                                            CENTRAL_REJECTED:1}

# R-M (profile detection + full kind list)
GET /compat
                                          → profile V2_44
                                            supportedBindingKinds [10 items]
```

## 5. Files changed

```
server/.../web/DataModuleController.java              — 3 per-row payload endpoints
server/.../web/CaptureWorkflowController.java         — manifest endpoint
                                                        + endpoint mapper
server/.../web/CompatibilityController.java           — supportedBindingKinds field
                                                        + profile-aware subset

admin-ui/src/api/edgeApi.ts                           — 3 row-payload fetchers
                                                        + workflowRunManifest()
                                                        + types
admin-ui/src/components/PayloadLineageDrawer.tsx      — NEW
admin-ui/src/screens/DataAggregate.tsx                — + Lineage column
admin-ui/src/screens/DataEvents.tsx                   — + Lineage column
admin-ui/src/screens/DataTracker.tsx                  — + Lineage column (TEI-only)
admin-ui/src/screens/workflow/WorkflowRunDetail.tsx   — OutboundBundlePanel
admin-ui/src/screens/EACoreScreens.tsx                — gated dropdown

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.101
```

## 6. Verified

```
cd server && ./mvnw test \
       -Dtest='DhisPeriodCodesTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest,
               CaptureWorkflowControllerTest'       ✓ 74/74
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.101 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.101.jar
java -jar target/der-server-2.3.101.jar              ✓ /system/health 200

GET /data/tracker/tei/RFFF095525/payload             ✓ full tracker envelope
GET /workflows/runs/.../manifest                     ✓ counts + 3 operations
GET /compat                                          ✓ supportedBindingKinds
```

## 7. Follow-ups queued for 2.3.102+

- Journal-aware filtering on the manifest panel ("show only operations
  in CONFLICT_REVIEW").
- Per-kind payload drawers for enrolment and event rows in the Tracker
  table (today only TEI rows open the drawer).
- Occurred-at date range picker on Events + Tracker (deferred from
  2.3.100).
- Live retry button on the manifest's per-operation table (routes to
  `/sync/attention/{opId}` currently; a one-click retry would skip
  the drill).
