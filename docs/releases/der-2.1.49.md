# der-2.1.49 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.48`

## Headline

Data module polished to the Sync house style. All 6 Data screens now
use the standard `.ea-screen-header` + `.ea-chip` + `Panel` pattern,
with humanised data-type labels + icons, and no overlap with
`/sync/data`.

## Changes

### `/data` — `MockupDataManagement` (overview)

Full rewrite. The previous version had faux "Stored Data / Imports /
Exports / Reports & Maintenance" tabs that didn't correspond to real
operations and rendered the same 4 hard-coded rows regardless of tab.

New layout:
- **Status bar**: `Data` + `N captured` / `No records yet` chip + waiting-
  to-send count + Drafts link in the subtitle.
- **Captured data by type** table backed by the real
  `/edge-api/v1/journal/stats/by-type` endpoint:
  `[icon] · Data type · Records · Waiting to send · Last activity`.
- Rows are clickable; the right drawer carries the entity icon + label
  + raw enum + counts, plus **Open in** actions:
  - `View records` → `/sync/data` (shared per-record table)
  - `Open aggregate capture ↗` / `Open event capture ↗` /
    `Open tracker capture ↗` → the matching DHIS2 Core app
- `Open full records view →` link in the Panel header for direct
  access to `/sync/data`.
- No more hero banner, no OU breadcrumb eyebrow, no fake tabs.

### `/data/aggregate`, `/data/events`, `/data/tracker` — `DhisAppTile`

Deep-link screens into the DHIS2 Core capture apps. Hero replaced
with the standard status header (`Aggregate · DHIS2 app` /
`Events · DHIS2 app` / `Tracker · DHIS2 app`), action button `Open in
new tab ↗` sits on the right. Body shrunk from a form-section card
down to a single Panel with the About copy + the app URL and mode.

### `/data/drafts` — `CapDrafts`

- `HeroHeader` → `SyncStatusBar` with chip (`All submitted` /
  `N draft(s)`).
- Table columns: `Updated · Kind · Title · Action`. Updated uses
  `toLocaleString()`, Kind is a humanised chip (not raw enum),
  Title shows "Untitled draft" muted when missing, Discard button
  is `.ea-btn--ghost ea-btn--sm ea-btn--danger`.

### `/data/maintenance` — `CapMaintenance`

- `HeroHeader` → `SyncStatusBar` with `Idle` / `Running` chip.
- Trigger tiles now use **humanised labels** instead of raw Quartz
  job names: `Pull metadata` / `Push aggregate data` / `Drain
  journal`. Raw enum (`METADATA_SYNC_FULL`, `AGGREGATE_DATA_PUSH`,
  `JOURNAL_DRAIN`) is kept visible in mono underneath so operators
  can still cross-reference logs.
- Backup tiles unchanged content but moved into standard `Panel`
  cards.
- `Trigger sync jobs` panel description now reminds operators the
  main Sync pages carry the same triggers, so Maintenance is for
  one-off / troubleshooting use.

## Live assertions (all green)

Playwright-swept all 6 Data routes:

| Route | H1 | Status chip | Standard header |
|-------|----|-------------|-----------------|
| `/data` | `Data 2 captured` | ✓ | ✓ |
| `/data/aggregate` | `Aggregate DHIS2 app` | ✓ | ✓ |
| `/data/events` | `Events DHIS2 app` | ✓ | ✓ |
| `/data/tracker` | `Tracker DHIS2 app` | ✓ | ✓ |
| `/data/drafts` | `Drafts All submitted` | ✓ | ✓ |
| `/data/maintenance` | `Maintenance Idle` | ✓ | ✓ |

Every screen: no `.ea-dash-hero`, no `.ea-hero`, every status indicator
is a `.ea-chip` next to the H1.

Screenshots: `/tmp/der-data/` (6 pages).
