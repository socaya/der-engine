# der-2.1.44 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.43`

## Headline

Review feedback on the Sync module:

> "I don't want hero components. [Pull metadata / Push data cards]
> should be actions on a single bar near the overview details. The
> actions once clicked MUST work and initiate the relevant sync
> actions and show progressing status e.g. spinner, progress bar etc."

Three fixes:

1. **All hero-style status cards replaced with a slim one-row
   `SyncStatusBar`.** No more large icon + title + sub + border-left
   banner. One compact row with status title, inline details and
   optional right-side action buttons.
2. **Overview actions collapsed into the status bar.** The two big
   "Pull metadata now" / "Push data now" cards (with their *View
   metadata details →* / *View data details →* footers) are gone.
   The two buttons now sit as compact actions on the right of the
   status bar.
3. **Live progress feedback.** Clicking Pull or Push now:
   - fires the server trigger
   - flips the button to *"Pulling metadata…"* / *"Pushing data…"* with
     an inline spinner
   - renders a progress strip below the status bar with a shimmer
     bar while running, then a success / failure summary pulled from
     the new run's detail JSON once it completes
   - polls every 2s with a 60s cap; after the cap the strip reads
     *"Still running in the background — check History for the result."*
     and a *Dismiss* button clears it

## Changes

### `admin-ui/src/screens/mockups/shared.tsx`

- New `SyncStatusBar` component — compact one-row card with a 3px
  tone-coloured left stripe, status title, optional detail chips, and
  optional right-side action slot. Replaces every `borderLeft: 4px
  solid …` status card in the Sync module.
- New `Spinner` component (CSS-only, injected keyframes on load).
- New `useTriggerAndWatch()` hook:
  - snapshots the baseline `startedAt` for the target job
  - calls `edgeApi.triggerJob(name)`
  - polls `edgeApi.listJobs(20)` every 2s looking for a new run that
    matches `jobName` and has a terminal outcome (SUCCEEDED / SUCCESS
    / FAILED / FAILURE)
  - returns `{ state, message, trigger(name), reset() }` with
    `state ∈ 'idle' | 'triggering' | 'running' | 'done' | 'failed' |
    'timeout'`
  - humanises the completed-run detail: *"Completed · 24 updates"* /
    *"Completed · nothing to send"* / *"Failed · 2 rejected"*
- New `der-spin` + `der-prog` keyframes injected globally once.

### `admin-ui/src/screens/mockups/SyncOverview.tsx`

- Hero card deleted. `SyncStatusBar` renders status + details + the
  Pull / Push buttons as a `.ea-btn--sm` toolbar on the right.
- New `ProgressStrip` component below the status bar that shows the
  live state of each in-flight trigger (one strip per action; two can
  appear simultaneously). Shows the shimmer bar while running and a
  tone-coloured dot + summary + Dismiss once the run resolves.
- `useTriggerAndWatch` wired to both buttons.
- Reload fires on `done` / `failed` so the Recent activity feed +
  attention counts refresh automatically.

### `admin-ui/src/screens/mockups/DataQueues.tsx`

- Hero card replaced with `SyncStatusBar` carrying the Push button on
  its right.
- Push button + per-row *Push now* in the drawer wired to
  `useTriggerAndWatch` with the same progress strip pattern.

### `admin-ui/src/screens/mockups/MoreScreens.tsx`

- `MockupConflictList` and `MockupWorkerHealth` both drop their hero
  cards for `SyncStatusBar`.
- Worker Pause/Resume button lives on the status bar's action slot.

### `admin-ui/src/screens/CapabilityScreens.tsx`

- `CapMetadataSync` hero card replaced with `SyncStatusBar`. Pull
  button wired through `useTriggerAndWatch`; dedicated progress strip
  below the bar.

## Live assertions (all green)

Playwright-verified against the running local DER:

| Check                                                 | Observed                                                                 |
|-------------------------------------------------------|--------------------------------------------------------------------------|
| `/sync` status bar present                             | ✓                                                                        |
| `/sync` status title                                   | `"Sync is working · all local data has been sent"`                       |
| Pull button on bar · click fires trigger               | button text → `"Pulling metadata…"`, spinner shown                       |
| Progress strip appears                                 | `"Pull metadata: Running…"` with shimmer bar                             |
| Progress strip resolves                                | `"● Pull metadata: Completed."` with Dismiss                             |
| Push button on bar · click fires trigger               | button text → `"Pushing data…"`, spinner shown                           |
| Push progress strip resolves                           | `"● Push data: Completed · nothing to send"` with Dismiss                |
| No old hero card on Overview                           | `[data-test="sync-hero"]` not found                                      |
| No "View metadata details →" footer links              | not found                                                                |
| All 5 Sync screens render SyncStatusBar                | `/sync`, `/sync/metadata`, `/sync/data`, `/sync/attention`, `/sync/worker` ✓ |

Screenshots in `/tmp/der-sync-progress/` cover idle → pulling → pulled → pushing → pushed, plus the four sub-pages.
