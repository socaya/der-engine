# der-2.1.34 (stable)

**Date:** 2026-10-26
**Previous stable:** `der-2.1.33`

## Headline

Restructure the Sync-overview hub for a non-technical operator.
The long rationale paragraphs are off the page (moved to hover
tooltips on each direction lane), the sub-module tile captions
are plain-English and compact, the hub's Recent-activity table
humanises job names + outcomes, and the "metadata = one-way,
data = two-way" eyebrow is dropped since the lane badges
already carry that information.

## Why

User audit of `/admin/sync`:

- Direction lanes each carried a two-line rationale ("DHIS2 is
  the source of truth…", "Local captures journal up to
  central…") that an operator doesn't need to re-read every
  visit — the directional arrow + one-/two-way chip is enough.
- Sub-module tile captions mixed in internal terms ("Quartz
  scheduler", "tick heartbeats", "cron expressions driving the
  scheduler", "fingerprints match central") that only an
  engineer parses.
- The Recent-activity table still showed raw Quartz constants
  (`JOURNAL_WORKER_DRAIN`, `SUCCESS`) that the Jobs page had
  already humanised everywhere else.

## Changes

### `admin-ui/src/screens/mockups/SyncOverview.tsx` — `SyncLane`

- Rationale text removed from the lane body. Moved onto the
  wrapping `<div>` as a `title=` tooltip and surfaced through a
  small circular "i" icon rendered inline before the badge.
  Hovering either the icon or the lane reveals the full
  sentence.
- Lane layout tightened: single-row grid
  `max-content 1fr max-content max-content` with no stacked
  description line. Lane height drops roughly in half.

### Panel head

- The "metadata = one-way, data = two-way" eyebrow is dropped
  from the `Synchronisation directions` panel head — the one-
  /two-way chips on each lane carry it.

### Sub-module tile captions humanised

| Tile              | Before                                                  | After                                      |
|-------------------|---------------------------------------------------------|--------------------------------------------|
| Jobs              | `100 recent runs on the Quartz scheduler`               | `100 recent runs`                          |
| History           | `All synchronisation operations across every job.`      | `Every sync run on this edge.`             |
| Queues            | `2 items pending in the journal`                        | `2 items waiting to send`                  |
| Conflicts         | `No conflicts pending review.`                          | `No conflicts to review.`                  |
| Worker health     | `Worker running — tick heartbeats are healthy.`         | `Running smoothly.`                        |
| Metadata sync     | `Trigger an immediate metadata pull from central.`      | `Pull the latest DHIS2 metadata now.`      |
| Data exchange     | `Push + pull coordination for aggregate / event / tracker.` | `Push + pull data between DER and DHIS2.` |
| Schedule          | `Cron expressions driving the scheduler.`               | `When each background flow runs.`          |
| Metadata drift    | `Fingerprints match central.`                           | `Mirror matches DHIS2.`                    |

### Recent activity table humanised

- Job cell now renders `humaniseJob(j.jobName)` as the primary
  label and the raw Quartz constant (`JOURNAL_WORKER_DRAIN`,
  etc.) on a 10 px muted mono line underneath with the raw
  constant kept as the `title=` tooltip.
- Outcome chip uses `humaniseState(j.outcome)` so `SUCCESS`
  reads as `Succeeded` end-to-end.

### `admin-ui/src/screens/mockups/shared.tsx` — state alias fix

- `humaniseState` now maps `SUCCESS`, `FAILURE`, `ERROR` as
  explicit aliases of `SUCCEEDED` / `FAILED`. Without this the
  Title-Case fallback produced `Success` for Jobs-page outcomes
  but `Succeeded` for anything the server returned as
  `SUCCEEDED`. The server uses both forms depending on the
  code path.

## Live assertions (all green)

| Check                                      | Observed                                                               |
|--------------------------------------------|------------------------------------------------------------------------|
| Rationale text in the lane body            | removed                                                                |
| Data lane `title=` attribute               | `Local captures journal up to central; central-held OU data syncs down…` |
| Jobs tile caption                          | `100 recent runs`                                                      |
| Schedule tile caption                      | `When each background flow runs.`                                      |
| Metadata drift tile caption                | `Mirror matches DHIS2.`                                                |
| Recent activity Job cell                   | `Push outgoing data` (raw `JOURNAL_WORKER_DRAIN` on muted line below)   |
| Recent activity Outcome chip               | `Succeeded`                                                            |

Evidence: `docs/evaluation/evidence/alpha.35-der-2.1.34/V2134-sync-hub.png`.
