# der-2.3.97 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.96`

## Headline

**The Data module is now workflow-driven and payload-aware.**
Every Data screen can be scoped to a workflow definition (not just a
specific run), and a new "Ready for Central" drawer shows the exact
DHIS2 2.44-shaped envelope the sync worker will POST next — the Data
module *compiles the workflow-captured rows and aligns them to the
Central data models*, for all three types (aggregate, events, tracker).

## 1. R-E/workflow-filter — ?workflowId= across Data endpoints

Each of the three browse endpoints gains a `workflowId` query
parameter alongside the existing `workflowRunId`:

```
GET /edge-api/v1/data/aggregate?workflowId=<uid>
GET /edge-api/v1/data/events?workflowId=<uid>
GET /edge-api/v1/data/tracker?workflowId=<uid>
```

Semantics: match any row whose `workflow_run_id` belongs to a run of
the named workflow definition. Implemented via the existing
`capture_workflow_run` join (`AND cwr.workflow_id = ?::uuid`).

The admin UI reads the param from the URL and renders a
`ScopedFilterChip` tying the browse back to the workflow definition
page. A `WorkflowPicker` component in each Data screen's filter row
calls `GET /edge-api/v1/workflows`, filters by the appropriate
`boundMetadataKind` (DATA_SET for aggregate; PROGRAM / PROGRAM_STAGE
for events + tracker) and updates `?workflowId=` on change.

## 2. R-E/payload-preview — "Ready for Central"

Three new endpoints emit the DHIS2 envelope the sync worker will
POST next, scoped to a workflow definition (or a specific run):

```
GET /edge-api/v1/data/aggregate/payload?workflowId=<uid>
    → { endpoint: "/api/dataValueSets", payload: { dataValues: [...] } }

GET /edge-api/v1/data/events/payload?workflowId=<uid>
    → { endpoint: "/api/events",       payload: { events: [...] } }

GET /edge-api/v1/data/tracker/payload?workflowId=<uid>
    → { endpoint: "/api/tracker",      payload: {
          trackedEntities: [...], enrollments: [...], events: [...] } }
```

Each returns `count`, the target `endpoint`, and the exact JSON body.
Only rows whose latest `operation_journal` state is unset / `PENDING`
/ `RETRYABLE` are included — i.e. "what the next drain tick will
push". If both `workflowId` and `workflowRunId` are blank the
endpoint fails fast with `WORKFLOW_SCOPE_REQUIRED`.

A new `CentralPayloadDrawer` component mounts from each Data screen's
header ("Ready for Central" button). It shows:

- the target HTTP endpoint and method,
- the ready-to-sync count (and per-kind counts for tracker),
- the full JSON envelope with a `Copy JSON` button for ops replay.

Empty-state (nothing ready to push) renders a muted message rather
than an empty blob, so admins can tell "already synced" apart from
"load failed".

## 3. Live verification

Server up at `der-server-2.3.97`, Central at
`http://localhost:8080/dhis`, DHIS2 2.44-SNAPSHOT:

```
POST /edge-api/v1/tracked-entities         →  TEI SMKR093506
GET  /edge-api/v1/data/tracker/payload
       ?workflowRunId=11c272fe-...         →  count=1
                                              payload: {
                                                 trackedEntities: [{
                                                   trackedEntity: SMKR093506,
                                                   trackedEntityType: mxs9pVJzjeG,
                                                   orgUnit: nKz5rXN02cd
                                                 }],
                                                 enrollments: [],
                                                 events: []
                                              }
```

Guard also live-verified: `/aggregate/payload` with no scope → `400
WORKFLOW_SCOPE_REQUIRED`.

## 4. Files changed

```
server/.../web/DataModuleController.java              — + workflowId filter
                                                        + 3 payload endpoints
                                                        + selectReady() helper

admin-ui/src/api/edgeApi.ts                           — workflowId opt + 3
                                                        preview fetchers
admin-ui/src/components/WorkflowPicker.tsx            — NEW
admin-ui/src/components/CentralPayloadDrawer.tsx      — NEW
admin-ui/src/screens/DataAggregate.tsx                — picker + chip + drawer
admin-ui/src/screens/DataEvents.tsx                   — picker + chip + drawer
admin-ui/src/screens/DataTracker.tsx                  — picker + chip + drawer

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.97
```

## 5. Verified

```
cd server && ./mvnw test \
       -Dtest='CaptureWorkflowControllerTest,
               ReferralPayloadEncoderTest,
               TrackerServiceTest,
               JournalPublisherTest'                 ✓ 52/52
cd admin-ui && npx tsc --noEmit                      ✓ clean
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
                                                     ✓ 2.3.97 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.97.jar
java -jar target/der-server-2.3.97.jar               ✓ /system/health 200
curl /edge-api/v1/data/tracker/payload               ✓ live envelope OK
```

## 6. Follow-ups queued for 2.3.98 (R-F)

- Per-row payload lineage drawer: show the single-row DHIS2 payload
  + the operation_journal history for one entity_ref.
- Workflow-run → bundle manifest: given a run id, list the operation
  IDs that will carry its rows to Central (so the manifest closes
  the loop with /sync/data).
- Smoke script extensions: `scripts/smoke/aggregate_payload.sh` and
  `scripts/smoke/events_payload.sh` to assert the preview matches
  what the sync worker actually pushes.
