# der-2.1.58 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.57`

## Headline

Density + warmth pass:

1. Table cell padding reduced to 5 px (was 11–14 px).
2. Body canvas blended to near-white `#fafbfc` (was `#f1f4f9`).
3. Table row borders removed — rows separate by hover tone only.
4. Status chips rewritten in operator-plain English — "Delivered",
   "Done", "Needs your review", "Healthy", etc. — replacing the
   machine labels "Sent", "Succeeded", "OK", "FAIL", "Error".

## Changes

### 1. Table cell padding reduced to ≤ 5 px

The 14 px tbody padding and 11–12 px dense padding were producing
48 px row heights that pushed useful content below the fold on
every list screen. Operators scanning 50+ rows benefit far more
from density than breathing room.

```css
/* .ea-main tbody td */
padding: 14px → 5px
min-height: 48px → 32px

/* .ea-main thead th */
padding: 12px 14px → 8px 5px

/* .ea-table--dense th, .ea-table--dense td */
padding: 11px 12px → 5px
tbody tr min-height: 44px → 28px
```

Line-height stays at 1.45 so the type still breathes within the
cell; chips and user-cell avatars continue to sit comfortably in
32 px rows because they size independently of cell padding.

### 2. Body canvas blended with surfaces

`--der-canvas` moved from `#f1f4f9` (a visibly cold grey) to
`#fafbfc` (near-white, warm neutral). The step from body to
white surfaces is now a one-shade tonal lift instead of a strong
grey wash, so text sits on an even background and the typography
weight carries the hierarchy.

```css
--der-canvas: #f1f4f9 → #fafbfc
```

Sticky table headers continue to use `var(--der-canvas)` so they
match the new blended surface automatically.

### 3. Table row borders removed

`border-bottom:1px solid var(--der-border-subtle)` is gone from
`.ea-main tbody td`. With tighter row heights (32 px) and the
calmer canvas, the hover-tone and selection-tone already provide
sufficient row separation; the fine border was just visual noise.

### 4. Status chips humanised

The chip-label dictionary (`STATE_LABELS` in `mockups/shared.tsx`)
plus the `OperatorState` enum (`BACKEND_TO_OPERATOR`) now map to
operator-plain English. Highlights:

| Was | Now |
|---|---|
| `Sent` | **Delivered** |
| `Succeeded` | **Done** |
| `Failed` | **Did not finish** |
| `Error` | **Problem** |
| `OK` | **Healthy** |
| `FAIL` | **Needs attention** |
| `Last pull failed` | **Last pull didn't finish** |
| `Never pulled` | **Not pulled yet** |
| `In transit` | **Sending now** |
| `Queued` | **In queue** |
| `Running` | **Working on it** |
| `Rejected by DHIS2` | **DHIS2 did not accept** |
| `Will retry` | **Will try again** |
| `Needs review` | **Needs your review** |
| `Resolved` | **Sorted** |
| `Scheduled` | **Coming up** |

Both the `/sync` activity list and the `/sync/data` queue filter
dropdown now use the new labels, with chip tones unchanged.

## Visuals (local 2.1.58)

- `/admin/dhis2/metadata` — ~2× more rows visible without
  scrolling, grouped resources picker + health summary unchanged.
- `/admin/sync` — recent-activity list carries the same
  information with a lighter visual weight.

## Live assertions

| Check | Observed |
|---|---|
| `body` background | `rgb(250,251,252)` |
| `--der-canvas` token | `#fafbfc` |
| `.ea-main tbody td` padding | `5px` |
| `.ea-main thead th` padding | `8px 5px` |
| `.ea-main tbody td` border-bottom-width | `0px` |
| `/sync` chips | `Up to date`, `Delivered` (×7) |
| `/sync/data` chips | `All sent`, `Delivered` |

Playwright-swept on 2026-10-28 against the running local DER.
