# der-2.0.3-alpha.3+++ — admin UI refreshed with @dhis2/ui

**Captured:** 2026-10-23

## Design choice

User chose a hybrid: **primary design system = `@dhis2/ui`**, with
`@atlaskit/*` held in reserve for future data-heavy widgets where
`@dhis2/ui` lacks an equivalent (DataTable with sticky columns,
Charts, etc.). ADR-0033 updated.

Rationale:
- The device client (`client/`) already uses `@dhis2/ui` per the
  project memory `project_phase03_ui.md`.
- DER operators are DHIS2 implementers; the admin UI should feel
  like a DHIS2 Core app, not a Jira plugin.
- `@dhis2/ui` ships typography, spacing, blues, elevation that
  match DHIS2 Capture / Maintenance / App Hub so operators move
  between products without context switch.

## New shell

- Blue header bar (DHIS2 primary blue `#1976d2`) with DER logo
  chip and brand "DHIS2 Edge Runtime · Administration".
- Right-side user chip (`Bootstrap administrator`) + Sign-out
  button.
- Horizontal primary nav with active-tab underline (DHIS2
  convention). 13 primary routes consolidated from the 14 flat
  links of alpha.3.
- Max-width 1400px content area on a muted canvas (`#f4f6f8`).

## Sign-in screen

- Centered 380px `@dhis2/ui` Card.
- DER logo chip above the title.
- `InputField` for username (prefilled hint "der-admin") and
  password with `required` + `dense` attributes matching DHIS2
  Core forms.
- Primary `Button` with disabled state until both fields filled;
  loading spinner while submitting.
- `NoticeBox` for errors (`appearance=error`) and edge-down
  warnings (`appearance=warning`).
- Footer shows build version so operators can report the exact
  release when raising issues.

## Live screenshots

- `ui-sign-in.png` — new sign-in page with DER chip, DHIS2
  typography, DHIS2 blue button.
- `ui-authenticated.png` — Overview with the new nav bar + user
  chip; live data from the real DER / DHIS2 2.44-SNAPSHOT backend
  (DER 2.0.3-alpha.3-SNAPSHOT, DHIS2 central version 2.44-SNAPSHOT,
  compat profile V2_44).
- `ui-jobs.png` — Sync tab showing live Quartz scheduler runs
  from the actual journal worker, metadata sync, backup drain,
  analytics refresh, etc.

## Verification

- **242 unit tests green** including the Sign-in test suite
  rewired against the new form markup.
- **18 live Playwright tests green** — 9 admin-ui-live covering
  sign-in, SPA fallback, assets, deep links; 9 live-dc-smoke
  covering `/api/apps`, custom-app serving, attribution mapping.
- **Browser-verified** against DER on `localhost:8085` + DHIS2
  2.44-SNAPSHOT on `localhost:8080`.

## Bundle size

- JS: 266 KB (78 KB gzip) — up from 219 KB (65 KB gzip) in the
  Atlaskit-only direction, driven by `@dhis2/ui` dependency weight.
- CSS: 4 KB (1.3 KB gzip).
- Still comfortable for an offline-first admin console.

## Open items for alpha.4+

- Push `@dhis2/ui` into each of the 36 EA-* screens so the whole
  admin surface is uniformly styled (today only the shell + sign-in
  use `@dhis2/ui`; the inner screens still use ad-hoc markup).
- Introduce an `@atlaskit/dynamic-table` on the sync job list for
  sortable + sticky-header columns on long runs.
- Light/dark mode toggle via `@dhis2/ui-constants` theme tokens.
