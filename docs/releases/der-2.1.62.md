# der-2.1.62 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.61`

## Headline

Bugfix — `/admin/sync/history/:runId` returned "Run not found" for
runs older than the most recent 200. Older runs are now fetchable
directly by ID.

## Root cause

`MockupSyncHistoryDetail` used `edgeApi.listJobs(200)` and then
`Array.find(j => j.runId === runId)`. The server's
`GET /edge-api/v1/sync/jobs?limit=200` endpoint hard-caps to the
most recent 200 rows across every job name — so any older run
(say `runId = 4789` once newer runs push past 200) was invisible
to the detail page even though the row existed in the database
and was linked from the list.

## Fix

### Server

- `ScheduledJobRepository.findById(long runId)` — direct lookup
  by `run_id` primary key.
- `SyncJobsController` adds `GET /edge-api/v1/sync/jobs/{runId}`
  (regex-guarded to digits so it does not conflict with the
  existing `.../{name}/trigger` POST route). Returns 200 with
  the row or 404 when absent.

### UI

- `edgeApi.getJobRun(runId)` client wrapper.
- `MockupSyncHistoryDetail` now calls `getJobRun(runId)` directly
  instead of scanning the recent-runs list. Error message still
  reads "Run not found." when the server replies 404; other
  errors surface the raw message.

## Live verification

```
GET /edge-api/v1/sync/jobs/4789   → 200
   { runId: 4789, jobName: "METADATA_SYNC_FULL", outcome: "SUCCESS",
     durationMs: 4887, triggeredBy: "SCHEDULED" }

GET /edge-api/v1/sync/jobs/999999 → 404

/admin/sync/history/4789 Playwright screen:
   h1 reads "Metadata pull Succeeded"
   "Run not found" element present: false
```
