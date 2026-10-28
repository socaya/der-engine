# der-2.1.59 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.58`

## Headline

Three refinements:

1. **Metadata records open their own details page** — the right-side
   drawer is gone. Row click + "Open details" both land on
   `/dhis2/metadata/:resource/:id`.
2. **Users list → own details page** — same pattern, drawer replaced
   by `/provisioning/users/:userId`.
3. **Status chips are now quiet markers** — the background-filled
   pill ("Done" / "Didn't finish") was reverted. Original wording
   ("Sent", "Succeeded", "Failed", "OK") is restored, and the Result
   column renders as a tone-coloured line-icon + text with no
   background fill.
4. **Single-line table rows** — stacked sub-text on activity rows
   (sync overview, data queue) is split into its own column.

## 1. Metadata details page (§14 clean-up)

- Removed `SplitWithDrawer` from `MockupMetadata`.
- Added `MockupMetadataDetail` exported from `Metadata.tsx`.
- Route `/dhis2/metadata/:resource/:id` wired in `App.tsx`.
- The record ID now has its own column in the list so it's visible
  at a glance; row click opens the details page.
- Details page keeps the §14.3 Summary / Relationships / Rules /
  Raw JSON tabs, with a BackLink to `/dhis2/metadata`.

## 2. Users details page

- Removed `SplitWithDrawer` from `MockupUsersDashboard`.
- Added `MockupUserDetail` exported from `UsersDashboard.tsx`.
- Route `/provisioning/users/:userId` wired in `App.tsx`.
- Display-name and username are now two columns (previously one
  stacked cell), with the avatar in its own 36 px column.

## 3. Quiet Status markers (icon + text, no fill)

The user-facing wording was reverted:

| Reverted — current | Previously (2.1.58 experiment) |
|---|---|
| Sent | Delivered |
| Succeeded | Done |
| Failed | Did not finish |
| OK | Healthy |
| FAIL | Needs attention |
| Last pull failed | Last pull didn't finish |
| Never pulled | Not pulled yet |
| In transit | Sending now |
| Needs review | Needs your review |
| Resolved | Sorted |
| Scheduled | Coming up |

But the **formatting** changed: in the Result / Status columns we
now render a new `<Status tone="…">` component instead of
`.ea-chip ea-chip--*`. The Status marker is:

- Tone-coloured text (success-ink / warning-ink / danger-ink).
- A 12 px line-SVG icon prefix — classic ✓ / ✕ / ⚠ / ⓘ / — glyphs,
  not shaped pictograms.
- **No background fill, no pill border, no soft tint.**

So the Result column reads as hierarchy ("green tick · Sent"),
not as highlight. Chips with soft backgrounds remain in use for
things that genuinely want attention (count badges, operator
mode pills in the topbar, binding chips) — just not for routine
run outcomes.

CSS added to `styles.css`:

```css
.ea-status{
  display:inline-flex;align-items:center;gap:6px;
  font-size:13px;font-weight:500;line-height:1.3;white-space:nowrap;
}
.ea-status > svg{flex-shrink:0;display:block}
.ea-status--success{color:var(--der-success-ink)}
.ea-status--warning{color:var(--der-warning-ink)}
.ea-status--danger{color:var(--der-danger-ink)}
.ea-status--info{color:var(--der-primary-ink)}
.ea-status--muted{color:var(--der-ink-500)}
```

Migrated renderers:

- `SyncOverview.tsx` Result column
- `DataQueues.tsx` Status column
- `SyncHistory.tsx` Outcome column
- `CapabilityScreens.tsx` metadata run history (Succeeded / Failed)
- `CapabilityScreens.tsx` service health (OK / FAIL)

## 4. Single-line rows

### `/sync` activity table

Was two lines per row:

> **Data push**
> _Nothing waiting to send — queue was empty._

Now one line, split across two columns:

| ACTIVITY | DETAIL |
|---|---|
| Data push | Nothing waiting to send — queue was empty. |

### `/sync/data` queue table

Was:

> **Aggregate data value**
> _AGGREGATE_DATA_VALUE_

Now split across two columns: **Type** and **Backend key**.

### Users table

Was stacked avatar + name + username in one cell. Now avatar sits
in its own 36 px column, **Display name** and **Username** are two
separate columns.

## Live assertions

| Check | Observed |
|---|---|
| `/sync` Status markers | 8× "Sent" |
| Leftover `.ea-chip--success/danger` in tbody | 0 |
| `.ea-status` background | `rgba(0, 0, 0, 0)` (transparent) |
| Status icon dimensions | 12 × 12 px line SVG |
| Metadata picker optgroup count | 7 (§14.1 domains) |
| Row click on `/dhis2/metadata` | → `/dhis2/metadata/:resource/:id` |
| Metadata detail page | Summary / Relationships / Rules / Raw JSON tabs render |
