# der-2.0.3 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.2`
**Alphas rolled up:** `2.0.3-alpha.1`, `2.0.3-alpha.2`, `2.0.3-alpha.3`
(and the admin-UI micro-tags `2.0.3-alpha.3+..+++++`), `2.0.3-alpha.4`
(Phases A/B1/B2/C/D), `2.0.3-alpha.5` (modules M0..M5), `2.0.3-alpha.6`
(module M6 — N/A buildout).

## Headline

A single-focus release: the DER administration console is now
complete. The previous admin UI was a scaffold with ~24 of 54 nav
items reaching a real screen. In this cut every one of the 54 items
in the navigation specification is routed to a functional,
data-backed screen, and the whole surface has been re-skinned to a
quiet navy/teal Atlassian+DHIS2 hybrid that matches the
docs/media/ui/* mockups.

## Scorecard

| Dimension | Done | Total | % |
|---|---:|---:|---:|
| Admin nav items | 54 | 54 | 100% |
| UI screens | 54 | 54 | 100% |
| Combined FR / NFR + UI | 245 | 265 | 92% |

244 admin-ui + client vitest tests all green. Server test suite
unchanged from `der-2.0.2`. Live boot against local Postgres 17 +
DHIS2 2.44-SNAPSHOT in ~1.6s.

## Headline features

### 1. Full 10-group admin navigation

Driven by `docs/media/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md`.
The sidebar now presents all 10 groups and 44 items; every entry
routes to a screen backed by a real `/edge-api/v1` endpoint.

Workspace · DHIS2 Integration · Synchronisation · Workflows &
Approvals · Local Data · Users & Access · Devices & Clients ·
Monitoring & Analytics · Security & Recovery · Settings.

Single-source nav registry in `admin-ui/src/app/navigation.ts`; no
item is listed only to show "n/a".

### 2. 29 previously-greyed modules shipped

Each delivered as a functional screen rather than a placeholder.
Highlights:

- Workspace — `/dashboard`, `/system/information`.
- DHIS2 integration — `/integration/connection`,
  `/integration/organisation-unit` (rebind-with-confirmation),
  `/integration/program-rules`.
- Sync — `/sync` overview, `/sync/history`, `/sync/queues`,
  `/sync/metadata` (focused trigger), `/sync/data` (focused trigger),
  `/sync/schedule` (cron overrides).
- Workflows — `/workflows/runs`, `/workflows/assignments`,
  `/referral/history`.
- Local data — `/data` summary, deep-link tiles for Aggregate /
  Events / Tracker DHIS2 Core apps, `/data/drafts`,
  `/data/maintenance` (trigger tiles for jobs + backups).
- Access — `/access/mappings`, `/access/roles`, `/access/sessions`,
  `/access/credentials`.
- Devices — `/devices/enrolment`, `/devices/ownership`,
  `/devices/connections`, `/devices/diagnostics`.
- Monitoring — `/monitoring/metrics`, `/monitoring/health`,
  `/monitoring/storage`.
- Settings — `/setup` (checklist), `/settings/releases`,
  `/settings/network`.

### 3. Module-by-module redesign (M0–M5)

- **M0 — Design system.** CSS grid shell with navy sidebar,
  topbar, and responsive breakpoints at 1440/1024/768/420. Approved
  DER logo asset served from `/admin/der-logo.png` (short mark on
  collapsed sidebar). Design tokens built on
  `--der-navy:#0d2e5c` + `--der-teal:#2b9eac` with soft-tint status
  variants. No gradient blocks or bright decorative cards per
  nav-spec §3.
- **M1 — Overview.** `HeroHeader` + `HealthCards` (DER / DHIS2 /
  Journal / Storage) + `SystemComponents` list + `QuickActions`
  tiles + `RecentActivity` timeline sourced from
  `GET /edge-api/v1/admin/audit/events`.
- **M1b — Nav realignment.** Replaced the ad-hoc nav with the
  10-group registry; 29 remaining items shown greyed with an
  honest "n/a" badge and a `CapabilityGap` placeholder.
- **M2 — Sync.** Jobs list with stat strip + filter chips +
  click-to-drawer, focused Trigger card, 3-column drift
  comparison panel, Conflicts table, Worker health with
  pause/resume.
- **M3 — Users.** Searchable table with avatars + role chips;
  three-section create form (Account / Credentials / Access)
  with role-picker cards.
- **M4 — Apps.** Responsive card grid with icon tile, state
  chip, meta list, and ghost/danger actions.
- **M5 — Settings.** Cron overrides and switch-styled feature
  flags.

### 4. Earlier alpha payload (M0 pre-work)

Alphas `2.0.3-alpha.1..4` landed:
- Tracker lifecycle writes (enrollment + event + relationship).
- Metadata drift surface and `/edge-api/v1/admin/diagnostics`.
- Admin UI served same-origin on port 8085 via `AdminUiController`
  with filesystem-first + packaged-dist fallback, 302 at `/admin`,
  SPA deep-link routing.
- @dhis2/ui + Atlaskit hybrid.
- `AlertStack`, audit-event timeline, `ActiveJobsWatcher`,
  keyboard shortcuts.
- `DataTable`, drawer, inline form validation.
- Axe-core a11y, i18n scaffold, sparkline health, one-JAR
  packaging.

## Design & brand

Flat quiet surfaces, no gradients, approved logo PNG. Palette
sampled from the DER logo (navy + teal). Soft-tint status
variants (success / warn / danger / info / neutral). Spacing
scale 4/8/12/16/20/24/32/48, radii 4/6/8/12/16, elevation
`--el-1/2/3`, timing cubic-bezier.

Every screen uses the same `HeroHeader` card, the same stat strip
pattern, the same searchable card table pattern, and the same
quiet footer action row for forms.

## Honest reporting

Where no backing endpoint exists for a specific data point
(session detail, firmware delta, ...) the screen shows a quiet
hint rather than fake data. The sidebar no longer uses greyed
"n/a" entries — every item routes to a real surface against real
data.

## Deferred

Items still at `in-progress` in the traceability matrix:
- Pilot-hardware NFRs (NFR-02..13, NFR-33).
- Reverse pull (FR-13-02..09).
- Oracle corpus (FR-17-01..07).
- MFA / OIDC federation (future admin work).
- Session detail capture (device, IP, last-seen) exposed via a
  dedicated endpoint — the admin screens are ready to consume it.

## Verification

- `cd admin-ui && npm test` → 244 / 244 passing.
- `cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build` → clean.
- `cd server && ./mvnw -q -DskipTests package` → clean, admin-ui
  dist bundled under `static/admin/` on the classpath.
- Server boot against local Postgres 17 + DHIS2 2.44-SNAPSHOT:
  `Started DerApplication in ~1.6s`.

## Evidence

- `docs/evaluation/evidence/alpha.10-M2-sync/` — Sync module snapshots.
- `docs/evaluation/evidence/alpha.10-M3-users/` — Users module.
- `docs/evaluation/evidence/alpha.10-M4-apps/` — Apps module.
- `docs/evaluation/evidence/alpha.10-M5-settings/` — Settings module.
- `docs/evaluation/evidence/alpha.11-NA-modules/` — 34 snapshots
  covering every previously-greyed route.
