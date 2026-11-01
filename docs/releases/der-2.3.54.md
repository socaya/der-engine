# der-2.3.54 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.53`

## Headline

**WorkflowForm — hierarchical service points + flat full-width
layout.** Service points now expand to reveal their sections and
fields in-place; the inner-sidebar nav is removed in favour of a
straight stacked layout that uses the whole content area.

## 1. Hierarchical expand/collapse

Parent service points (Enrolment, Program stages, Datasets, Events)
are the only rows visible by default. Clicking the service-point
name toggles expansion:

- **Parent with children** (Enrolment → Demographics / Program Data,
  Stage → Stage sections) renders the nested child rows under the
  parent. Each child is independently tickable and expandable.
- **Leaf** (no children, e.g. a stage without stage sections)
  renders its field table directly below.
- **Parent ticked** (whole-parent capture) + has children → renders
  the children *and* the parent's own field table under them so
  operators can refine the capture after switching modes.
- **Order column** (`#` + ↑/↓) only on top-level rows; children
  travel with their parent during reorder.

Field tables now show on expand regardless of whether the row is
ticked, so operators can inspect data elements / TEAs before
committing. Selection persists across tick/untick.

Columns are now `Include | Service point | Role | Handover to (device) | Order`.
The *Fields* column and *Edit* / *Hide* button are gone — the
chevron handles expansion.

## 2. Flat full-width layout

The inner-sidebar nav (*Settings / DHIS2 target / Service points /
Handover / Metadata pin*) is removed. Operators were skipping the
rail entirely, and the right-side space was underutilised. The form
is now a single stacked column using the whole content area:

```
Settings
DHIS2 target
Service points
Handover
[Metadata pin, edit-mode only]
Cancel  [Save/Create]
```

CSS swap: `.ea-form-card--split` / `.ea-form--split` →
`.ea-form-card--flat` / `.ea-form--flat`. Section heads render
stacked above their content (not a 220/1fr grid column). Specificity
has to beat the base `.ea-main .ea-form-card form.ea-form` flex rule
and the `.ea-form-section` 220/1fr grid — same approach as the split
variant.

## 3. Fields editor — full behaviour vocabulary

The fields editor shipped in 2.3.53 is unchanged in structure
(three-column `.ea-table--dense`) but the Behaviour select now
exposes the full server-side vocabulary where the server supported
it: `REQUIRED` / `OPTIONAL` / `READONLY` / `HIDDEN`. `coerceReq()`
normalises legacy edit-mode payloads.

## 4. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx  — hierarchical render
                                                   (renderRow / renderFieldsPanel helpers),
                                                   flat layout (no nav rail),
                                                   fields visible on expand regardless
                                                   of include, Order column trails.
admin-ui/src/styles.css                          — .ea-form-card--flat / .ea-form--flat,
                                                   .ea-wf-steps-sp-expand chevron styling,
                                                   drop .ea-wf-steps-col-fields.
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.54
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.54 bundle
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.54.jar
```

## 6. Follow-ups

- Drag-and-drop reorder as an alternative to ↑ / ↓.
- Keyboard shortcut (Enter / Space) on the chevron to toggle.
- Server-side `/field-candidates` support for `ENROLLMENT_FORM` and
  `PROGRAM_SECTION` so the client doesn't go directly to the
  `/api/programs` and `/api/programSections` endpoints.
