# der-2.1.15 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.14`

## Headline

Fix the overlapping content in the "Synchronisation directions"
panel on the Sync hub. The left `Central <arrow> DER` column
used to be a fixed `96px` wide, but the mono text actually
measures ~115 px, so the Metadata / Data labels in the middle
column rendered on top of it.

## Changes

### `admin-ui/src/screens/mockups/SyncOverview.tsx` — `SyncLane`

- `gridTemplateColumns` flipped from `96px 1fr auto` to
  `max-content 1fr max-content` so the first and third columns
  size to their content and the middle column takes the rest
  without having to overflow.
- Added `white-space: nowrap` to the arrow row to keep
  `Central <arrow> DER` on a single line.
- Switched `gap: 10` → `columnGap: 14, rowGap: 4` so the
  horizontal separator is a little more generous and the badge
  can top-align cleanly against the title row.
- Badge wrapped in a small container with `alignSelf: 'start'`
  so it sits with the title line rather than vertically-
  centering against the full lane height.
- Reduced the mono font-size from 15 → 14 so the lane is a
  touch tighter overall.

## Live verification

Measured on `/sync` at viewport 1440 × 1200:

| Row     | col0 right-edge | col1 left-edge | gap |
|---------|----------------:|---------------:|----:|
| 0 (Metadata) | 378 px     | 392 px         | 14  |
| 1 (Data)     | 378 px     | 392 px         | 14  |

Positive gap on both rows → no visual overlap.

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.15/V2115-sync-lanes.png`.
