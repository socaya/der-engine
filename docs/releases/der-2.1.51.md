# der-2.1.51 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.50`

## Headline

High-priority structural refactor across the admin UI per three
review notes:

> "On sync/data remove the stats cards (Waiting / Sending / Sent /
> Retrying / Rejected / Needs attention). Also on all modules,
> instead of having a compressed right side to display details of
> the selected row, we need to open a details page well formatted.
> Also we need to make all tables full width so they are not wrapped.
> High priority."
>
> "Each row must have an applicable context menu, as a select field,
> as the last column (far right)."
>
> "On Metadata sync, I think this Last pull / … / DHIS2 version
> block is not required."
>
> "All pages must be cleaned, no hero content."

## What changed

### Drawer → details page across 6 screens

Every `SplitWithDrawer` on the list screens is gone. Each list is
now full-width; clicking a row navigates to a dedicated details
route that lays the former drawer content out full-width inside
`Panel` cards.

| List | Was | Now |
|------|-----|-----|
| `/sync/data` | right-side drawer | `/sync/data/:operationId` |
| `/sync/history` | right-side drawer | `/sync/history/:runId` |
| `/sync/attention` | right-side drawer | `/sync/attention/:operationId` |
| `/sync/metadata` recent pulls | right-side drawer | `/sync/history/:runId` (reuses) |
| `/approvals` | right-side drawer | `/approvals/:operationId` |
| `/referral/inbox` | right-side drawer | `/referral/inbox/:inboxId` |

Each detail page carries:
- `← Back to <list>` link above the title.
- `SyncStatusBar` with the entity name as title + status chip +
  context actions on the right (Push now / Approve / Reject /
  Accept referral / Dismiss / Resolve etc.)
- Body as a sequence of `Panel` cards (Overview / Payload / Problem
  / etc.) laid out full-width.

### Per-row context menu

New `RowMenu` component in `shared.tsx` renders as a native
`<details>` popup anchored to a `⋮` kebab icon. Sits in the last
column, far-right. Items can be:
- `to: '/path'` — navigates
- `onSelect: () => …` — fires a callback
- `danger: true` — rendered in the destructive-action red tone
- `disabled` when a prerequisite isn't met

Menu items vary per row context, e.g.:

| Row | Menu items |
|-----|-----------|
| /sync/data (Waiting) | Open details · Push now |
| /sync/data (Needs attention) | Open details · Open attention item |
| /sync/attention | Open details · Accept local version · Reject local version |
| /approvals | Open details · Approve · Reject |
| /referral/inbox (Pending) | Open details · Accept referral · Dismiss |
| /sync/history | Open details · (job-type related links) |

Clicking the menu or any item **stops** the row-click so navigation
doesn't fire while interacting with the menu.

### Full-width tables

Every refactored list table is now `width: 100%`. The old
drawer-constrained width is gone, so long entity-refs no longer
wrap into the "Record" column.

### `/sync/data` — stats cards removed

The six-column strip above the table (Waiting / Sending / Sent /
Retrying / Rejected / Needs attention) is gone. The same counts
now live inline in the status-header subtitle so the screen opens
on the records directly.

### `/sync/metadata` — duplicate block removed

The horizontal "Last pull / Result / Duration / Triggered by /
DHIS2 version" strip was duplicating what the status-header
subtitle already said (`Last successful pull … · Central DHIS2
reachable`). Dropped. The Recent pulls table is now a full-width
clickable list that navigates to `/sync/history/:runId` for details.

### Hero cleanup — global

Rather than touch 25+ screens still using `HeroHeader`, the
component itself now delegates to the standard `.ea-screen-header`
layout. Every page that still imports `HeroHeader` is
automatically hero-free as of this release. No more `.ea-hero`
bordered banner anywhere.

## Live assertions (all green)

Playwright-swept the 6 refactored list pages:

| Route | Drawer removed | No dash-hero | Row menu |
|-------|----------------|--------------|----------|
| `/sync/data` | ✓ | ✓ | ✓ |
| `/sync/history` | ✓ | ✓ | ✓ |
| `/sync/attention` | ✓ | ✓ | ✓ (when rows present) |
| `/sync/metadata` | ✓ | ✓ | ✓ |
| `/approvals` | ✓ | ✓ | ✓ (when rows present) |
| `/referral/inbox` | ✓ | ✓ | ✓ (when rows present) |

Screenshot `/tmp/der-pages-v51/sync-data.png` shows the Data page
cleaned up: no 6-tile strip, full-width table, kebab menu on the
right column, status chip inline with the H1.

## Deferred

- Users dashboard (`/provisioning/users`) and Data overview
  (`/data`) still use `SplitWithDrawer`. Will follow the same
  pattern in a follow-up release.
- `Mockup*` function/filename renames to `Mockup`-free names —
  cosmetic; not blocking.
