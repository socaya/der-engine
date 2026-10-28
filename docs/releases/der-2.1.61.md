# der-2.1.61 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.60`

## Headline

Continued UI consistency pass — three themes:

1. **Devices + Data drawers converted to details pages** —
   `/devices/:deviceId` + `/sync/data?type=…` deep links replace
   the former right-side drawers. All DER lists now open their own
   details screens; no more mixed drawer/details experience.
2. **Single-line rows across every list** — Approvals, Attention,
   Referral inbox, Sync History all had cells that stacked two
   lines of text ("Record / entityRef", "Problem / Why"). Those
   are split into their own columns so every row occupies one line.
3. **Status marker consistency** — Referral inbox status chip
   migrated to `<Status tone="…">`, matching sync-history,
   workflow-runs, data queues, and metadata history.

## 1. Drawers removed

### `/devices` → `/devices/:deviceId`

- `MockupDeviceFleet` no longer carries a `sel` state or
  `SplitWithDrawer`. Row click + "Open details" both navigate to
  `/devices/:deviceId`.
- New `MockupDeviceDetail` renders a BackLink header + action
  buttons (Approve / Suspend / Revoke) with `confirmThenRun`
  effect text explaining what each action does.
- Device status column now uses `<Status>` (icon + text, no pill).

### `/data` → `/sync/data?type=…`

- `MockupDataManagement` no longer carries a `sel` state or
  `SplitWithDrawer`. Row click deep-links into the full records
  view filtered by entity type.
- Row kebab adds direct launchers into the matching capture
  surface (`/data/aggregate`, `/data/events`, `/data/tracker`)
  when the type key matches.

## 2. Single-line rows

### Before → after columns

| Table | Was (stacked) | Now (one column per fact) |
|---|---|---|
| `/sync` (SyncOverview) | Activity + sentence | Activity · Detail |
| `/sync/data` (DataQueues) | Type + entityType key | Type · Backend key |
| `/data` (DataManagement) | Type + typeKey | Data type · Backend key |
| `/sync/history` | What was synced + sentence | What was synced · Detail |
| `/approvals` | Record (type + ref) | Record type · Record ID |
| `/sync/attention` | Record + Problem (two stacks) | Record type · Record ID · Problem · Why |
| `/referral/inbox` | Referral (kind + sourceRef) | Kind · Source ref |

Mono IDs sit in their own column at 13 px, so the layout is
scannable left-to-right instead of top-to-bottom per row.

## 3. Global table defaults doing their job

The `.ea-table` base rule added in 2.1.60 (width:100% + 5 px
cells + 13 px headers) is now the only sizing the admin UI
needs. Several screens dropped their inline
`style={{ width: '100%' }}` and `style={{ fontSize: 12 }}`
overrides from table cells.

## Live assertions

| Check | Observed |
|---|---|
| `/data` columns | `["", "Data type", "Backend key", "Records", "Waiting to send", "Last activity", ""]` |
| `/sync/history` columns | `["", "What was synced", "Detail", "Direction", "When", "Duration", "Status", ""]` |
| `/devices` drawer | removed — `MockupDeviceDetail` renders instead |
| `/sync/history` pagination | present (`.ea-table-footer`) |

Playwright-swept on 2026-10-28 against the running local DER.
