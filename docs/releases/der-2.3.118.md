# der-2.3.118 (stable)

**Date:** 2026-11-02
**Previous stable:** `der-2.3.117`

## Headline

**Metadata detail page professional.** Tabs, Relationships and Rules
now use the DER UI primitives (DrawerTabs with aria + numeric
badges, standard tables, JsonViewer). Relationships are drillable
end-to-end — click any UID to open the referenced record in the
Metadata browser.

## 1. R-AO — Metadata detail polish

### Tabs

**Before**: bespoke `<button>` strip with `ea-section-tab` class.
No `role=tablist`, no `aria-selected`, no numeric badges. Counts
printed inline as parenthetical text ("Relationships (11)").

**After**: switched to shared `DrawerTabs` from `shared.tsx`.

- `role="tablist"` + `aria-selected` on each tab.
- Numeric badges render as styled pills next to the label — active
  pill flips to primary blue, inactive stays muted. Count omitted
  when zero.
- Keyboard + screen-reader behaviour matches every other DER
  drawer (Sync History op detail, workflow run detail, etc.).

### Relationships

**Before**: bullet list with `field: UID — Name`. Not drillable;
plain text.

**After**: proper table (`ea-table ea-table--dense`) with four
columns:

| Field | Name | UID | ↗ |
|---|---|---|---|

- **Field** — ink-500 label (same style as the Summary rows).
- **Name** — the displayName from the mirrored record; muted
  italic "—" when absent.
- **UID** — monospace. Rendered as a labelled `<Link>` to
  `/dhis2/metadata/<targetResource>/<uid>` when the field is
  recognised. Not every DHIS2 field name maps cleanly to a resource
  (unknown kinds render plain text).
- **↗** — a one-glyph "open in Metadata browser" shortcut.

Twenty-six known ref kinds mapped (dataElement, dataSet, program,
programStage, programStageSection, trackedEntityType,
trackedEntityAttribute, organisationUnit, parent, optionSet,
option, legendSet, indicator, indicatorType, programIndicator,
validationRule, programRule, programRuleVariables, user, userGroup,
userRole, categoryCombo, categoryOption, categoryOptionCombo, …)
via `resourceForRef()`. Unknown kinds still show the UID; just not
drillable.

Twelve DHIS2 fields extracted directly (`categoryCombo`,
`trackedEntityType`, `program`, `programStage`, `dataSet`,
`optionSet`, `legendSet`, `organisationUnit`, `parent`,
`indicatorType`, `dataElement`, `trackedEntityAttribute`) + ten
array fields (`programStages`, `dataElements`, `organisationUnits`,
`trackedEntityAttributes`, `programIndicators`,
`programTrackedEntityAttributes`, `programStageSections`,
`categoryOptions`, `options`, `userGroups`). Arrays cap at 10 rows
plus a "…N more" footer entry.

### Rules

**Before**: bullet list `Kind: expression`. Monospace wrapped
awkwardly for long rule expressions.

**After**: two-column table:

| Kind | Expression |
|---|---|

- **Kind** — chip (`ea-chip--neutral`) so Condition / Expression /
  Left / Right / NG action types / … are visually distinct.
- **Expression** — rendered inside a bordered monospace `<pre>` with
  word-wrap + 4-px padding, so long rule expressions stay readable
  without horizontal scroll.
- Empty expressions render as muted "(empty)" rather than a blank
  row.

### Raw JSON

**Before**: `<pre>` tag with hand-rolled sizing. No copy button.

**After**: DER's shared `<JsonViewer>` component.

- Syntax-coloured collapsible tree.
- Copy JSON button in the header.
- Label shows "<Type> · <UID>" so operators know which record the
  payload belongs to.

## 2. Live verification

```
GET /system/health                               → 200
GET /admin/dhis2/metadata/dataElements/<uid>
  tabs: Summary · Relationships (11) · Rules · Raw JSON
  tabs render via DrawerTabs with aria-selected + numeric badges
  Relationships table: 11 rows, each UID clickable → opens the
    referenced record in /dhis2/metadata/<resource>/<uid>
  Rules table: chip-labelled kinds, wrapped expressions
  Raw JSON: syntax-coloured + Copy JSON button
tsc --noEmit                                      → clean
cross-module lint                                 → clean (intra-module)
```

## 3. Files changed

```
admin-ui/src/screens/Metadata.tsx                — DrawerTabs for tabs
                                                 + Relationships table
                                                   with drillable UIDs
                                                 + Rules table with chip
                                                   + wrapped expressions
                                                 + JsonViewer for Raw
                                                 + resourceForRef()
                                                   mapper (26 refs)
                                                 + RelRef.targetResource

VERSION / server/pom.xml / admin-ui/package.json / sw.js  — 2.3.118
```

## 4. Follow-ups queued

- The Summary tab's `TypeSpecificSummary` could render `ref` fields
  as clickable Links too (currently plain text). Low priority — same
  info reachable via the Relationships tab.
- Lazy-fetch missing names via the metadata mirror. Today an item
  in an array ref only shows displayName if DHIS2 included it in the
  parent payload; some mirror responses truncate.
- Highlight recently-updated fields in the Summary (diff against
  prior snapshot) — only useful once we persist historical versions.
