# der-2.1.37 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.36`

## Headline

Two small cleanups on `/sync/history` requested on review:

1. Drop the four `Total runs / Succeeded / Failed / Other` stat
   tiles that landed when `/sync/jobs` was merged in. The hero
   now sits directly above the filter row with no filler.
2. Auto-select the first row so the right drawer boots with a
   real `Sync Details` payload (not the empty "Select a row"
   placeholder).

## Changes

### `admin-ui/src/screens/mockups/SyncHistory.tsx`

- Removed the four-wide `ea-stat-strip` (and the
  `totalRuns / okRuns / failedRuns / otherRuns` locals that
  only fed it).
- New `useEffect` runs after each page of filtered rows:
  if nothing is selected yet, set `sel = paged.rows[0]`. The
  table row renders `ea-row--active` so operators see which
  run the drawer is showing. If the user clicks a different
  row later the effect doesn't fire again (guarded by
  `!sel`), so paging / filtering doesn't yank the selection
  out from under them.

## Live assertions (all green)

| Check                                  | Observed                                                                     |
|----------------------------------------|------------------------------------------------------------------------------|
| `[data-test="history-stats"]` present  | 0 (removed)                                                                  |
| Drawer contains "Sync Details"         | yes                                                                          |
| Drawer "Select a row" placeholder      | gone                                                                         |
| Rows with `ea-row--active`             | 1 (first row)                                                                |
| Sample drawer content                  | `Run ID 4301 · Job Push outgoing data · Status Succeeded · ...`              |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.37/V2137-history.png`.
