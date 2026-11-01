# der-2.3.50 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.49`

## Headline

**Workflow steps — reorderable + repeatable-stage aware.** Operators
can now define the clinic flow by moving steps up/down; the DHIS2
`repeatable` program-stage flag is visible on every stage row; and
the Dependencies section's intent is clear once reorder exists.

## 1. Reorder service points with ↑ / ↓

DHIS2 returns program stages / dataset sections in metadata order,
not clinic-flow order. The implicit top-to-bottom handover chain is
only useful if the operator controls the top-to-bottom order.

- New `moveStep(ix, direction)` in `WorkflowForm.tsx` swaps a
  top-level step with its neighbour, carrying nested
  `PROGRAM_STAGE_SECTION` children with it as a block so sections
  never end up orphaned above/below an unrelated stage.
- Up/down buttons appear in the `#` column under the step number for
  every top-level row; disabled on the first/last row.
- Nested stage sections show the step number inline (no controls)
  since they travel with their parent.
- Reorder changes the implicit chain only — explicit
  `COMPLETES_BEFORE` edges stay untouched.

## 2. Repeatable program-stage flag surfaced

DHIS2 tracks `repeatable` on each program stage — can it fire
multiple times per enrolment (e.g. visit) or exactly once (e.g.
enrolment / final outcome).

- `Breakable` gains an optional `repeatable: boolean` populated from
  the mirrored program-stage payload (`false` for dataset sections
  and event-instance placeholders).
- Steps table renders a second chip beside **Kind**:
  **Repeats** (info) / **Once** (neutral), with a tooltip spelling
  out per-enrolment semantics.
- `HandoverFlowPreview` mirrors the **Repeats** chip so the service-
  point chain shows which stations fire multiple times per client.
- Stage sections inherit their parent stage's flag.

## 3. Dependencies sub-copy explains what explicit rules add

Previous copy was ambiguous once reorder landed. New sub-copy on the
*Handover sequence · service-point flow* section:

> Default order is the row order above (reorder with ↑ / ↓ in the #
> column): each step opens once the one immediately above completes.
> **Explicit dependencies** override that default for non-linear
> flows — e.g. a step that must wait on *two* predecessors (join),
> a parallel branch that converges later, or a step that may open
> after any one of several earlier steps. If your flow is strictly
> top-to-bottom you don't need to add any rules here.

So the mental model is explicit:
- Linear flow → ↑/↓ reorder, no rules.
- Join (B & C → D) → add explicit `B → D` and `C → D` rules.
- OR-type opening (D after B *or* C) → broader explicit rules.
- Skip predecessor → explicit rule to bypass a row.

## 4. Files changed

```
admin-ui/src/screens/workflow/wizardMetadata.ts  — Breakable.repeatable;
                                                    pull `repeatable` from program-stage payload
admin-ui/src/screens/workflow/WorkflowForm.tsx   — moveStep + ↑/↓ controls in the # column;
                                                    second Kind chip (Repeats / Once);
                                                    HandoverFlowPreview Repeats chip;
                                                    rewritten Dependencies sub-copy
admin-ui/src/styles.css                           — .ea-wf-steps-ord-cell / .ea-wf-steps-ord-moves,
                                                    .ea-wf-steps-kind-cell, widened # + Kind columns
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.50
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.50 bundle
cd admin-ui && npm test -- --run        241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package ✓ der-server-2.3.50.jar
```

## 6. Follow-ups

- Flow preview should visualise explicit `COMPLETES_BEFORE` edges
  that deviate from the implicit top-to-bottom chain (currently only
  renders the linear sequence).
- Drag-and-drop reorder for faster chaining of long flows.
- Server-side filter support on `/api/programs` and
  `/api/programStages` so the client doesn't over-fetch.
