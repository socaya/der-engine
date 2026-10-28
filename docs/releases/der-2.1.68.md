# der-2.1.68 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.67`

## Headline

Compatibility page split into its own two-tab layout — the long
snapshot-history table now lives behind a tab so the Overview no
longer scrolls past the version matrix and live-capabilities
cards to reach the history.

## Compatibility page — now tabbed

### Tab strip

```
Overview         ·  Snapshot history (50)
```

- **Overview tab** — Supported DHIS2 version matrix +
  Live profile capabilities. Short page, loads instantly, no
  scrolling past 50 rows of history to reach the live snapshot.
- **Snapshot history tab** — the full 50-row history table, now
  properly paginated at 25 rows per page with Previous/Next and
  "Showing N–M of X snapshots" label.

### State preservation

Active tab is reflected in the URL hash:

```
/admin/dhis2/compat               → Overview tab
/admin/dhis2/compat#history       → Snapshot history tab
```

So operators can bookmark either view and send `#history` links
directly to the paginated history.

### Pagination

Previously the Snapshot history panel truncated at 25 and
showed "Showing first 25 of 50 snapshots" with no way to see
the next 25. Now it paginates:

```
Showing 1–25 of 50 snapshots.           [Previous]  Page 1 of 2  [Next]
Showing 26–50 of 50 snapshots.          [Previous]  Page 2 of 2  [Next]
```

### Icons

Both tabs render the standard `UiIcon` + label pattern used by
the other Section Tabs across the admin UI:

| Tab | Icon |
|---|---|
| Overview | `overview` (dashboard grid) |
| Snapshot history | `history` (clock-rewind) |

## Live assertions

Playwright on 2026-10-28:

```
overview tab text:        "Overview"
history tab text:         "Snapshot history(50)"
Overview tab active:
  - version matrix visible                      ✓
  - live capabilities visible                   ✓
  - snapshot history table NOT rendered         ✓
Click "Snapshot history" tab:
  - snapshot rows rendered                     25 (page 1 of 2)
  - pager Previous disabled, Next enabled      ✓
```

Screenshots: `/tmp/der-2.1.68-compat-overview.png`,
`/tmp/der-2.1.68-compat-history.png`.
