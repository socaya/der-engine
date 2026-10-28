# der-2.1.65 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.64`

## Headline

Three continued-polish items, all driven by review feedback:

1. **Chip-pill backgrounds removed everywhere.** The red/green/
   amber soft-filled pills that still appeared on module pages
   (status chips, role chips, binding chips, topbar operating
   mode) are gone. Chips now render as inline-flex
   `● tone-coloured text` tokens — a small coloured dot
   prefixing tone-coloured text, no background, no border, no
   border-radius.
2. **KPI tile strips stripped from more sub-module pages.**
   Following 2.1.64's compat-page clean-up, the top-of-page
   4-up card grid is also removed from
   `/admin/system/information`, `/admin/admin-tasks`,
   `/admin/devices`, `/admin/backup`, and the DHIS2
   organisation-unit page. The same facts move inline into the
   `SyncStatusBar` subtitle.
3. **Local `Hero` component in MoreScreens → adapter over
   `SyncStatusBar`**, so Devices / Backup / Drift etc. pick up
   the standard screen-header pattern automatically.

## 1. Chip pills → quiet markers

### CSS: `.ea-chip` and all tone variants

```css
/* was */
.ea-chip {
  padding: 3px 10px; border-radius: var(--r-pill);
  background: var(--der-raised); color: var(--der-ink-500);
}
.ea-chip--success { background: var(--der-success-soft); color: var(--der-success-ink) }
.ea-chip--warning { background: var(--der-warning-soft); color: var(--der-warning-ink) }
.ea-chip--danger  { background: var(--der-danger-soft);  color: var(--der-danger-ink)  }
.ea-chip--info    { background: var(--der-primary-soft); color: var(--der-primary-ink) }
```

```css
/* now */
.ea-chip {
  padding: 0; border: 0; background: transparent;
  color: var(--der-ink-500); font-size: 13px; font-weight: 500;
}
.ea-chip::before { width: 7px; height: 7px; border-radius: 50%; background: currentColor }
.ea-chip--success { color: var(--der-success-ink) }
.ea-chip--warning { color: var(--der-warning-ink) }
.ea-chip--danger  { color: var(--der-danger-ink)  }
.ea-chip--info    { color: var(--der-primary-ink) }
```

Table-dense + panel-action chip overrides also updated — those
previously forced extra padding on the pills.

### Topbar operating-mode indicator

Also stripped of its soft-background pill. Same `● label`
tone-coloured text pattern, so the global shell reads the same
way as every module page.

### SyncStatusBar

Status label now renders via `<Status tone={…}>` (the quiet
icon + tone-text marker introduced in 2.1.59) instead of
`<span className="ea-chip ea-chip--*">`. So every page header
across the admin UI gets the same quiet treatment.

### Playwright assertions

For every one of the user-listed modules the computed background
colour of `.ea-chip` elements is **transparent**:

```
/sync                 chips with bg: 0, topbar bg: transparent
/dhis2/compat         chips with bg: 0, topbar bg: transparent
/devices              chips with bg: 0, topbar bg: transparent
/sync/data            chips with bg: 0, topbar bg: transparent
/sync/history         chips with bg: 0, topbar bg: transparent
/system/information   chips with bg: 0, topbar bg: transparent
```

## 2. More sub-module KPI tiles removed

| Page | Before | After |
|---|---|---|
| `/system/information` | 4 KpiTiles above the fold (Uptime, Heap, Storage, Database) | Facts inline on the header subtitle |
| `/admin-tasks` | 4 KpiTiles (Uptime, Heap, Sessions, Scheduler) | Facts inline on the header subtitle |
| `/devices` | 4 KpiTiles (Fleet, Approved, Pending, Suspended) | Counts inline on the header subtitle |
| `/backup` | 4 KpiTiles (Total runs, Successful, In flight, Failed) | Counts inline on the header subtitle |
| `/dhis2/organisation-unit` | Custom `ea-dash-hero` card | Standard `SyncStatusBar` with status marker + action button |

The three module-overview pages (Dashboard, DHIS2 overview,
System overview) keep their KPI grids — those pages exist to
summarise state.

## 3. MoreScreens `Hero` → SyncStatusBar adapter

The local `Hero({eyebrow,title,sub,actions,chip})` helper that
rendered `ea-dash-hero` chrome is replaced with a thin adapter
that forwards to `SyncStatusBar`. Every screen that uses `<Hero>`
automatically picks up the standard screen-header pattern (no
`ea-dash-hero` wrapper, no custom spacing). No call-site
changes required.

Icons added to Backup page's action buttons: `+ Audit backup`
gets a plus glyph, `Full backup` gets the backup glyph.

## Live assertion summary

| Check | Observed |
|---|---|
| `.ea-chip` with background on `/sync` | 0 |
| `.ea-chip` with background on `/dhis2/compat` | 0 |
| `.ea-chip` with background on `/devices` | 0 |
| `.ea-chip` with background on `/sync/data` | 0 |
| `.ea-chip` with background on `/sync/history` | 0 |
| `.ea-chip` with background on `/system/information` | 0 |
| `.ea-topbar-mode` background | `transparent` on all pages |
| `.ea-kpi-grid` on `/system/information` | 0 |
| `.ea-kpi-grid` on `/admin-tasks` | 0 |
| `.ea-kpi-grid` on `/devices` | 0 |
| `.ea-kpi-grid` on `/backup` | 0 |
