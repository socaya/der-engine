# der-2.3.15 (stable)

**Date:** 2026-10-31
**Previous stable:** `der-2.3.14`

## Headline

**Wizard-based editing.** Clicking an existing workflow in the list
now opens the guided wizard, pre-filled with the current metadata
binding, ticked breakables, device assignments, and roles. No more
UID copy-pasting to maintain a workflow.

## 1. New route layout

```
/workflows/:id            → WorkflowWizard  (new — edit mode)
/workflows/:id/advanced   → EACaptureWorkflowDesigner (power-user form)
/workflows/new            → WorkflowWizard  (unchanged — create mode)
```

Operators who want the raw form still get one tap from the wizard
("Prefer raw form? Open advanced designer").

## 2. Edit mode behaviour

On load (`/workflows/:id`):

1. `GET /workflows/:id` — fetches the current workflow.
2. `isWizardCompatible(w)` — if any step uses a sectionKind the
   wizard doesn't model (`AD_HOC`, `COC_SPLIT`, `TEI_ATTRIBUTE_GROUP`
   …), the UI redirects the operator to the advanced designer with
   an explainer. Otherwise:
3. `detectWorkflowType(boundMetadataKind, boundMetadataId)` — one
   DHIS2 metadata fetch resolves whether the binding is Aggregate,
   Event, or Tracker.
4. `listDataSetSections` / `listProgramStages` — fetches the
   breakables for that metadata.
5. **Prefill**: each breakable is matched against the workflow's
   existing steps by `sectionRef`. Ticked rows keep their original
   role and device assignment.
6. Breakables that no longer exist upstream (metadata changed since
   the workflow was authored) still appear as ticked rows labelled
   "(not in current metadata)", so operators notice and can prune
   them.

## 3. Fixes landed with this release

- **Default-ticked for small lists only.** Aggregate datasets usually
  have ≤ 6 sections — rows ship ticked. Tracker programs often have
  40+ stages — rows ship **unticked** so operators explicitly pick
  what to capture instead of hunting through a sea of pre-ticked
  checkboxes.
- **Functional `setRows` form.** Rapid successive updates (unticking
  many rows in a row) now accumulate correctly instead of
  overwriting from a stale closure. Was invisible when operators
  clicked one row at a time; surfaced when Playwright scripted bulk
  changes.
- **Breakables loader guarded in edit mode.** The step-3 effect that
  loads stages/sections now exits early when `workflowId` is set —
  the edit-prefill effect loads breakables and matches ticked rows
  in one atomic state update, so there is no race.
- **Rename-in-place.** Step 3 now shows the workflow name input in
  edit mode (operators previously had to go back to step 2, which
  isn't exposed on the edit path).

## 4. Verified live

Four-phase end-to-end sweep against local DHIS2 2.44:

```
Phase A  create via wizard                  ✓ 3 of 50 HIV stages ticked
                                              roles: OPERATOR, REVIEWER, OPERATOR
Phase B  edit mode prefill                  ✓ name repopulated
                                              3/50 ticked (sectionRef match)
                                              role 1 preserved REVIEWER
                                              "advanced designer" link rendered
Phase C  rename + role change + add step    ✓ v2 saved
                                              step 0 role→ADMIN
                                              step 3 added
                                              list redirect on save
Phase D  incompat fallback (AD_HOC step)    ✓ error block + "Open advanced" button
pageerrors                                  ✓ 0
```

## 5. Files changed

```
admin-ui/src/screens/workflow/WorkflowWizard.tsx       — edit mode
admin-ui/src/screens/workflow/wizardMetadata.ts        — detectWorkflowType,
                                                         fetchMetadataName,
                                                         isWizardCompatible
admin-ui/src/App.tsx                                   — /:id → wizard,
                                                         /:id/advanced → designer
admin-ui/src/App.test.tsx                              — new wizard route test
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.15
```

## 6. What this still doesn't do

Rolls forward from the 2.3.14 deferrals:

- Field-level selection within a section/stage (still emits
  `fields: []`).
- `PROGRAM_STAGE_SECTION` splitting on tracker (whole stage per
  step for now).
- Non-linear dependency topologies (still a strict chain — power
  users use the advanced designer).

## 7. Build + test

```
tsc -b && vite build                     ✓
mvn -q -DskipTests package               ✓ 2.3.15 JAR
admin-ui unit tests                      241/245 (4 pre-existing baseline
                                           failures unrelated to this diff)
End-to-end wizard-edit sweep             ✓ create → prefill → rename → save → fallback
```
