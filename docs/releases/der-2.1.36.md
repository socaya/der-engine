# der-2.1.36 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.35`

## Headline

Merge `/sync/jobs` into `/sync/history`. The two pages were
fetching the same `edgeApi.listJobs()` endpoint and showing the
same rows — just with different packaging — so operators had
two sidebars for one thing. History now carries the best bits
of Jobs (4-stat strip + Explore-payload tiles in the drawer),
Jobs is redirected, and the Sync sub-nav + hub tile grid lose
their duplicate.

## Why

Audit of `/sync/jobs` vs `/sync/history` showed:

- Both fetch `edgeApi.listJobs()`; the row data is identical.
- `/sync/jobs` adds: 4 KPIs (Total runs / Succeeded / Failed /
  Other), simpler filters, Explore-payload drawer tiles.
- `/sync/history` adds: type + date-range filters, Export,
  Operation column with a summarised JSON payload, richer
  drawer.

Keeping both duplicated the surface. Union of features goes
on History; Jobs goes away.

## Changes

### `admin-ui/src/screens/mockups/shared.tsx`

- New `relatedLinksForJob(jobName)` export — lifted from
  `MoreScreens.tsx`. Maps a Quartz job name to the sub-screens
  where its payload lives (Metadata → metadata browser /
  drift; Journal / Drain / Push → Queues / Conflicts; Referral
  → Referral inbox). Returns an empty array when there's no
  natural drill-in.

### `admin-ui/src/screens/mockups/SyncHistory.tsx` — enhanced

- New 4-tile stat strip above the main panel: **Total runs ·
  Succeeded · Failed · Other** sourced from the full 200-run
  fetch (not the current filter) so operators get a stable
  at-a-glance picture. Failed tile goes `danger` when there's
  a non-zero count, `muted` when zero.
- Drawer now carries an **Explore payload** tile grid at the
  bottom, driven by `relatedLinksForJob(sel.jobName)`. For a
  `JOURNAL_WORKER_DRAIN` run that shows Queues + Conflicts;
  for a `METADATA_SYNC_*` run it shows Metadata browser +
  Metadata drift; etc. Hidden entirely when the job has no
  natural drill-in.
- Added `data-test="history-stats"` on the stat strip so the
  verification spec can target it cleanly.

### `admin-ui/src/App.tsx`

- `/sync/jobs` becomes `<Navigate to="/sync/history" replace />`
  so existing bookmarks / in-app links don't 404.
- Dropped the `MockupJobsList` import.

### `admin-ui/src/app/navigation.ts`

- `sync-jobs` item flipped to `status: 'contextual'` so the
  "Jobs" tab drops out of the Sync sub-nav. The route still
  renders through the Navigate above for anyone who has it
  bookmarked.

### `admin-ui/src/screens/mockups/SyncOverview.tsx`

- Sub-modules tile grid loses its Jobs tile. The History tile's
  caption becomes `${runs} recent runs — every sync operation.`
  so it carries the Jobs tile's at-a-glance count.

### `admin-ui/src/screens/mockups/MoreScreens.tsx`

- Deleted `MockupJobsList` (and the local `relatedLinksFor`
  helper that moved to shared). Cleaned up the now-unused
  `useMemo` / `fmtDur` / `humaniseJob` imports and the dead
  `IconDots` SVG helper.

## Live assertions (all 6 green)

| Check                                   | Observed                                                           |
|-----------------------------------------|--------------------------------------------------------------------|
| Visiting `/admin/sync/jobs`             | redirects to `/admin/sync/history`                                 |
| History stat-strip labels               | Total runs · Succeeded · Failed · Other                            |
| History drawer                          | shows `EXPLORE PAYLOAD` with drill-in tiles for the clicked row    |
| Sync hub tile grid                      | starts with `History`, no `Jobs` tile                              |
| Sync hub sub-nav tabs                   | Overview · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule — no `Jobs` tab |
| Legacy deep link                        | `/sync/jobs` still routes successfully (via Navigate)              |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.36/V2136-history.png`.
