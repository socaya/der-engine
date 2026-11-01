# der-2.3.57 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.56`

## Headline

**WorkflowForm polish — flat compact tables, hidden-sections tag,
balanced width, searchable metadata combo, red-asterisk mandatory
marker.** A sequence of UX refinements that bring the Workflow
record-management form in line with the rest of the DER admin.

## 1. Flat compact tables, three-tier hierarchy

Residual card/border/background noise cleaned up:

- Global `.ea-main tbody td` padding `5px` → `3px 8px`,
  line-height `1.45` → `1.35` (every admin table ~25 % denser).
- `.ea-table--dense` padding + font tightened to match.
- Workflow Steps + Fields tables fully flat: no header background,
  no cell borders, no per-row dividers inside the fields panel.
  Hairline divider between adjacent service-point rows only.
- Three distinct tints signal hierarchy:
    - level 0 (service point) — transparent
    - level 1 (section)       — `rgba(29,78,216,0.045)`
    - level 2a (parent fields)— `rgba(29,78,216,0.025)`
    - level 2b (section fields)— `rgba(29,78,216,0.055)`
  Progressive left-padding (28 / 32 / 60 px) adds visual indent.

## 2. Hide sections when parent is ticked

When an operator ticks a parent service point (Enrolment or Program
stage), the mutual-exclusion rule already clears its section
children. The Steps table now hides those section rows entirely
while the parent is included and shows a small info chip on the
parent row — `N sections hidden` — with a tooltip explaining
whole-parent capture + how to switch back. Unticking the parent
restores the section rows in their original order; any pre-existing
section field selections survive the round-trip.

## 3. Explicit dependency editor removed

Service-point ordering (↑ / ↓) + the implicit top-to-bottom chain
express every linear flow pilots currently need. The `+ Add
dependency` button + the whole `DependencyEditor` are gone. Save
payload always sends `explicitDependencies: undefined`; the server
still accepts the field for a future re-introduction (joins /
parallel branches / skipped predecessors).

## 4. Red-asterisk mandatory marker

Compulsory DHIS2 fields were a double-line hint ("Mandatory upstream
in DHIS2"). Collapsed to a single-line inline red `*` next to the
field name with the full explanation preserved as a tooltip +
`aria-label`.

## 5. Balanced width + standard content margins

- `.ea-form-card--wide` capped at **max-width: 1400 px** so the Steps
  table doesn't stretch past readable width on wide monitors.
- `.ea-form--flat .ea-form-section` padding `sp-5` → `sp-4` (16 px),
  drops to `sp-3` (12 px) on mobile — matches `.ea-main-inner`
  responsive padding so the Workflow form inherits the DER
  content-area margins without any override.

## 6. Searchable metadata combo

Picker collapsed from two fields (filter input + `<select>`) to a
single searchable combo input. `MetadataCombo` component:

- Shows the chosen display name when closed.
- Opens a filtered listbox on focus; narrows as the operator types.
- Keyboard: ↑ / ↓ moves the active option, Enter picks, Esc closes.
- Mouse: hover highlights, mousedown picks; chosen option bolded.
- `×` clear button resets the selection and reopens the search.
- Applies uniformly to aggregate datasets, event programs, and
  tracker programs.

## 7. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx   — MetadataCombo,
                                                    hidden-sections tag,
                                                    mandatory `*`,
                                                    dep editor removal,
                                                    hierarchical render
                                                    cleanup.
admin-ui/src/styles.css                          — tbody padding,
                                                    table--dense,
                                                    .ea-wf-* tier tints +
                                                    indents,
                                                    .ea-metadata-combo*,
                                                    form-card wide cap +
                                                    responsive section
                                                    padding.
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.57
```

## 8. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.57 bundle
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.57.jar
```

Pre-existing failures (unchanged by this release):
- `CaptureWorkflowRepositoryTest.upsertPersistsOwnerDeviceId` —
  mock predates V045 `section_kind` column.
- 3 CWF-01 RowMenu delete tests — predate the RowMenu refactor.

## 9. Follow-ups

- Wire `WorkflowCompiler` + `WorkflowRunCoordinator` to consume the
  per-field `ownerRole` / `ownerDeviceId` from V066 so field-level
  handover actually drives *My queue* routing.
- Drag-and-drop reorder as an alternative to ↑ / ↓.
- Re-introduce explicit `COMPLETES_BEFORE` edges as an advanced
  expander if pilot flows need joins / parallel branches.
