# der-2.1.40 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.39`

## Headline

Finish the Sync module cleanup pass. Every screen in `/sync/*` and
`/journal/*` is now hero-free, humanised, and consistent with the
activity-feed treatment introduced in der-2.1.38 / 2.1.39.

Six screens touched in one commit: `/sync` · `/sync/metadata` ·
`/sync/data` · `/sync/schedule` · `/journal/conflicts` ·
`/journal/worker`.

## Changes

### `/sync` (Sync hub) — `SyncOverview.tsx`

- Dropped the chunky `ea-dash-hero` banner. "Trigger a job" and
  "Pause / Resume sync" now live inline as the action slot of the
  "Journal by data type" panel, so the top of the page starts with the
  6-stat strip instead of an extra heading row.
- Rebuilt the **Recent activity** panel on top of `syncActivityShape`:
  icon + humanised category + plain-English sentence + consistent
  `source → target` direction + When / Duration / Status. No more
  `JOURNAL_WORKER_DRAIN` strings in the admin surface.

### `/journal/conflicts` — `MockupConflictList`

- Hero stripped; screen now opens with the KPI tiles.
- Table re-columned to the activity-feed shape: `[icon] · Entity ·
  Direction · State · Attempts · Created`. The icon + humanised label
  come from `entityTypeIcon` / `entityTypeLabel`, so an aggregate value
  reads "Aggregate data" with the chart icon rather than
  `AGGREGATE_DATA_VALUE` as a raw enum.
- State chip is humanised (`Conflict review` not `CONFLICT_REVIEW`).
- Drawer header now leads with the big icon + entity label + mono
  entity-ref + `DER → Central` direction, matching the sync-history
  drawer style.

### `/journal/worker` — `MockupWorkerHealth`

- Hero stripped. Worker state (`Running` / `Paused`) is now a KPI tile
  with the toggle button mounted in the tile's right slot, so the state
  and the control sit together — no separate top-row chip saying
  `RUNNING` in all-caps.
- Backlog table no longer prints the raw state enum next to the
  humanised chip; the raw enum stays available as the chip's `title`
  tooltip for operators who need it.

### `/sync/metadata`, `/sync/data` — `TriggerPanel`

- `HeroHeader` replaced with a slim right-aligned "Trigger now" button
  bar. The title metadata lives in the surrounding `SectionTabs`
  breadcrumb, so an extra H1 was pure chrome. Direction strip +
  stat strip + recent-runs section are untouched.

### `/sync/schedule` — `CapSyncSchedule`

- Same `HeroHeader` removal: just a right-aligned "Save schedule"
  button at the top. The "Scheduled sync flows" card below already
  carries the heading and the per-flow plain-English descriptions.

## Live assertions (all green)

Playwright swept all six routes against the running local DER:

| Route               | No `ea-dash-hero` | No `ea-hero` | No raw Quartz job | No raw state enum | Direction arrows consistent |
|---------------------|-------------------|--------------|-------------------|-------------------|-----------------------------|
| `/sync`             | ✓                 | ✓            | ✓                 | ✓                 | ✓                           |
| `/sync/metadata`    | ✓                 | ✓            | ✓                 | ✓                 | ✓                           |
| `/sync/data`        | ✓                 | ✓            | ✓                 | ✓                 | ✓                           |
| `/sync/schedule`    | ✓                 | ✓            | ✓                 | ✓                 | ✓                           |
| `/journal/conflicts`| ✓                 | ✓            | ✓                 | ✓                 | ✓                           |
| `/journal/worker`   | ✓                 | ✓            | ✓                 | ✓                 | ✓                           |

Sync module is now ready for the pilot operator review. Next up:
Workflows (`/workflows/*`, `/approvals`, `/referral/*`).
