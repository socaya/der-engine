# der-2.1.64 (stable)

**Date:** 2026-10-28
**Previous stable:** `der-2.1.64`

## Headline

Two UI corrections raised in review:

1. **Top-of-page KPI tile strip removed from sub-module pages.**
   The 4-up card grid ("Probe status / Central version / Compat
   profile / Probe RTT") that sat above `/dhis2/compat` and
   similar screens is gone. The information moves inline into the
   standard screen header subtitle, where it reads as one line
   of facts instead of four cards competing for attention.
2. **Emoji row icons replaced with professional line SVGs.** The
   sync activity + queue tables used `📦 📊 📥 🔌 💾 🩺 ⚙` for
   row glyphs. Those are now rendered via `UiIcon` as inline SVGs
   so they match the sidebar/section-tab/button vocabulary.

## 1. Compat page — KPI tiles out, inline facts in

### Before

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Probe status │ Central      │ Compat       │ Probe RTT    │
│ reachable    │ 2.44-SNAPSHOT│ profile V2_44│ 882 ms       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### After

```
Compatibility  ● Central reachable           [ ↻ Probe now ]
Central 2.44-SNAPSHOT · Profile V2_44 · Probe RTT 875 ms ·
   Captured 1m ago · 100% reliability over last 50 probes
```

That's a `SyncStatusBar` call — identical to every other DER
screen header — with the KPI numbers inlined into the subtitle.
Four cards saved; the same five facts are visible in one
scannable line.

The underlying `.ea-kpi-grid` + `KpiTile` continue to work; they're
simply not used on sub-module pages anymore. The three legitimate
"module overview" pages (Dashboard, DHIS2 overview, System
overview) keep their KPI grids as those pages exist specifically
to summarise state.

Playwright: `.ea-kpi-grid` count on `/dhis2/compat` is **0** after
this release.

## 2. Row icons — SVG not emoji

### Vocabulary added to `UiIcon`

| Concept | Icon |
|---|---|
| Aggregate data | `aggregate` — 4×4 grid |
| Single event | `event` — calendar with tick |
| Tracker event | `tracker-event` — calendar document |
| Enrollment | `enrollment` — clipboard-check |
| Tracked entity instance | `tei` — person |
| Organisation unit | `org-unit` — building |
| Program | `program` — folder stack |
| Data element | `data-element` — document |
| Referral | `referral` — inbox-in |
| Compatibility | `compat` — plug |
| Backup rotation | `backup` — cylinder |
| Analytics refresh | `analytics` — bar chart |
| Drift snapshot | `drift` — scatter |
| Generic process | `cog` — gear |

### Wiring

- `SyncActivityShape.icon` is now typed as `UiIconId`
  (previously `string` emoji).
- `entityTypeIcon(type)` returns a `UiIconId`.
- Every consumer renders `<UiIcon icon={shape.icon} size={18} />`
  with `color: var(--der-ink-500)` inside the row cell, so icons
  pick up the subtle grey tone and match the rest of the admin UI.
- Screens migrated: `SyncOverview`, `DataQueues`, `DataManagement`,
  `SyncHistory` (list + mirror-counts + journal-ops), `MoreScreens`
  (attention / approvals / referrals).

Also removed the leading `shape.icon` string from the
`SyncHistory` detail-page title, where it rendered as a bare `📦`
char next to the H1.

## Live assertions

| Check | Observed |
|---|---|
| `.ea-kpi-grid` count on `/dhis2/compat` | 0 |
| Compat header carries inline facts | "Central 2.44-SNAPSHOT · Profile V2_44 · Probe RTT 875 ms · Captured 1m ago · 100% reliability over last 50 probes" |
| `/sync` row first-cell SVG count | 8 |
| `/sync` row emoji in first cell | 0 |
| `/sync/data` row first-cell SVG count | 2 |
