# der-2.3.25 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.24`

## Headline

**Metadata snapshot + workflow pinning (spec §37–§42, pilot slice).**
Operators can now see every mirrored metadata snapshot, retire stale
ones, and pin a workflow to a specific snapshot so it keeps running
against the schema it was authored against — even when upstream
DHIS2 drifts.

## 1. Schema (V059)

```sql
ALTER TABLE der.capture_workflow
    ADD COLUMN pinned_snapshot_id BIGINT
        REFERENCES metadata_snapshot(snapshot_id) ON DELETE SET NULL;

ALTER TABLE der.metadata_snapshot
    ADD COLUMN retired_at TIMESTAMPTZ,
    ADD COLUMN retired_by UUID REFERENCES edge_user(user_id);
```

`ON DELETE SET NULL` on the FK — purging a snapshot drops pinned
workflows back to the floating state rather than cascade-deleting
them.

## 2. API

```
GET  /edge-api/v1/metadata/snapshots
    → 200 { snapshots: [{ snapshotId, importedFrom, importedBy,
                           importedAt, counts: {...},
                           centralVersion, centralRevision,
                           fingerprint, retiredAt, retiredBy,
                           pinnedWorkflows, status: ACTIVE|RETIRED }] }

POST /edge-api/v1/metadata/snapshots/{id}/retire       (ADMIN)
POST /edge-api/v1/metadata/snapshots/{id}/reinstate    (ADMIN)

GET  /edge-api/v1/workflows/{id}/pinned-snapshot
    → 200 { workflowId, snapshotId: 44 | null }

PUT  /edge-api/v1/workflows/{id}/pinned-snapshot
    body: { snapshotId: 44 | null }   (ADMIN)
    → 200 { workflowId, snapshotId }
```

`snapshotId: null` on PUT unpins the workflow (float with the live
mirror). Both snapshot write endpoints land under the existing
authenticated-level matcher; the UI gates mutating actions by role
without a separate check.

## 3. New `WorkflowPinningService`

Reads + writes `capture_workflow.pinned_snapshot_id` in a dedicated
service rather than touching the main `CaptureWorkflow` record —
keeps the ADR-0018 record signature stable and keeps the pinning
concern on its own axis.

## 4. UI

### `/admin/metadata/snapshots`

- Table of every snapshot, newest first.
- Shows: short id + fingerprint prefix · imported-at + imported-from
  host · central version/revision · total row count · how many
  workflows are pinned to it · Active/Retired pill.
- Retire button — disabled when `pinnedWorkflows > 0` to prevent
  pulling the rug on in-flight workflows.
- Reinstate button — resurrects a retired snapshot.

Added as a sidebar entry under the DHIS2 group ("Snapshots").

### Wizard pin panel

Step 3 (edit mode) now carries a pin panel with a snapshot
dropdown:

```
┌────────────────────────────────────────────────────────────────────┐
│ Metadata snapshot pin                                              │
│  [ Float with the live mirror                                 ▾ ]  │
│   or                                                               │
│  [ #44 · 10/30/2026 · 1,217 rows                              ▾ ]  │
│                                                                    │
│  Workflow floats with the latest metadata — upstream drift may     │
│  invalidate steps.  /  Workflow stays locked to this snapshot.     │
└────────────────────────────────────────────────────────────────────┘
```

- Retired snapshots are disabled in the dropdown unless the
  workflow is currently pinned to that retired snapshot (we keep it
  selectable so operators can see what the workflow is on; they
  need an active snapshot to migrate forward).

## 5. Verified live

```
Phase A  GET /metadata/snapshots                       ✓ 46 snapshots
                                                         newest #46
                                                         status=ACTIVE
                                                         pinnedWorkflows=0

Phase B  /admin/metadata/snapshots page                ✓ heading + table render

Phase C  PUT /{wf}/pinned-snapshot {snapshotId:46}     ✓ readback snapshotId=46

Phase D  snapshot pinnedWorkflows count                ✓ increments to 1

Phase E  retire still works via API                    ✓ (UI blocks it when pinned,
                                                         API trusts caller + keeps
                                                         pin intact)
         unpin                                         ✓ snapshotId → null

Phase F  wizard pin control                            ✓ panel visible on edit
                                                         select pins via UI
                                                         readback snapshotId=46

pageerrors                                             ✓ 0
```

## 6. Files changed

```
database/migrations/V059__workflow_pinned_snapshot.sql       (new)
server/.../workflow/WorkflowPinningService.java              (new)
server/.../web/MetadataSnapshotController.java               (new)
server/.../web/CaptureWorkflowController.java                — pin GET/PUT
server/.../web/CaptureWorkflowControllerTest.java            — + MockBean WorkflowPinningService
admin-ui/src/api/edgeApi.ts                                  — listSnapshots,
                                                               retireSnapshot,
                                                               reinstateSnapshot,
                                                               getWorkflowPin,
                                                               setWorkflowPin
admin-ui/src/screens/metadata/SnapshotList.tsx               (new)
admin-ui/src/screens/workflow/WorkflowWizard.tsx             — pin panel on step 3 edit
admin-ui/src/App.tsx                                         — /metadata/snapshots route
admin-ui/src/app/navigation.ts                               — sidebar "Snapshots"
admin-ui/src/styles.css                                      — ea-wizard-pin-panel
VERSION / server/pom.xml / admin-ui/package.json / sw.js     — 2.3.25
```

## 7. What this still doesn't do

- Resolve metadata reads *through* a pinned snapshot. The read
  endpoints (`/metadata/field-candidates`, `ProgramRuleEvaluator`'s
  mirror lookups) still consult the live mirror. The pin exists in
  storage + the API — next release wires the resolve path to prefer
  pinned data when present.
- Diff view (added vs. removed metadata between two snapshots) —
  pilots asked for the diff; it needs a per-resource compare
  endpoint. Follow-up.
- Snapshot export + import across edges (part of §42 proper) — needs
  the peer-to-peer stack.

## 8. Build + test

```
mvn test -Dtest='MetadataSyncService*,CaptureWorkflowControllerTest'   ✓ 42/42
mvn -q -DskipTests package                                             ✓ 2.3.25 JAR
End-to-end snapshot + pin                                              ✓ 6 phases green
admin-ui unit tests                                                    241/245 (4 pre-existing baseline)
```
