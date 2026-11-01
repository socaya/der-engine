# der-2.3.46 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.45`

## Headline

**Workflow module UI cleanup — record-management flow, no wizard.**
Replace the six-tab wizard with a single flat admin form, fix the
device-scope filter on the queue, and strip verbose subtitles across
the Workflow / Snapshots / Approvals / Referral screens to match the
rest of the admin surface.

## 1. Wizard → flat form

`admin-ui/src/screens/workflow/WorkflowWizard.tsx` is removed.
`WorkflowForm.tsx` is a single-page record-management screen that
handles both create and edit on the same route:

```
/workflows/new           → WorkflowForm (create)
/workflows/:id           → WorkflowForm (edit)
/workflows/:id/advanced  → WorkflowDesignerRoute (unchanged escape hatch)
```

Sections, top-to-bottom:

1. Workflow — name, status, approval, default device
2. Target — type + metadata picker
3. Steps — included set + per-step owner device / role + field selector
4. Dependencies — COMPLETES_BEFORE edges
5. Metadata pin — only in edit mode
6. Save

No stepper, no tabs, no "next" / "back" cues. All state logic from the
old wizard is preserved; only the chrome changed.

## 2. My work (queue) — fixes the device scope filter

Previous bug: when the user picked "All devices" (empty value), the
UI passed `undefined` to the queue API, which let the server fall back
to the saved `workflow.preferredDeviceId`. The chip said "scoped by
explicit filter" but the server was auto-applying the saved
preference.

Fix: pass `allDevices: true` explicitly when the user picks the empty
option. Device dropdown is now a plain `<select>` labelled "Device"
with "All devices" + per-device options.

Also removed:
- the "● live / ○ polling" StreamBadge
- the verbose subtitle about live stream + 60-second poll
- the explanatory scope-source hint
- unused `scopeSource` / `appliedDevice` / `allDevices` state

Server comment on `CaptureWorkflowController.filterRowsByDevice`
updated to spell out the strict semantics: shared-pool steps
(`ownerDeviceId=null`) pass through unconditionally; only
different-device steps get filtered out.

## 3. Subtitle sweep

Verbose per-screen subtitles removed, matching the der-2.1.64 /
der-2.1.65 KPI-strip stripping across other sub-modules:

| Screen | Removed |
|---|---|
| Workflow queue (My work) | "Workflow steps that are ready to capture… 60-second safety-net poll" |
| Workflow peers | "Register other DER edges… Pushing POSTs the canonical JSON" |
| Workflow inbox | "Workflow definitions peers have pushed to this edge…" |
| Snapshot list | "Each DHIS2 metadata sync lands as a snapshot…" |
| Snapshot diff | "Added, removed and changed metadata UIDs between two syncs" |
| Pending approvals | "Operations awaiting a reviewer's sign-off…" |
| Referral inbox | "Pending referrals discovered on central addressed to…" |
| Run validation | collapsed into the heading as `Validation · <runId>` |

Field hints under peer-form (`Dedicated ADMIN user on the remote
edge`) also dropped.

## 4. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx          (new — replaces wizard)
admin-ui/src/screens/workflow/WorkflowWizard.tsx        (removed)
admin-ui/src/screens/workflow/WorkflowQueue.tsx         — scope filter + copy
admin-ui/src/screens/workflow/WorkflowPeers.tsx         — copy
admin-ui/src/screens/workflow/WorkflowImportInbox.tsx   — copy
admin-ui/src/screens/workflow/RunValidation.tsx         — copy
admin-ui/src/screens/metadata/SnapshotList.tsx          — copy
admin-ui/src/screens/metadata/SnapshotDiff.tsx          — copy
admin-ui/src/screens/EACoreScreens.tsx                  — copy (approvals + referral)
admin-ui/src/App.tsx                                    — WorkflowForm route
admin-ui/src/App.test.tsx                               — mock + routing test
server/.../web/CaptureWorkflowController.java           — scope-filter comment
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.46
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit        ✓ clean
cd admin-ui && npm run build           ✓ 2.3.46 bundle
cd admin-ui && npm test -- --run       241 passed, 4 pre-existing fails
                                        (CWF-01 row-menu delete — same before/after)
cd server && mvn -q -DskipTests package ✓ der-server-2.3.46.jar
```

## 6. Follow-ups

- Fix the 4 pre-existing CWF-01 delete tests (RowMenu now gates the
  delete button; tests predate the row-menu refactor).
- Validate the WorkflowForm against the metadata-driven flow end-to-end
  on the dev DHIS2 pilot once an ADMIN session is seeded.
