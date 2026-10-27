# der-2.1.55 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.54`

## Headline

Two bugs found in browser verification:

1. **"Recent pulls" shown as "Never run"** on `/sync/metadata` after
   a server restart, even though the database contained 5+ persisted
   metadata runs. Root cause: client was fetching the global
   `listJobs(50)` and then filtering client-side — but 50 recent
   runs are dominated by `JOURNAL_WORKER_DRAIN` (every minute), so
   the metadata runs fell outside the window.
2. **"Import count" row cramped** — `Imported 0Updated 0Ignored
   0Deleted 0` with no spacing. Also no explanation of what a
   200-OK response with zero changes actually means.

## Changes

### Server-side job filter

- `SyncJobsController.list()` now accepts an optional `?jobName=X`
  query param and delegates to the existing
  `ScheduledJobRepository.findRecentForJob()` method.

### Client API

- `edgeApi.listJobs(limit, jobName?)` now forwards the filter via
  `URLSearchParams`.

### `CapMetadataSync` (`/sync/metadata`)

- Switched from client-side filtering of a 50-row global run list to
  a server-filtered fetch of the last 20 `METADATA_SYNC_FULL` runs.
  The Recent pulls table now reliably shows every persisted metadata
  pull regardless of how busy the drain/analytics loops have been in
  between.

### `/sync/data/:operationId` — Last response

- Import count row re-laid using flexbox: 20 px gap between
  Imported / Updated / Ignored / Deleted. No more cramped strings.
- When the response is HTTP 200/OK but all four counts are zero,
  a small muted sub-note explains:
  > *Central DHIS2 accepted the request (HTTP 200) but didn't change
  > any records — the data was already present or matched an
  > existing value.*

## Live assertions (all green)

Playwright-swept the running local DER:

| Check                                             | Observed |
|---------------------------------------------------|----------|
| `/sync/metadata` Recent pulls row count           | 20 runs (back to 10/25/2026) |
| Header reads `Up to date` + last pull timestamp   | ✓ |
| `/sync/data/:id` import-count row has spacing      | `Imported 0 · Updated 0 · Ignored 0 · Deleted 0` |
| Clarification note shown when counts are all zero  | ✓ |

Screenshots: `/tmp/der-fix/metadata.png`, `/tmp/der-fix/data-detail.png`.
