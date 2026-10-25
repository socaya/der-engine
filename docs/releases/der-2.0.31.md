# der-2.0.31 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.30`

## Headline

Pagination on the 7 remaining big-list tables. der-2.0.30
landed the shared `TablePager` + Metadata wiring; this release
rolls the pattern out across Users, Sync history, Sync queues,
Journal conflicts, Audit events, Compat history and Program
rules.

## Why

User-visible bug: every list was capped at 50-100 rows due to
hard slices in each `tbody.map`. Operators scanning long
histories or populated DHIS2-metadata lists couldn't see rows
past the cap — the UI silently dropped them.

## Changes

### Shared `usePaged<T>` hook

New export from `admin-ui/src/screens/mockups/shared.tsx`:

```ts
const paged = usePaged(filteredRows, 50);
// paged.rows → sliced array for the current page
// paged.pagerProps → spread onto <TablePager {...paged.pagerProps} />
```

Client-side slicing. Reads an already-loaded array and
exposes `{rows, page, pageSize, pageCount, total}` plus
callbacks. Clamps `page` to `pageCount` when the data shrinks
(filter / search).

### Table conversions

| File / function                                             | Default page size |
|-------------------------------------------------------------|-------------------|
| `mockups/UsersDashboard.tsx` — `MockupUsersDashboard`       | 50                |
| `mockups/SyncHistory.tsx` — `MockupSyncHistory`             | 50                |
| `mockups/DataQueues.tsx` — `MockupDataQueues`               | 50                |
| `mockups/MoreScreens.tsx` — `MockupConflictList`            | 50                |
| `mockups/MoreScreens.tsx` — `MockupAuditEvents`             | 50                |
| `EACoreScreens.tsx` — `EACompatHistory`                     | 50                |
| `CapabilityScreens.tsx` — `CapProgramRules`                 | 50 (also bumped the mirror fetch from the server's 50-default to `pageSize=1000` so every mirrored rule becomes reachable) |

Each conversion:

- Imports `usePaged` + `TablePager` from `mockups/shared`.
- Calls `const paged = usePaged(filtered, 50)` next to the
  existing state hooks.
- Swaps `filtered.slice(0, 100).map(...)` → `paged.rows.map(...)`.
- Drops `<TablePager {...paged.pagerProps} />` directly below
  the table.

### Scope note

`CapOrgUnitBinding` ("Organisation unit" page) was listed in
the big-list candidate set because the server returns 484 OUs
on this instance, but the page actually renders them as a
`<select>` dropdown, not a `<table>` — no pagination needed.

## Live verification

| Page                             | Rendered rows | Pager                   |
|----------------------------------|---------------|-------------------------|
| `/dhis2/metadata`                | 50            | ✓                       |
| `/provisioning/users`            | 4             | ✓                       |
| `/sync/history`                  | 50            | ✓                       |
| `/sync/queues`                   | 0 data        | hidden (nothing to page) |
| `/journal/conflicts`             | 0             | hidden (nothing to page) |
| `/audit/events`                  | 50            | ✓                       |
| `/compat/history`                | 50            | ✓                       |
| `/dhis2/program-rules`           | 50            | ✓                       |

TablePager hides itself when `total === 0`; the two currently
empty pages correctly suppress it.
