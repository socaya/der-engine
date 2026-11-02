# der-2.3.98 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.97`

## Headline

**Workflow bindings now cover every DHIS2 capture-form object, and
the "Ready for Central" preview emits the exact wire shape Central
accepts.** Operators can define workflows against DataSet / DataSet
Section / Data Element on the aggregate side, and Program / Program
Section / Program Stage / Program Stage Section / Tracked-Entity Type
/ Tracked-Entity Attribute on the tracker side. The tracker preview
now carries attributes, data values, and incident dates — identical
to what the sync worker POSTs.

## 1. R-F/binding-kinds — complete capture-form coverage

New migration `V080__extend_tracker_binding_kinds.sql` replaces the
`capture_workflow.bound_metadata_kind` CHECK with:

```
'DATA_SET',  'DATA_SET_SECTION', 'DATA_ELEMENT',
'PROGRAM',   'PROGRAM_SECTION',
'PROGRAM_STAGE', 'PROGRAM_STAGE_SECTION',
'TRACKED_ENTITY_TYPE', 'TRACKED_ENTITY_ATTRIBUTE',
'SYSTEM'
```

New kinds added: **DATA_SET_SECTION, DATA_ELEMENT, PROGRAM_SECTION,
TRACKED_ENTITY_TYPE, TRACKED_ENTITY_ATTRIBUTE**. V073's four kinds
plus the SYSTEM sentinel remain.

Threaded through:
- `CaptureWorkflow.BindingKind` Java enum.
- `WorkflowCompiler` switch — DATA_* roll into `compileDataSet`;
  PROGRAM_* / TRACKED_ENTITY_* roll into `compileProgram`.
- `WorkflowRunCoordinator.entityTypeFor()` — aggregate-side kinds
  → `AGGREGATE_DATA_VALUE`; PROGRAM / PROGRAM_SECTION /
  TRACKED_ENTITY_* → `TRACKED_ENTITY`; PROGRAM_STAGE / section →
  `PROGRAM_STAGE_EVENT`.
- `CaptureWorkflowController.sectionKindCompatibleWith()` —
  section-kind validation extended for each new binding so operators
  can't attach incompatible section kinds (e.g. a `COC_SPLIT` under
  a `TRACKED_ENTITY_ATTRIBUTE` binding).
- Admin UI create-form dropdown gets an `<optgroup>` split with the
  10 options, and each Data screen's `WorkflowPicker` filters the
  catalogue by the relevant subset.

## 2. R-F/tracker-fidelity — full DHIS2 wire shape in preview

`/edge-api/v1/data/tracker/payload` was emitting bare row stubs. It
now matches `ReferralPayloadEncoder.shapeForCentral()` output
byte-for-byte:

```json
{
  "trackedEntities": [{
    "trackedEntity": "...", "trackedEntityType": "...", "orgUnit": "...",
    "attributes": [ {"attribute":"<uid>", "value":"..."}, ... ]
  }],
  "enrollments": [{
    "enrollment": "...", "trackedEntity": "...", "program": "...",
    "orgUnit": "...", "status": "...",
    "enrolledAt": "...", "occurredAt": "..."   // (incident_date)
  }],
  "events": [{
    "event": "...", "enrollment": "...", "program": "...",
    "programStage": "...", "orgUnit": "...", "status": "...",
    "occurredAt": "...",
    "dataValues": [ {"dataElement":"<uid>", "value":"..."}, ... ]
  }]
}
```

Server-side changes:
- Tracker SELECTs now pull `tracked_entity.attributes`,
  `edge_enrollment.incident_date`, `edge_tracker_event.data_values`.
- Two new helpers `jsonbToAttrArray` / `jsonbToDvArray` convert
  JSONB `{uid: value}` → `[{attribute, value}, ...]` /
  `[{dataElement, value}, ...]` matching the encoder's output.

## 3. Live verification

Server up at `der-server-2.3.98`, Central at
`http://localhost:8080/dhis`:

```
# V080 applied
Flyway: Successfully applied 1 migration to schema "der",
         now at version v080

# CHECK constraint carries all 10 kinds
pg_get_constraintdef → bound_metadata_kind IN
    (DATA_SET, DATA_SET_SECTION, DATA_ELEMENT, PROGRAM,
     PROGRAM_SECTION, PROGRAM_STAGE, PROGRAM_STAGE_SECTION,
     TRACKED_ENTITY_TYPE, TRACKED_ENTITY_ATTRIBUTE, SYSTEM)

# New kind accepted by /workflows
POST /edge-api/v1/workflows
  { boundMetadataKind: "TRACKED_ENTITY_ATTRIBUTE", ... }
                                             → HTTP 200
                                               workflowId=058cc778-...

# Tracker payload now carries attributes[]
POST /edge-api/v1/tracked-entities  (RFFF095525 + 2 attrs)
GET  /edge-api/v1/data/tracker/payload?workflowRunId=...
                                             → trackedEntities[0]
                                               .attributes = [
                                                 {attribute:w75KJ2mc4zz,
                                                  value:Fidelity},
                                                 {attribute:zDhUuAYrxNC,
                                                  value:Patient}
                                               ]
```

## 4. Files changed

```
database/migrations/V080__extend_tracker_binding_kinds.sql    — NEW

server/.../workflow/CaptureWorkflow.java                      — + 5 kinds
server/.../workflow/WorkflowCompiler.java                     — switch exhaust
server/.../workflow/WorkflowRunCoordinator.java               — switch exhaust
server/.../web/CaptureWorkflowController.java                 — section-kind
                                                                compatibility
server/.../web/DataModuleController.java                      — tracker SELECT
                                                                attributes/dv
                                                                + jsonb helpers

admin-ui/src/api/edgeApi.ts                                   — enum (×2)
admin-ui/src/components/WorkflowPicker.tsx                    — boundKind opt
admin-ui/src/screens/DataAggregate.tsx                        — kinds[] widened
admin-ui/src/screens/DataEvents.tsx                           — kinds[] widened
admin-ui/src/screens/DataTracker.tsx                          — kinds[] widened
admin-ui/src/screens/EACoreScreens.tsx                        — create-form
                                                                dropdown
                                                                optgroup split

VERSION / server/pom.xml / admin-ui/package.json / sw.js      — 2.3.98
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
                                                     ✓ 2.3.98 bundle
cd server   && ./mvnw -DskipTests package            ✓ der-server-2.3.98.jar
java -jar target/der-server-2.3.98.jar               ✓ V080 applied
                                                     ✓ /system/health 200
POST /workflows (TEA binding)                        ✓ accepted
GET  /data/tracker/payload                           ✓ attributes[] emitted
```

## 6. Follow-ups queued for 2.3.99

- Row-level payload lineage drawer (deferred from 2.3.98's R-F).
- Workflow-run → outbound bundle manifest, closing the loop with
  `/sync/data` so admins see each operation_id a run will produce.
- A capability-flag gate: when Central's `/api/schemas` doesn't
  advertise `programSection`, hide that option in the create-form
  dropdown rather than letting operators save an unreachable binding.
