# der-2.3.49 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.48`

## Headline

**Workflow form — fields auto-included, service-point flow visible,
copy is domain-neutral.** Three UX follow-ups on top of 2.3.48 that
simplify first-time workflow configuration and make the multi-device
handover model obvious.

## 1. Auto-include every field on step tick

Previously ticking a step defaulted to zero fields selected; the
operator had to open the Fields editor and click **All** to actually
capture anything. On expand, only compulsory fields were pre-ticked.

Now:
- New `prefetchAllFields(ix)` eagerly loads field candidates when a
  step is ticked (via `updateRow`) and when the initial breakables
  load pre-ticks a small (≤6) step set.
- Every candidate seeds as `included: true`. `REQUIRED` is still
  reserved for `compulsory` fields; the rest default to `OPTIONAL`.
- `toggleExpand` seeding also defaults `included: true` so the editor
  shows the same state whether the operator opens it before or after
  ticking the row.

Operators can still open **Edit** on any step and click **None** to
narrow — the one-click configuration path just now starts from the
inclusive default.

## 2. Service-point handover flow is visible

The dependency/handover concept exists to model multi-station flows
owned by different devices (per-step owner device + role). The
previous "Dependencies" section didn't communicate that intent at
all. Now:

- Steps section renamed **Workflow steps · service points**; sub-copy
  spells out that each ticked row is a service point and the Handover-
  to column is the station that will see it in *My queue*.
- Column *Section / stage* → **Service point**.
- New **# (step number)** column shows a running ordinal for included
  rows (`#1`, `#2`, `#3`…), `—` for skipped rows.
- New section **Handover sequence · service-point flow** renders a
  visual flow chain under the heading — numbered chips showing
  *Service point → Role → Handover-to device* with arrows between
  them. Operators see the full flow at a glance.
- Explicit COMPLETES_BEFORE editor still available below the preview,
  but only when there are ≥2 steps; the preview itself handles the
  single-step case.

## 3. Copy is domain-neutral

Earlier sub-copy baked in a Registration → Triage → Consultation →
Lab → Pharmacy → Billing example and the name placeholder was
`e.g. Monthly ANC report`. Both were clinic-specific and don't belong
in a generic edge runtime UI. Service-point names now come entirely
from the chosen DHIS2 metadata + the devices registered on the edge;
the UI copy is domain-neutral.

## 4. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx    — prefetchAllFields,
                                                     #-column + service-point renames,
                                                     HandoverFlowPreview component,
                                                     domain-neutral copy
admin-ui/src/styles.css                            — .ea-wf-steps-col-order,
                                                     .ea-wf-steps-ord,
                                                     .ea-wf-flow + .ea-wf-flow-step*
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.49
```

## 5. Verified

```
cd admin-ui && npx tsc --noEmit         ✓ clean
cd admin-ui && npm run build            ✓ 2.3.49 bundle
cd admin-ui && npm test -- --run        241 passed, 4 pre-existing CWF-01 fails
cd server && mvn -q -DskipTests package ✓ der-server-2.3.49.jar
```

## 6. Follow-ups

- Allow re-ordering of service points by drag or up/down buttons so
  the top-to-bottom default sequence matches the operator's mental
  flow.
- Flow preview could visualise explicit COMPLETES_BEFORE edges that
  deviate from the default top-to-bottom order (currently only shows
  the implicit chain).
