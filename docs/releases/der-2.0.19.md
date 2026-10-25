# der-2.0.19 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.18`

## Headline

Metadata browser UX pass + Program rules folded in.

## Changes

### UI
- **Resource picker** — the 32-pill tab strip is replaced by a
  single labelled `<select>` dropdown. Option labels fold the
  mirrored count into the text (`Data elements — 358 items`,
  `Indicators — 32 items`, …). The picker sits in a card with a
  count chip and the DHIS2 `/api` resource name beside it.
- **First-row autofocus** — on every resource load the first row
  is auto-selected (`ea-row--active`) and the right drawer
  renders that row's full payload (name, resource, code,
  lastUpdated + full JSON blob). No more blank "Select a row…"
  state.
- **Program rules + actions folded into the browser** —
  dropped the standalone 'Program rules' sidebar entry and the
  DHIS2 Overview tile. Program rules are metadata and share the
  same mirror pipeline; they appear in the picker right after
  'Programs' as `Program rules — 388 items` and
  `Program rule actions — 393 items`.

### Backend
- `MetadataListController` gains `@GetMapping` paths for
  `/api/programRules` + `/api/programRuleActions` that stream
  from `der.metadata_program_rule` /
  `der.metadata_program_rule_action` (JSONB payload) in standard
  DHIS2 catalog shape. ORDER BY column picked per table
  (`display_name` for rules, `dhis2_uid` for actions).

## Verification

- 244 / 244 admin-ui tests passing.
- Live: 34 resource options in the picker.
- Live: `/api/programRules` → 388, `/api/programRuleActions` →
  393.
- Switching the picker to Program rules auto-selects
  `AHD: AHD CD4 ≤ 100 → fluconazole + LAM-TB pathway` and renders
  its full payload (incl. the `condition` expression) in the
  drawer.

Evidence:
- `docs/evaluation/evidence/alpha.31-metadata-picker/`
- `docs/evaluation/evidence/alpha.32-pr-merged/`
