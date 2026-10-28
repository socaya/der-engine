# der-2.1.60 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.59`

## Headline

Two correctness fixes:

1. **Manual-trigger attribution** — `scheduled_job_run.triggered_by`
   now carries the actual operator username when a human kicks a
   job off from the UI. Previously it logged "SCHEDULED" regardless.
2. **Pagination on every list table** — the Recent pulls,
   Workflow runs, Referral history and Drafts tables all now
   paginate via `usePaged` + `<TablePager>`. Standard table styles
   also applied globally so new tables inherit width:100% + 5 px
   padding without having to opt in.

## 1. Attribution — `triggered_by` reflects reality

### Server

- `SyncJobsController.trigger()` now attaches
  `JobDataMap{ "triggeredBy": principal.user().username() }` when
  calling `scheduler.triggerJob(key, data)`.
- Every Quartz job that writes to `scheduled_job_run` reads
  `context.getMergedJobDataMap().getString("triggeredBy")` and
  falls back to `"SCHEDULED"` only when the value is absent / blank.
  Updated jobs: `MetadataSyncJob` (already honoured the field),
  `JournalDrainJob`, `AnalyticsRefreshJob`, `CompatRefreshJob`,
  `DriftSnapshotJob`, `ReferralInboxPollJob`, `BackupDrainJob`.
- `BackupController.kickDrain(username)` and
  `RestoreController.kickDrain(username)` now also pass the acting
  user through the data map.

### UI

- New `humaniseTrigger()` helper in `shared.tsx`:
  - `"SCHEDULED"` → `"Scheduled"` (cron)
  - anything else → raw value (preserves usernames exactly)
- `CapabilityScreens.tsx` Recent pulls table and
  `SyncHistory.tsx` detail panel both use `humaniseTrigger`
  instead of `humaniseState` (which would title-case
  `"der-admin"` to `"Der Admin"`).

### Live verification

```
POST /edge-api/v1/sync/jobs/METADATA_SYNC_FULL/trigger  (as der-admin)
→ GET  /edge-api/v1/sync/jobs?jobName=METADATA_SYNC_FULL&limit=3
    runId 5780  outcome SUCCESS  triggeredBy "der-admin"   ← new behaviour
    runId 5661  outcome STARTED  triggeredBy "SCHEDULED"   ← cron
    runId 5469  outcome SUCCESS  triggeredBy "SCHEDULED"   ← cron

Playwright on /admin/sync/metadata reads the same values:
    ["der-admin", "Scheduled", "Scheduled", "Scheduled", "Scheduled", "Scheduled"]
```

## 2. Pagination + global table styles

Four previously-unpaged tables now use `usePaged(..., 25)` +
`<TablePager>`:

- CapabilityScreens / Recent pulls (metadata sync history).
- CapabilityScreens / Workflow runs.
- CapabilityScreens / Referral history.
- CapabilityScreens / Drafts.

Also added global CSS defaults so every `.ea-table` picks up the
same base dimensions without each screen passing
`style={{ width: '100%' }}`:

```css
.ea-table{width:100%;border-collapse:collapse;table-layout:auto}
.ea-table th, .ea-table td{padding:5px;font-size:14px;line-height:1.45}
.ea-table thead th{font-size:13px}
```

The `--dense` modifier still exists but only tightens hover /
selection behaviour; everything else is now consistent by default.

## Status column still uses the quiet marker

The Workflow runs and Referral history tables previously rendered
their status column as a filled chip pill. They now use
`<Status tone="…">` just like `/sync` and `/sync/data`, so the
Result/Status columns across all list screens look the same.

## Live assertions

| Check | Observed |
|---|---|
| Manual trigger attributes to username | runId 5780 → `triggeredBy: "der-admin"` |
| Scheduler-fired runs stay as SCHEDULED | runIds 5661, 5469 → `triggeredBy: "SCHEDULED"` |
| UI humanises SCHEDULED | `"Scheduled"` |
| UI preserves usernames | `"der-admin"` |
| Recent pulls table has pager | ✓ |
