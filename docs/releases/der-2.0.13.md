# der-2.0.13 (stable)

**Date:** 2026-10-25
**Previous stable:** `der-2.0.12`

## Headline

Admin UI polish release — real OU binding in the topbar, breadcrumb
removal, chart redesigns, logo cleanup, and single-row system
topology. Collects every tweak since `der-2.0.12`.

## Changes

### UX
- **Topbar OU chip** now reads the live binding from a new app-wide
  `OrgUnitProvider` + `useOrgUnit` context. The chip was previously
  hard-coded to `—`. Fetches only after `AuthContext` reports
  `AUTHENTICATED` so the first paint doesn't 401. Clicking the chip
  routes to `/integration/organisation-unit`; unbound state renders
  with a warning accent. Binding on the OU form triggers a global
  refresh so every surface updates without a reload.
- **Breadcrumbs removed** from `AdminShell` — section tabs now sit
  directly above the main content.
- **Brand logo** uses the user-specified CSS (
  `max-height: calc(var(--topbar-h) - 8px); max-width: calc(100% - 8px);
   object-fit: contain; object-position: center; display: block;`)
  so the mark reads cleanly with 10 px breathing room above/below
  inside the 60 px brand row.
- **Full-width content** — dropped the 1600 px `max-width` on
  `.ea-main-inner`.

### Charts & stat tiles
- **Priority breakdown** on the Workspace Conflict review card is now
  a stacked segmented bar + colour-coded legend (High / Medium / Low)
  instead of the earlier curved "lines" that read as decorations.
- **24 h sync activity chart** gets subtle 25 % / 50 % / 75 %
  gridlines, 70 %-wide bars, and horizontal numeric hour labels.
- **Ring gauges** — `SCHEDULER / MEMORY / STORAGE` label is now a
  sibling below the ring, not inside the SVG. Percentage stays
  centred.
- **System topology** — `flex-wrap:nowrap + overflow:hidden`; nodes
  share one row via `flex:1 1 0 + max-width:220`, labels ellipsize
  rather than wrap. Vertical stack kicks in below 900 px.
- **Uniform stat cards** — legacy `.ea-stat` restyled to render
  identically to the Atlassian-style `.ea-kpi-tile` so every page
  shares one stat visual.

### System information rebuilt
- `MockupSystemInformation` replaces the plain definition list with
  hero + 4 KPIs (Uptime / JVM heap / Storage used / Database) + 8
  grouped panels (Build / Runtime / Database / Scheduler / Storage /
  DHIS2 / Apps / Journal) + heap and storage progress bars.

### Typography
- Base font sizes nudged back up to Atlassian defaults
  (`--fs-xs 12 / --fs-sm 13 / --fs-md 14`), KPI value 22 px, hero
  title 24 px, panel title 14 px — fixes the overcompaction from
  der-2.0.12 while keeping the overall density.

## Verification

- 244 / 244 admin-ui tests passing.
- Live-verified: topbar OU shows
  `A&A Medcare Medical Centre/Clinic`; topology nodes all on Y 484;
  ring label at Y 554 (ring bottom 548); OU cascade still green
  (484 → 278 → 1).

Evidence:
- `docs/evaluation/evidence/alpha.21-ux-rebalance/`
- `docs/evaluation/evidence/alpha.22-topbar-ou/`
- `docs/evaluation/evidence/alpha.23-topo-rings/`
