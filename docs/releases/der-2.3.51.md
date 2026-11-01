# der-2.3.51 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.50`

## Headline

**WorkflowForm — vertical inner-sidebar layout + professional copy.**
The record-management form now puts section navigation in a left-side
rail instead of stacking long sections vertically; descriptive sub-copy
is rewritten short and scannable with no implementation-detail leakage
into user-facing text.

## 1. Inner-sidebar layout

The form card is now a two-column grid:

```
┌───────────────┬──────────────────────────┐
│ Settings      │ <active panel>           │
│ DHIS2 target  │                          │
│ Service points│                          │
│ Handover      │                          │
│ Metadata pin  │                          │
├───────────────┴──────────────────────────┤
│                     Cancel  [Save/Create]│
└──────────────────────────────────────────┘
```

- Left rail = scannable vertical nav; active item highlighted with the
  navy-700 brand colour; disabled when the section's prerequisites
  aren't met (e.g. Handover is disabled until at least one step is
  ticked).
- Right panel = exactly one section at a time; sections kept in the
  DOM with `hidden` so field state isn't lost when switching.
- Badges on *Service points* (step count) and *Handover* (explicit-
  rule count) so operators see at a glance how many are configured.
- Footer spans the full width and anchors Cancel + Save at the bottom
  of the card.
- Responsive: collapses to a horizontal strip on screens narrower
  than 900 px.

Default active section:
- Create mode → *DHIS2 target* (nothing to configure before binding).
- Edit mode → *Settings*.

## 2. Professional sub-copy

Previous copy was long, had inline-code leakage (`CaptureWorkflowStep.OwnerRole`),
unspaced phrases (`itsMy queue`), and over-explained the obvious.
Rewritten:

**Settings** — "Name, status and the default role/device for steps you
don't explicitly route elsewhere."

**DHIS2 target** — "What this workflow captures. Pick a type, then the
dataset or program to bind."

**Service points** — "Tick each service point the workflow should
cover. Set the role expected to capture it and the device that should
see it in *My queue*. Use ↑ / ↓ to put the steps in the order they
happen."

**Handover** — "Preview of how work flows between service points.
Each step opens when the one before it completes. Add explicit rules
only when the flow isn't linear — joins, parallel branches, or
skipped predecessors."

**Metadata pin** — "Freeze this workflow to a specific metadata
snapshot so upstream DHIS2 changes can't break it in the field.
Leave on *Follow live mirror* to track the current snapshot."

## 3. Repeats/Once badge → icon

The textual `Repeats` / `Once` chip beside the Kind column is replaced
by a single UiIcon:
- `refresh` (circular arrow) when the stage is repeatable.
- `event` (calendar tick) when the stage fires once per enrolment.

Icon carries the explanation as `title=` tooltip + `aria-label=` for
screen readers so the semantics stay accessible. Applied in both the
Steps table and the Handover flow preview.

## 4. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx   — nav rail + hidden panels,
                                                    activeTab state, rewritten sub-copy
admin-ui/src/styles.css                           — .ea-form-card--split,
                                                    .ea-form--split, .ea-form-nav*,
                                                    .ea-form-panel, .ea-form-footer--split,
                                                    responsive collapse @ 900 px
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.51
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.51 bundle
cd admin-ui && npm test -- --run        241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package ✓ der-server-2.3.51.jar
```

## 6. Follow-ups

- Validation on the left rail — show a dot/badge when a section has
  errors so operators know which section to revisit.
- Keyboard navigation across the rail (Up/Down + Home/End).
- "Previous / Next" buttons on the footer for linear create flow
  (keep rail for jump-navigation).
