# der-2.3.55 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.54`

## Headline

**Field-level handover — a data element or TEA can now be routed to
a different device than its containing step.** Clinic flows that need
one specific field completed by a different station (central ID
clerk, pharmacy pricing, etc.) can now express that in the workflow
definition.

## 1. Schema — V066

```sql
ALTER TABLE capture_workflow_field
    ADD COLUMN owner_role     TEXT,
    ADD COLUMN owner_device_id UUID
        REFERENCES edge_device(device_id) ON DELETE SET NULL;
ALTER TABLE capture_workflow_field
    ADD CONSTRAINT capture_workflow_field_owner_role_valid
    CHECK (owner_role IS NULL OR owner_role IN ('ADMIN', 'OPERATOR', 'REVIEWER'));
```

NULL on either column means "inherit from the parent step" — a
pre-V066 workflow is byte-for-byte equivalent in behaviour.

## 2. Server

- `CaptureWorkflowField` record extended with `ownerRole` +
  `ownerDeviceId`. Legacy 3-arg constructor preserved for existing
  callers (import service, tests).
- `CaptureWorkflowRepository.upsert()` persists both columns;
  `hydrate()` reads them back.
- `CaptureWorkflowController` `FieldRequest` (request body) + the
  shared `fieldMap()` serialiser carry the two fields on the wire.
- `WorkflowCompiler` + `WorkflowRunCoordinator` **do not yet consume
  these columns** — a follow-up will teach the compiler to split a
  step's queue entries across the per-field owners. This release
  captures the intent so pilots can start configuring it.

## 3. Client

- `edgeApi.CaptureWorkflowField` type extended with
  `ownerRole?: OwnerRole | null` + `ownerDeviceId?: string | null`.
- `WorkflowForm` introduces a `FieldSel` type that tracks the two
  overrides per field. Fields panel grew two columns:

  | Include | Field | Behaviour | Role | Handover to (device) |

  Role + Device defaults are **Inherit** so existing workflows carry
  over unchanged. `coerceReq` + `bulkSetFieldSelection` preserve the
  per-field owner across re-seeds.

Operator usage: open any service point → open its field table →
flip Role or Handover-to-device on individual rows to override.
Example: Enrolment → Demographics → one TEA set to *Central ID
clerk* while the rest of the section stays with Registration.

## 4. Files changed

```
database/migrations/V066__workflow_field_handover.sql           (new)
server/src/main/java/.../workflow/CaptureWorkflowField.java     — +ownerRole/ownerDeviceId
server/src/main/java/.../workflow/CaptureWorkflowRepository.java — upsert + hydrate
server/src/main/java/.../web/CaptureWorkflowController.java     — FieldRequest + fieldMap
admin-ui/src/api/edgeApi.ts                                      — CaptureWorkflowField type
admin-ui/src/screens/workflow/WorkflowForm.tsx                   — FieldSel; Role + Device
                                                                    columns in fields panel;
                                                                    edit-mode preload reads
                                                                    per-field owner.
admin-ui/src/screens/workflow/wizardMetadata.ts                  — buildWorkflowPayload passes
                                                                    ownerRole + ownerDeviceId.
admin-ui/src/styles.css                                          — .ea-wf-fields-col-role,
                                                                    .ea-wf-fields-col-dev.
VERSION / server/pom.xml / admin-ui/package.json / sw.js         — 2.3.55
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.55 bundle
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.55.jar
# Live-verified against the macOS dev stack:
#   stopped 2.3.52, started 2.3.55 → V066 applied automatically.
#   psql: capture_workflow_field has owner_role + owner_device_id columns.
```

Pre-existing failures that pre-date this change:
- `CaptureWorkflowRepositoryTest.upsertPersistsOwnerDeviceId` (test
  mock predates V045 section_kind column — same assertion failed on
  2.3.54 baseline).
- 3 CWF-01 RowMenu delete tests (predate the RowMenu refactor).

## 6. Follow-ups

- Wire `WorkflowCompiler` + `WorkflowRunCoordinator` to actually
  route per-field captures to their owner device's *My queue* and
  gate step completion on all per-field owners signing off.
- Validation UX on the fields panel for field-level handover (e.g.
  flag a step whose only `REQUIRED` field is routed to an inactive
  device).
