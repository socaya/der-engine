# der-2.1.54 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.53`

## Headline

Three review notes addressed:

1. **Row context menu was hidden** behind the table container's clip
   on screens like `/sync/metadata` — fixed by lifting the clip.
2. **Metadata pull detail now shows the complete inventory**, not
   just a 3-key summary. All 10 mirrored metadata collections are
   rendered, every record included.
3. Mirror-type labels humanised (`Organisationunits` → `Organisation
   units`).

## Changes

### Row menu overflow (fixes all list screens)

- `.ea-table-wrap` switched from `overflow-x: auto` to
  `overflow: visible`. The RowMenu `<details>` popover anchored to
  the `⋮` kebab in each row's last column now escapes the table
  container and renders in full, instead of being clipped at the
  table's bottom edge.
- Verified on `/sync/metadata` (Recent pulls, single row) where the
  dropdown was previously invisible.

### Metadata pull detail — `/sync/history/:runId` for `METADATA_SYNC_FULL`

- `metadataInventory()` API expanded from a 4-type / 5-record sample
  into a full-mirror fetcher covering **10 metadata collections**:
  Organisation units · Programs · Program stages · Data elements ·
  Data sets · Tracked entity types · Tracked entity attributes ·
  Option sets · Category combos · Program rules. Each uses the
  DHIS2 Web API emulation at `/api/*` with `pageSize=1000`.
- Each collection is now rendered as a collapsed `<details>` card
  showing its record count on the right. Click to expand and
  inspect the full `JsonViewer` tree of all records in that
  collection — the previous "First 5 shown" sample is gone.
- Panel renamed from "Sample records" → **"Records"** to match the
  "all records" semantics.
- `mirrorCountLabel()` helper fixes raw camelCase keys from
  `/edge-api/v1/metadata/diagnostics` into friendly labels. The
  Metadata inventory table now reads:

| Metadata type | Records |
|---|---|
| Organisation units | 484 |
| Data elements | 358 |
| Data sets | 0 |
| Programs | 31 |
| Tracked entity types | 1 |

## Live assertions (all green)

Playwright-swept the Metadata pull detail page against a running
local DER (DHIS2 2.44 central):

- All 10 collections present in the Payload tab body
- Record counts per collection (observed):
  - Organisation units 484
  - Programs 31
  - Program stages 76
  - Data elements 358
  - Data sets 0
  - Tracked entity types 1
  - Tracked entity attributes 54
  - Option sets 87
  - Category combos 1
  - Program rules 388
- Row menu on `/sync/metadata` opens and is fully visible

Screenshots in `/tmp/der-meta-all/`.
