# der-2.1.50 (stable)

**Date:** 2026-10-27
**Previous stable:** `der-2.1.49`

## Headline

Users module polished to the Sync house style. All 5 screens
(`/provisioning/users` · `/access/mappings` · `/access/roles` ·
`/access/sessions` · `/access/credentials`) now use the standard
`.ea-screen-header` + `.ea-chip` + `Panel` primitives with humanised
role labels.

## Changes

### `/provisioning/users` — `MockupUsersDashboard`

- Hero + KPI grid + OU bar all removed. Standard
  `.ea-screen-header` with `Users` + `N provisioned` chip + inline
  Admins count in the subtitle + right-side `+ Add user` button.
- Table columns slimmed to `User · Roles · DHIS2 mapping · Last
  login`. Fake "DER User ID / Organisation Unit / Mapping Status /
  Sync Status" columns dropped — DER User ID moves to the drawer,
  Organisation Unit lives in the topbar, Mapping Status is now a
  single `Unmapped` chip.
- Role chips use `humaniseState()` so operators see `Admin`,
  `Operator`, `Reviewer` instead of the raw `ADMIN` / `OPERATOR` /
  `REVIEWER` enum. Raw name kept on the chip's `title=` tooltip.
- Drawer: avatar + name + mono username + role chips row,
  Details / Permissions / Activity tabs, Validate mapping + Reset
  login buttons at the bottom.

### `/access/mappings` — `CapUserMappings`

- `HeroHeader` + stat strip replaced with `SyncStatusBar`
  (`DHIS2 user mapping` + `N edge users` chip + Admins count in the
  subtitle).
- Table wrapped in `Panel`; role chips humanised; mapping chip
  reads `Unmapped` (not `unmapped`).

### `/access/roles` — `CapRoles`

- `HeroHeader` replaced with the standard status header
  (`Roles & permissions` + `Fixed set` chip).
- Role tiles rebuilt. Each tile shows the humanised label
  (`Admin` / `Operator` / `Reviewer`) as a primary chip + the raw
  enum (`ADMIN` / `OPERATOR` / `REVIEWER`) in muted mono below, plus
  the one-line description.

### `/access/sessions` — `CapSessions`

- `HeroHeader` + stat strip → status bar with `No active sessions`
  / `N active` chip + known-users count in the subtitle.
- The explanatory copy about rotating `DER_SESSION` moved into a
  `Panel` so it reads as a quiet info card rather than a stray
  field hint.

### `/access/credentials` — `CapCredentials`

- `HeroHeader` + form-section card → status bar
  (`Credentials` + `Password only` chip) + `Panel("Credential
  policy")` carrying the def list.
- Chip values humanised: `Not configured` instead of `not
  configured`.

## Live assertions (all green)

Playwright-swept all 5 Users routes:

| Route | H1 | Standard header |
|-------|----|-----------------|
| `/provisioning/users` | `Users 4 provisioned` | ✓ |
| `/access/mappings` | `DHIS2 user mapping 4 edge users` | ✓ |
| `/access/roles` | `Roles & permissions Fixed set` | ✓ |
| `/access/sessions` | `User sessions 7 active` | ✓ |
| `/access/credentials` | `Credentials Password only` | ✓ |

Every screen: no `.ea-dash-hero`, no `.ea-hero`, every status is a
`.ea-chip` next to the H1.

Screenshots: `/tmp/der-users/` (5 pages).
