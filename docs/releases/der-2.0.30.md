# der-2.0.30 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.29`

## Headline

Two UX pushes:

1. **Merged DHIS2 Overview + Central connection into a single
   `/dhis2` hub.** Operators now get live status, inline edit
   and related-page tiles on one screen instead of bouncing
   between two.
2. **Pagination on the Metadata table.** The full dataset is
   reachable (previously the UI only showed the first 50 rows
   because the server defaults to `pageSize=50`). A reusable
   `TablePager` component was added so other screens can adopt
   the same pattern.

Also folded in: the single-row metadata toolbar from the
preceding iteration (resource dropdown + chip + search + count
on one 28px row above the table), carried into this release so
the hub + pager + toolbar ship together as one coherent UX cut.

## DHIS2 hub

### `admin-ui/src/screens/mockups/Dhis2Overview.tsx` (rewrite)

Single screen at `/dhis2` with:

- **Header** — H1 `DHIS2`, inline `Probe now` and `Save
  connection` buttons.
- **Live status strip (6 stats)** — Reachable · Central
  version · Profile · Probe RTT · Auth · Last probe.
- **Inline editable form** — three sections mirroring the old
  Central-connection screen:
  - Connection: Base URL, service account username / password,
    PAT token, connect timeout.
  - Compatibility: min / max supported version, probe mode,
    snapshot TTL, allow-mismatch flag.
  - Proxy: enabled, allow writes, allow-path prefixes.
- **Related tiles** — Organisation unit, Compatibility,
  Metadata, Metadata sync, Metadata drift, each linking into
  the matching DHIS2-group route and reflecting the live
  binding / drift state in the tile description.
- **Probe details** — compiled default URL, observed version,
  captured-at timestamp, probe reason.

### Route + navigation

- `/dhis2/connection` → `<Navigate to="/dhis2" replace />` so
  bookmarks and the deep-link from the earlier
  `data-test="dhis2-save"` flow still land somewhere sensible.
- DHIS2 sub-nav drops the "Connection" tab (set to
  `contextual` in `navigation.ts`). Tabs are now
  Overview · Organisation unit · Compatibility · Metadata.

### Interactivity

- `Probe now` fires `POST /edge-api/v1/compat/refresh` and
  refreshes the status strip and probe details in-place.
- `Save connection` writes the draft payload through
  `writeDhis2Connection`, shows a one-line success toast and
  re-reads the config so masked secrets stay masked.
- Related tiles use the existing `.ea-link-tile` hover motion.

## Pagination

### Shared `TablePager` component

New `TablePager` export in
`admin-ui/src/screens/mockups/shared.tsx`:

- Range label (e.g. `51–100 of 358`).
- Rows-per-page selector (25 / 50 / 100 / 200), optional.
- First / Prev / page-of-pages / Next / Last controls.
- Hides itself when `total === 0`.

### Metadata screen wired up

`admin-ui/src/screens/mockups/Metadata.tsx` now:

- Carries `page`, `pageSize`, `pageTotal`, `pageCount` state.
- Reads the server pager (`{page, pageSize, total, pageCount}`)
  on every list fetch and resets `page = 1` on resource or
  page-size change.
- Replaces the "Showing first 500" hack with the pager so the
  **full dataset is reachable**, not just the first 50 items.
- Toolbar count flips between "N items" (pager total) and
  "N matches on this page" (when a search filter is active).

### Compact pager + button sizing

`admin-ui/src/styles.css`:

- `.ea-table-footer` tightened to `6px / 2px`, 12px body,
  wraps gracefully on narrow screens.
- New `.ea-btn--sm` → 24px tall, 11px text, 8px horizontal
  padding — matches the dense table so the pager row stays
  flush.
- New `.ea-section-title` primitive for the hub's "Related" +
  "Probe details" headings (uppercase H2 + thin bottom border,
  no card).

## Live verification (all green)

### DHIS2 hub

| Check                            | Observed                                                  |
|----------------------------------|-----------------------------------------------------------|
| `/dhis2` title                   | `DHIS2`                                                   |
| hub `data-test` present          | yes                                                       |
| Header actions                   | `Probe now`, `Save connection`                            |
| Status-strip labels              | reachable · central version · profile · probe rtt · auth · last probe |
| Connection form present          | yes                                                       |
| Related-tile titles              | Organisation unit · Compatibility · Metadata · Metadata sync · Metadata drift |
| `/dhis2/connection` redirect     | → `/admin/dhis2`                                          |
| DHIS2 sub-nav tabs               | Overview · Organisation unit · Compatibility · Metadata   |
| `Probe now` wiring               | fires `POST /edge-api/v1/compat/refresh`                  |

### Metadata pager

| Check                                   | Observed              |
|-----------------------------------------|-----------------------|
| Pager visible                           | yes                   |
| Page-1 range label                      | `1–50 of 358`         |
| Rows on page 1                          | 50                    |
| Page-2 range label                      | `51–100 of 358`       |
| Rows on page 2                          | 50                    |
| Last-page range label                   | `351–358 of 358`      |
| After `pageSize=200`                    | `1–200 of 358`, 200 rows |
| Resource switch → TEA (54 rows)         | `1–54 of 54`, pager resets to page 1 |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.0.29/V229HUB-dhis2.png`,
`V229P-metadata-p1.png`, `V229P-metadata-p2.png`.

## Scope note

Only the Metadata screen is wired to `TablePager` in this
release. The shared component is now in place so Users / Sync
history / Queues / Metrics / Audit events can adopt it in a
follow-up pass without re-implementing paging state each time.
