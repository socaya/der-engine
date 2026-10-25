# der-2.1.0 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.43`

## Headline

Minor-version cut opening the Sync-module revamp. The `/sync`
landing page becomes a proper hub with a flat 6-stat strip and
a 9-tile grid linking into every Sync sub-page, and `/sync/jobs`
joins the big-list pager roster so operators can page through
the full job history instead of a 100-row slice.

## Why 2.1.x

Mirrors the DHIS2 hub + big-list pager groundwork landed in
2.0.x (`der-2.0.30`+). The Sync section is the next functional
module to receive the same treatment, so the version counter
rolls to the next minor to flag the start of that phase.

## Changes

### `/sync` — Sync hub (`admin-ui/src/screens/mockups/SyncOverview.tsx`)

Rebuild from the previous "overview" into a single landing hub:

- H1 `Sync` + hero actions `Trigger a job` / `Pause sync` ·
  `Resume sync` (toggles via `edgeApi.pauseWorker` /
  `edgeApi.resumeWorker`).
- Flat 6-stat strip replacing the previous 4 KPI tiles:
  **Worker** · **Backlog** · **Last sync** · **Last duration** ·
  **Reliability (24h)** · **Last tick**. Each stat picks a tone
  from the live data (worker success/muted, backlog
  warning/success, reliability success/warning threshold).
- Kept the two-column middle: Synchronisation progress diagram
  (DER → DHIS2 arrow + last-batch/last-tick/backlog rows) and
  24h activity bar chart with success/failure/reliability
  stats.
- Kept the Journal-by-data-type mini table.
- **New** Sync sub-modules tile grid — 9 tiles linking into
  `/sync/jobs`, `/sync/history`, `/sync/queues`,
  `/journal/conflicts`, `/journal/worker`, `/sync/metadata`,
  `/sync/data`, `/sync/schedule`, `/sync/drift`. Each tile
  pulls a one-line live caption (e.g. "N recent runs", "N items
  pending in the journal", "N conflicts needing a reviewer",
  "Drift detected" / "Fingerprints match central").
- Compact Recent-activity table at the bottom + "View all"
  link to `/sync/history`.

### `/sync/jobs` — paginated

`MockupJobsList` in `admin-ui/src/screens/mockups/MoreScreens.tsx`:

- Mirror fetch size bumped from `listJobs(100)` to
  `listJobs(500)` so the pager has material to page through.
- `usePaged(filtered, 50)` replaces the `.slice(0, 100)` hack.
- `<TablePager {...paged.pagerProps} />` renders below the
  table. Verified at `1–50 of 200 · Page 1 of 4`.

## Live verification (all green)

Server identity: v2.1.0.

### Sync hub

| Check                             | Observed                                                 |
|-----------------------------------|----------------------------------------------------------|
| Hero title                        | `Sync`                                                   |
| Hub `data-test`                   | present                                                  |
| Toggle button                     | `Pause sync` (worker currently running)                  |
| Trigger-job action                | present                                                  |
| Stat labels                       | worker · backlog · last sync · last duration · reliability (24h) · last tick |
| Tile grid                         | Jobs · History · Queues · Conflicts · Worker health · Metadata sync · Data exchange · Schedule · Metadata drift |

### Jobs pager

| Check                             | Observed                                                 |
|-----------------------------------|----------------------------------------------------------|
| Pager present                     | yes                                                      |
| Range label                       | `1–50 of 200`                                            |
| Rows per page selector            | 25 / 50 / 100 / 200                                      |
| Page count                        | Page 1 of 4                                              |
| Rendered rows on page 1           | 50                                                       |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.0/V210-sync-hub.png`
+ `V210-sync-jobs.png`.
