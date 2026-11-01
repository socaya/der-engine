# der-2.3.56 (stable)

**Date:** 2026-11-01
**Previous stable:** `der-2.3.55`

## Headline

**WorkflowForm Steps + Fields tables — flat compact tabular design
matching the rest of DER.** Removes the card/box visuals, flattens
the kind icon, left-aligns every cell, and merges the Include
column with the step number so the table lines up with the Devices /
Users list idiom.

## 1. No cards, no boxes

The Steps + Fields tables were rendering as a sequence of soft
cards: the fields panel had its own raised background, the kind
icon sat in a bordered square, and the Order column was right-
aligned creating awkward whitespace.

- `.ea-wf-steps-table` + `.ea-wf-fields-table` border-collapsed with
  hairline row dividers only; no outer frames, no raised panel
  backgrounds.
- `.ea-wf-steps-kind-icon` flattened to a 16×16 glyph in text colour
  (no border, no filled background).
- `td:last-child {text-align:right}` dropped — every cell left-aligned.

## 2. Hierarchy via tint + indent

Rather than nesting cards, nested rows differentiate by:

- Subtle `rgba(29,78,216,0.04)` tint on section rows (`tr.is-nested`).
- Slightly darker tint on the fields panel `td`.
- Progressive left padding:
    - Top-level fields: 44 px.
    - Section fields: 66 px.
    - Section rows: chevron padded 22 px further than parents.

Operators scan the hierarchy at a glance without any boxing.

## 3. Include column → `#`

- Column header renamed `#` (width 64 px).
- Cell carries the checkbox *and* the step number inline. Step number
  only shows when the row is ticked (blank otherwise). The number
  comes from the running ordinal of included top-level rows.
- Trailing Order column shrank to 44 px and carries ONLY the ↑/↓
  reorder icon buttons on top-level rows (borderless, 18×18).

## 4. Explicit dependency editor removed

The *Add dependency* / `COMPLETES_BEFORE` editor that lived under
*Handover* is gone. Service-point ordering (↑/↓) + the implicit
top-to-bottom chain already express every linear flow operators
need in the field; the explicit edges editor was adding complexity
without a current use case. Dropped:

- `deps` / `depsTouched` state.
- Edit-mode preload of `w.dependencies`.
- `DependencyEditor` component + `DepRow` interface.
- `explicitDependencies` in the save payload is always `undefined`
  (server falls back to the implicit top-to-bottom chain).

If pilot flows later need joins / parallel branches / skipped
predecessors, a follow-up can re-introduce it as an advanced
expander — the server model still accepts the field.

## 5. Row height

Row heights drop from ~44 px to ~30 px. The Steps table now lands
in the same compact feel as the Devices / Users list tables.

## 6. Files changed

```
admin-ui/src/screens/workflow/WorkflowForm.tsx  — merge Include + step
                                                   number into a single
                                                   `#` cell; strip the
                                                   Order column label +
                                                   section indent class.
admin-ui/src/styles.css                          — rewrite .ea-wf-steps-table
                                                   + .ea-wf-fields-table rules:
                                                   flat border-collapsed, no
                                                   backgrounds on the fields
                                                   panel, left-aligned cells,
                                                   compact ord cell + numcell.
VERSION / server/pom.xml / admin-ui/package.json / sw.js — 2.3.56
```

## 7. Verified

```
cd admin-ui && npx tsc --noEmit             ✓ clean
cd admin-ui && npm run build                ✓ 2.3.56 bundle
cd admin-ui && npm test -- --run            241 passed, 4 pre-existing fails
cd server && mvn -q -DskipTests package     ✓ der-server-2.3.56.jar
```

## 8. Follow-ups

- Wire `WorkflowCompiler` + `WorkflowRunCoordinator` to consume the
  per-field `ownerRole` / `ownerDeviceId` from V066 so field-level
  handover actually drives My queue routing (schema + UI landed in
  2.3.55).
- Drag-and-drop reorder as an alternative to ↑/↓.
