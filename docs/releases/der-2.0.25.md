# der-2.0.25 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.24`

## Headline

Flat admin UI redesign. HeroHeader cards, panel cards, boxed
sections and heavy table chrome are gone. Every page now reads
as a modern, dense, flat layout with content positioned on the
page background instead of inside stacked boxes. Tables share a
single search + filter + count row above a compact table.
Topbar is the single source of truth for the OU binding chip —
no per-screen duplication.

## Design intent

- No stacked card chrome. Grouping comes from typography
  (uppercase H2 + thin bottom border), not panel backgrounds.
- Tables are compact by default (`6px / 10px` padding, `12px`
  body text, `11px` uppercase column heads).
- Every table has a single row above it carrying search left,
  filters / count right — produced automatically by the shared
  `Panel({ title, action })` primitive now that `.ea-panel-head`
  renders as a flat section head.
- Hero rows carry only what the hero is actually for: an H1,
  a one-line muted subtitle, and inline primary actions.

## Changes

### `admin-ui/src/styles.css` — flat primitives

| Rule                              | What changed                                                |
|-----------------------------------|-------------------------------------------------------------|
| `.ea-hero`                        | Dropped surface/border/shadow/padding; flat row.            |
| `.ea-dash-hero`                   | Same flat treatment (used by Workspace, Metadata, etc.).    |
| `.ea-screen > section`            | Removed the global surface wrapper that boxed every section.|
| `.ea-card`, `.ea-form-card`       | Removed background/border/shadow/radius.                    |
| `.ea-panel`                       | Flat; `.ea-panel-head` → uppercase H2 + thin bottom border. |
| `.ea-form-section`                | Tightened to a 220px label gutter + flat section borders.   |
| `.ea-main table` / `thead` / `tbody` | Dense by default (`6px / 10px`, `12px` body, `11px` head). No card background, no shadow, flat row borders. |
| `.ea-stat` / `.ea-stat-strip`     | No card chrome; thin 2px colored left border per tone.      |
| `.ea-notice`                      | No card chrome; thin colored left border per tone.          |

### `admin-ui/src/components/HeroHeader.tsx` — simplified markup

- Removed "Welcome back" eyebrow, date column, "Updated Xm ago"
  line, DER/DHIS2 version badges and the OU chip.
- Signature now renders only an H1, a muted one-line subtitle
  and the inline `actions` slot.
- `orgUnitBound` / `orgUnitLabel` props removed from the public
  type. `version` / `centralVersion` / `lastFetched` retained in
  the type for backwards compatibility with existing call sites
  but intentionally not rendered.

### Call-site cleanup

Stale `orgUnitBound` / `orgUnitLabel` props removed from the
`EACoreScreens` setup overview and from the Organisation-unit
screen — no screen-level markup was replaced; the cascading CSS
delivers the flat look.

## Live verification

- 13 screens captured under
  `docs/evaluation/evidence/alpha.35-der-2.0.24/VFLAT-*.png`:
  workspace, dhis2 overview, connection, OU, compat, metadata,
  metadata-sync, drift, sync overview, sync jobs, users, health,
  settings.
- Hero computed styles on `/admin/dhis2/connection`:
  `background: rgba(0,0,0,0)`, `box-shadow: none`, `border: 0px`.
- `data-test="hero-ou"` count = 0 on every page (OU chip only
  on the topbar).
