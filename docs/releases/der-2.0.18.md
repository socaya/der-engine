# der-2.0.18 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.17`

## Headline

Unified Compatibility page with a supported DHIS2 version matrix.

## Changes

- **`MockupCompatMatrix`** replaces the two-page split
  (`/compat` + `/compat/history`) with one professional surface at
  `/dhis2/compat`:
  - Hero + 4 KPIs (probe status, central version, compat profile,
    probe RTT + probe-reliability % over the history).
  - **Supported DHIS2 version matrix** — 4-column responsive grid
    of cards, one per shipped compat profile (V2_41 .. V2_44). Each
    card lists the key capture / sync / audit surface differences
    as a legend-dotted highlight list (ok / info / warn / danger).
    The profile the current probe resolves to gets a 'live' badge
    + a green accent stripe + a soft ring.
  - Live profile capabilities table (array values → chip rows,
    booleans → yes/no chips, scalars → monospace).
  - Snapshot history dense table (first 25 of N snapshots).
- Nav: drop the standalone 'Compat history' entry from the DHIS2
  group since it's merged in. `/dhis2/compat-history` continues to
  resolve for direct URL users.
- CSS: `.ea-matrix`, `.ea-matrix-card`, `.ea-matrix-dot` (ok /
  info / warn / danger tones), `.ea-matrix-card--active` halo.

## Verification

- Live-verified against the Mauritius DHIS2 2.44-SNAPSHOT:
  4 matrix cards rendered, V2_44 highlighted as 'live', 36 history
  rows pulled from the 36 captured snapshots.
- 244 / 244 admin-ui tests passing.

Evidence: `docs/evaluation/evidence/alpha.29-compat-matrix/`.
