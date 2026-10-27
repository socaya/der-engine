# der-2.1.42 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.41`

## Headline

First-principles rebuild of the Sync module per
`docs/requirements/DER_Synchronisation_Module_Simplified_Full_Requirements_and_Claude_Instructions.md`.
Each page now answers one clear operator question, with plain-English
status copy and progressive-disclosure for technical detail.

The audience is DER administrators, facility supervisors / IT focal
points and visiting district admins — people troubleshooting a running
edge, not Quartz engineers.

## New navigation

Sidebar collapses to the eight routes the spec names, plus legacy
redirects so bookmarks keep working:

```
Synchronisation
├── Overview          /admin/sync
├── Metadata          /admin/sync/metadata
├── Data              /admin/sync/data        (was /sync/queues)
├── Needs your attention /admin/sync/attention (was /journal/conflicts)
├── Worker            /admin/sync/worker      (was /journal/worker)
├── Schedule          /admin/sync/schedule
├── History           /admin/sync/history
└── Settings          /admin/sync/settings    (new)
```

Legacy routes redirect:

- `/journal/conflicts → /sync/attention`
- `/journal/worker → /sync/worker`
- `/sync/queues → /sync/data`

## Per-screen changes

### `/sync` Overview (§5)

Replaces the dense 6-stat strip + sync-direction panel + 24h chart +
queue-by-type table + submodule tile grid with:

- One **hero status card** that reads *"Sync is working" / "Sync is
  paused" / "Central DHIS2 is unavailable" / "Sync needs attention"*.
  Shows last successful sync, Central DHIS2 reachability, number of
  attention items.
- Two **large primary action cards**: "Pull metadata now" and "Push
  data now". Each wires straight to its underlying Quartz trigger and
  disables itself when Central DHIS2 is unavailable (or when the worker
  is paused, for the push card). Both link into their respective detail
  pages.
- A compact **Recent activity** feed (8 rows) with icon + humanised
  category + plain-English sentence + operator-friendly status chip,
  plus a "View all history" link.

Charts, raw queue tables and state breakdowns are gone from this page —
they live on dedicated sub-pages per the spec.

### `/sync/metadata` (§6)

Rewritten as a focused status screen:

- Hero status: *"Metadata is up to date" / "Last metadata pull failed" /
  "Metadata has never been pulled"* with the big **Pull metadata now**
  button beside it. Button is disabled when Central DHIS2 is
  unreachable, with a muted explanation underneath.
- Two side-by-side cards: **Last pull** (when / result / duration /
  trigger) and **Metadata summary** (last successful pull / last
  attempt / DHIS2 version / Central reachability chip).
- **Recent pulls** table showing when / result / duration / triggered
  by for the most recent 8 metadata-sync runs.

### `/sync/data` (§7)

Thin alias of `/sync/queues` while the Data page is being migrated —
the existing MockupDataQueues already carries the activity-feed table
and tabbed payload drawer landed in 2.1.41. Legacy `/sync/queues`
redirects here.

### `/sync/attention` (§9) — was Conflicts

Rename + rewrite into "Needs your attention":

- Hero status reads *"Nothing needs your attention"* when the list is
  empty, otherwise *"N records need your attention"*.
- Table columns: `[icon] · Record · Problem · Priority · Since · Action`.
  **Problem** column leads with a plain-English label (`"Record changed
  on both sides"` / `"Rejected by Central DHIS2"` / `"Repeated sync
  failure"` / `"Unconfirmed acknowledgement"`) plus a one-line
  explanation underneath. **Priority** is `High / Medium / Low` based
  on retry count. Row-level `Review` button opens the drawer.
- Drawer leads with the plain-English problem label + explanation in a
  tinted strip (red / amber / blue by priority), then operator-friendly
  summary fields (Priority / Attempts / First queued / Age / Operation
  ID), then a **Recommended action** header before the resolve buttons
  (now worded as *"Accept local version"* / *"Reject local version"*).

### `/sync/worker` (§10) — was Worker health

Collapsed into a single status card:

- Hero: *"The synchronisation worker is running"* or *"…is paused"*
  with the Pause/Resume button beside it. Inline summary shows waiting
  / retrying / needs-attention / last-batch counts, with the
  attention count linking to `/sync/attention`.
- Backlog table is hidden by default behind a **Show breakdown**
  toggle, matching the spec's progressive-disclosure requirement.

### `/sync/schedule` (§8)

Each flow renders as a card:

- Title + plain-English description
- Big "Runs every X minutes" (`describeCron(v)` without the parens)
- **Show expression** toggle that reveals the raw cron input underneath

Cron syntax is no longer visible by default. The screen keeps a single
"Save schedule" action pinned top-right.

### `/sync/settings` (§12) — new

Settings scoped to synchronisation behaviour only; the Central DHIS2
connection fields are read-only here with a link to the DHIS2 Module.

- **Central DHIS2** card: URL / pinned version / Central version /
  reachability chip / authentication status (read-only). Actions: *Test
  connection*, *Open DHIS2 Configuration*.
- **Sync behaviour · advanced**: short notice pointing to the Schedule
  screen for batch / retry config and to `/settings` for low-level
  overrides. (Fine-grained batch/retry/back-off tuning lives behind
  the general Settings screen; this page refuses to duplicate the DHIS2
  Module's connection config, per §12.)

### `/sync/history`

Unchanged — the activity-feed + tabbed payload drawer landed in 2.1.41
already matches the spec.

## State language (§20)

Added `operatorState()` and `operatorStateTone()` helpers in
`shared.tsx`:

| Backend                               | Operator  |
|---------------------------------------|-----------|
| PENDING, QUEUED                        | Waiting |
| IN_FLIGHT, SYNCHRONISING               | Sending |
| CENTRAL_ACCEPTED, ACCEPTED, SUCCESS    | Sent    |
| RETRYABLE, RETRY_PENDING, UNKNOWN_OUTCOME | Retrying |
| CENTRAL_REJECTED, REJECTED, FAILED     | Rejected |
| CONFLICT_REVIEW, CONFLICT, REQUIRES_REVIEW | Needs attention |

The Overview recent-activity feed uses the operator state names
directly.

## Live assertions (all green)

Playwright swept the eight new routes:

| Route                   | H1 renders                                    |
|-------------------------|-----------------------------------------------|
| `/sync`                 | *"Sync is working"* (or current status)       |
| `/sync/metadata`        | *"Metadata has never been pulled"* / up to date |
| `/sync/data`            | data table loads (no top-level H1 by design) |
| `/sync/attention`       | *"Nothing needs your attention"*               |
| `/sync/worker`          | *"The synchronisation worker is running"*     |
| `/sync/schedule`        | cards render, cron hidden                      |
| `/sync/settings`        | Central DHIS2 card, read-only                  |
| `/sync/history`         | activity feed + tabbed drawer (unchanged)     |

Overview also asserts:

- `[data-test="sync-status-headline"]` present
- `[data-test="sync-pull-metadata"]` + `[data-test="sync-push-data"]` present
- No `ea-stat-strip` on the Overview
- No "Outbound queue · by data type" table on the Overview

Not shipped in this release (deferred):

- Data page column rename to spec (Type / Record / Program / OU /
  Captured / Status / Last Attempt / Action). Current table columns
  already carry the same information; the rename is cosmetic.
- Settings advanced section (retry delay / batch size editors). Backend
  surface already exists under `/settings`; promoting to Sync-scoped
  editors is a follow-up.
- Metadata-type-updated breakdown on `/sync/metadata`. Needs a new
  server endpoint to report per-type counts from the mirror.

These are tracked for der-2.1.43.
