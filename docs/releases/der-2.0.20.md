# der-2.0.20 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.19`

## Headline

Metadata browser coverage now matches the DHIS2
metadata-management surface — 45 resources, up from 34.

## Changes

### Backend
- `MetadataListController.dedicatedList()` extended to stream
  three more dedicated mirror tables in the standard DHIS2 catalog
  shape:
  - `/api/trackedEntityAttributes` → `der.metadata_tracked_entity_attribute`
  - `/api/programStages` → `der.metadata_program_stage`
  - `/api/categoryOptionCombos` → `der.metadata_category_option_combo`
- `MetadataSyncService.CATALOG_RESOURCES` adds 8 reporting /
  analytics / entry collections — `sqlViews`, `dashboards`,
  `visualizations`, `reports`, `maps`, `eventReports`,
  `eventCharts`, `dataEntryForms`.
- Matching `/api/{resource}` + `/api/{resource}/{uid}` paths added
  to the catalog `@GetMapping` lists.

### Admin UI
- Metadata picker gains 11 resources, grouped by domain:
  - Programs block gets `Program stages` right after Programs.
  - Tracker block gets `Tracked entity attributes` next to
    Tracked entity types.
  - Category block gets `Category option combos`.
  - New reporting block at the bottom: SQL views, Dashboards,
    Visualizations, Event reports, Event charts, Reports, Maps,
    Data entry forms.
- Total resource options: **45** (was 34).

## Verification

- Live Mauritius 2.44-SNAPSHOT:
  - `trackedEntityAttributes` **54** · `programStages` **76** ·
    `categoryOptionCombos` **1** · `sqlViews` **10**. The seven
    reporting collections are empty on the demo instance; sync
    pipeline + emulator paths wired so any DHIS2 that exposes
    them mirrors on the next run.
  - Picker shows 45 options; drawer autofocuses the first row of
    each resource (`ART number` for TEAs, `ART enrollment and
    initiation` for program stages).
- 244 / 244 admin-ui tests passing.

Evidence: `docs/evaluation/evidence/alpha.34-full-metadata/`.
