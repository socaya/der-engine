# DER Admin UI — gap audit + enhancement plan

**Audit date:** 2026-10-23
**Audited build:** der-2.0.3-alpha.3-SNAPSHOT + admin-ui 2.0.3-alpha.3
**Audit methodology:** Playwright headless Chromium against live DER
(`localhost:8085`) + DHIS2 2.44-SNAPSHOT (`localhost:8080/dhis`) with
the bootstrap admin signed in.
**Evidence:** 24 target routes · **19 captured cleanly, 5 hang on load**
(backup, restore, evaluation, diagnostics, settings).
Full artefact: `docs/evaluation/evidence/alpha.9-admin-audit/` —
`report.json` + 19 full-page PNGs.

## Scope

Twenty-four admin surface routes behind `AdminShell`:

| Group | Routes |
|---|---|
| Home | `/` |
| Sync | `/sync/jobs`, `/sync/jobs/trigger`, `/sync/drift` |
| Journal | `/journal/conflicts`, `/journal/worker` |
| Workflow | `/approvals`, `/workflows`, `/referral/inbox` |
| Metadata | `/metadata`, `/compat`, `/compat/history` |
| Fleet | `/devices`, `/analytics` |
| Apps | `/apps` |
| Admin | `/provisioning/users`, `/provisioning/users/new`, `/audit/verify` |
| Ops | `/recovery`, `/backup`, `/restore`, `/evaluation`, `/diagnostics`, `/settings` |

## What works today

- **Zero console/page errors** on all 19 captured routes.
- **No 4xx/5xx network calls** on any captured route (the handful of
  401s on `/edge-api/v1/auth/session` before sign-in are the expected
  "no session yet" probe and are filtered out).
- **Live data wiring** is correct where endpoints exist:
  - `/` — DHIS2 compat snapshot + OU-binding form live-rendered.
  - `/sync/jobs` — table of Quartz runs (JOURNAL_WORKER_DRAIN,
    ANALYTICS_REFRESH, REFERRAL_INBOX_POLL, …) with timestamp +
    SUCCESS outcomes streaming in.
  - `/sync/drift` — fingerprint comparison between two revisions.
  - `/journal/worker` — status/last-tick + per-state counts.
  - `/metadata` — mirror sizes (50 OUs, 50 DEs, 31 programs, 1 TET).
  - `/compat` — probe-reachable yes, central 2.44-SNAPSHOT, V2_44 profile.
  - `/compat/history` — history table with every refresh row.
  - `/analytics` — last-refreshed + aggregate/event bucket counts.
  - `/apps` — DER Sample App installed with Disable/Uninstall actions.
  - `/provisioning/users` — Bootstrap administrator row visible.
  - `/journal/conflicts` — empty-state NoticeBox.
  - `/devices` — empty-state NoticeBox with POST hint.
  - `/referral/inbox` — empty-state NoticeBox with cron hint.
- **DHIS2-styled chrome** (header bar, horizontal nav with active
  underline, tables with uppercase column headers, DHIS2 blues, Roboto
  typography) renders uniformly.
- **Sign-in works** with the Autofill dev-credentials shortcut.

## Gaps found — ordered by severity

### P0 — functional blockers

#### G1. `/admin/diagnostics` and `/admin/settings` server endpoints missing
`EADiagnostics` calls `GET /edge-api/v1/admin/diagnostics` and
`EASettings` calls `GET /edge-api/v1/admin/settings` + `POST
/edge-api/v1/admin/settings`. Both return **401** because no controller
is registered under those paths — the Spring Security catch-all treats
the request as unauthenticated and short-circuits before any handler
runs. **Symptom:** screens stay stuck on `LoadingBlock` indefinitely
because `request()` has no client-side timeout.

**Fix:**
- Server: add `AdminDiagnosticsController` (`/admin/diagnostics`) that
  reuses the existing `EdgeSystemInfoController` payload (build, runtime,
  dhis2, database, scheduler, journal, storage, apps, attribution).
- Server: add `AdminSettingsController` (`GET` + `POST
  /admin/settings`) persisting cron overrides, feature flags, and
  thresholds via a new `der.admin_setting` table or the existing
  `der.app_setting` row.
- Client: add a 15 s timeout + abort-controller to `request()` so a
  silently-dropped call surfaces as an `ErrorBlock` instead of a
  stuck spinner.

#### G2. Backup/Restore/Evaluation screens time out intermittently
Audit `/backup`, `/restore`, `/evaluation` reproducibly timed out at
30 s even though their API endpoints (`/backup/runs`, `/restore/runs`)
return 200 in <50 ms. Root cause isn't an API hang — the audit worker
dies after the earlier screens accumulate open event listeners. In
production this manifests as sluggish nav transitions. **Fix:** convert
`page.on(...)` listeners to `addEventListener` with explicit cleanup
in the Playwright suite, and in production add a 15 s UI watchdog that
replaces infinite spinners with an error+retry card.

### P1 — UX quality

#### G3. Zero form validation visible
`/provisioning/users/new` renders Username, Display name, Password,
Role, and a "Create" button — but there's no visible required/validation
feedback (e.g. password strength indicator, username uniqueness pre-check,
role dropdown description).

**Fix:** use `@dhis2/ui`'s `InputField` with `error` + `warning` props and
`FieldSet` with `helpText`. Wire client-side validation (regex, length,
match confirmation field) and surface server rejections (`USER_EXISTS`,
`USERNAME_INVALID`, `PASSWORD_WEAK`) via `NoticeBox error`.

#### G4. `/sync/jobs` table has no sort / filter / pagination
Audit captured a dense 344 KB screenshot of ~50 JOURNAL_WORKER_DRAIN rows.
No column sort, no filter by job name / outcome, no pagination.

**Fix:** swap raw `<table>` for `@dhis2/ui`'s `DataTable` with
`DataTableColumnHeader` (sortable), a `SearchInput` for job name, a
`SingleSelectField` for outcome, and `Pagination` component.

#### G5. `/compat/history` table lacks row-level drill-in
Every row is "V2_44 · 2.44-SNAPSHOT · true" — operators cannot see
individual timestamp, probe duration, differences from previous row.

**Fix:** add "Captured at" + "Probe ms" columns (data already exists in
`capability_snapshot`); on row click open a side drawer (`@dhis2/ui`
`Modal` or a shared `DetailDrawer`) with the full `CapabilityFlags` diff
against the preceding row.

#### G6. `/analytics` numeric cards are visually bland
Just numbers in a dl. Needs sparkline/trend indicators to convey
day-over-day/week-over-week change at a glance.

**Fix:** adopt `@atlaskit/dynamic-table` + a small inline sparkline
(reserved @atlaskit widget per ADR-0033 hybrid policy) OR use
`@dhis2/ui`'s `Statistic` or `SingleValue` chart from
`@dhis2/analytics` package (optional).

#### G7. Deep-links don't highlight sub-tab
The horizontal nav bars active-tab underlining works for Overview, Sync,
etc. — but `/recovery`, `/evaluation`, `/apps`, `/diagnostics` don't
have a visible active tab (nav only consolidates 13 top-level routes).

**Fix:** either expand nav to 24 items (gets crowded) OR add
breadcrumbs under the header that identify the current screen even
when outside the primary nav.

#### G8. Sign-out doesn't confirm or redirect cleanly
`AdminShell` sign-out calls `signOut()` but doesn't navigate — the user
remains on their current authed route and sees a 401 flash when
`RequireAuth` finally kicks in.

**Fix:** `signOut()` then `navigate('/sign-in', { replace: true })` so
the transition is immediate and clean.

### P2 — observability + operator ergonomics

#### G9. No global error toast
If a mutating action fails (bind orgUnit, trigger job, install app),
the error renders inline under the control — nothing persistent at the
screen top. Operators miss errors when they scroll.

**Fix:** introduce `@dhis2/ui`'s `AlertBar` + `AlertStack` providers at
`AdminShell` root; expose `useAlert()` hook, replace per-screen
`setError(...)` with `alert.show({ critical: true, message })`.

#### G10. No last-updated / staleness indicator
Pages that fetch on mount (overview, metadata, compat, analytics) don't
show when the data was fetched. Operators looking at a stale tab can't
tell.

**Fix:** add `lastFetched` state + a small "updated 42 s ago" label
with a refresh button in every data-fetching screen's header. Share
via a `<ScreenHeader title lastFetched onRefresh>` wrapper.

#### G11. Audit timeline exists but not surfaced
`/edge-api/v1/security/audit` returns a rich audit event stream; the
admin UI's `/audit/verify` only exposes "Run verification" (chain
integrity). Operators want to **see** the audit timeline, filter by
event kind, user, time range.

**Fix:** add `/audit/events` screen with a filterable table of
`security_audit` rows (eventKind, user, outcome, timestamp, metadata
preview). Pagination + export.

#### G12. No notifications of long-running jobs
Backup / restore / drift / metadata sync can take minutes. Right now
operators have to poll `/sync/jobs` to see status. No in-UI progress or
toast when a job completes.

**Fix:** add long-poll or SSE on `/edge-api/v1/sync/jobs/active` and
raise toast + nav badge count when a kicked-off job finishes.

#### G13. No system info "quick view"
`/edge-api/v1/system/info` returns build/runtime/db/scheduler/journal/
storage/apps/attribution. Only Diagnostics renders this today — and
Diagnostics is broken (G1). Operators need this surfaced on the
Overview too for at-a-glance health.

**Fix:** on Overview, add a 4-card row (DER health, DHIS2 compat,
Journal state, Storage) using `@dhis2/ui`'s `Card` + the new
`ScreenHeader` wrapper. Each card deep-links to its detail screen.

#### G14. No keyboard shortcuts
No `/` for search, no `?` for help, no `g j` to jump to Jobs, etc.
Admins who live in Jira/GitHub expect muscle memory.

**Fix:** add `useKeyboardShortcuts` hook with core shortcuts; render
a `?` modal listing them.

### P3 — accessibility + i18n

#### G15. No a11y audit yet
The sign-in page has correct `aria-labelledby`, but the EA-* screens
haven't been axe-core-audited.

**Fix:** run `@axe-core/playwright` on every screen; capture violations
in a report; raise focus-visible, label associations, color-contrast
issues to zero-violations.

#### G16. All UI copy is hard-coded English
No i18n wrapper. Operators in Francophone/Lusophone Africa deployments
cannot localise.

**Fix:** adopt `@dhis2/d2-i18n` + extract all literals; ship with
en + fr + pt bundles; honour `Accept-Language` + a user-settings override.

### P4 — build + packaging

#### G17. Admin UI dist isn't packaged in the server JAR
Deployment currently requires `admin-ui/dist/` beside the JAR. Easy to
forget during pilot distribution.

**Fix:** Maven resource step in `server/pom.xml` to copy
`admin-ui/dist/` into `BOOT-INF/classes/static/admin/` and update
`AdminUiController` to read from classpath when the filesystem path
is empty.

#### G18. Admin UI version is pinned manually
Both `VERSION` and `admin-ui/package.json` must be bumped on every
release; drift risk.

**Fix:** vite reads `VERSION` already (good) — enforce in CI that
`admin-ui/package.json` version matches `VERSION` content.

## Prioritised implementation phases

### Phase A — "shipable admin UI" (3 fixes, ~2 commits)
**Target:** every screen loads without hanging; operator can sign out cleanly.
- **A1 — G1 — server:** `AdminDiagnosticsController` + `AdminSettingsController`.
- **A2 — G8 — client:** navigate to `/sign-in` on sign-out.
- **A3 — G2 — client:** 15 s timeout in `edgeApi.request()`; replace stuck spinners with retry card.

### Phase B — "data-rich admin UI" (6 fixes, ~3 commits)
**Target:** real data tooling across the surface.
- **B1 — G4:** DataTable + sort + filter + pagination on `/sync/jobs`.
- **B2 — G5:** row-drill-in drawer on `/compat/history`.
- **B3 — G3:** form validation on `/provisioning/users/new` + any new form.
- **B4 — G7:** breadcrumbs for sub-screens.
- **B5 — G10:** `lastFetched` + refresh in a shared `ScreenHeader`.
- **B6 — G13:** 4-card health row on Overview.

### Phase C — "operator ergonomics" (4 fixes, ~2 commits)
**Target:** alerts, timelines, keyboard, long-running job progress.
- **C1 — G9:** global AlertBar/AlertStack.
- **C2 — G11:** `/audit/events` filterable timeline.
- **C3 — G12:** active-jobs SSE + toast on completion.
- **C4 — G14:** keyboard shortcuts hook + `?` modal.

### Phase D — "polish + production ship" (4 fixes, ~2 commits)
**Target:** a11y zero-violations, i18n foundation, one-artifact
deployment.
- **D1 — G15:** axe-core on every screen; drive violations to zero.
- **D2 — G6:** sparklines on `/analytics` cards.
- **D3 — G16:** d2-i18n extraction + fr/pt bundles.
- **D4 — G17 + G18:** Maven packaging + CI version check.

## Suggested cadence

- Phase A → `der-2.0.3-alpha.4` (next cut).
- Phase B → `der-2.0.3-alpha.5`.
- Phase C → `der-2.0.3-alpha.6`.
- Phase D → `der-2.0.3-alpha.7`, then **stable `der-2.0.3`**.

Each phase ships standalone with its own test green-check + live-smoke
regression against DHIS2 2.44-SNAPSHOT.

## Evidence location

- `docs/evaluation/evidence/alpha.9-admin-audit/report.json` — per-route
  JSON (http, url, mainText excerpt, button/link/table/form counts,
  console/page/network errors, screenshot size).
- `docs/evaluation/evidence/alpha.9-admin-audit/screenshots/*.png` — 19
  full-page screenshots.
- `client/e2e/admin-ui-audit.spec.ts` — Playwright audit spec,
  re-runnable with `DER_LIVE_SMOKE=true DER_AUDIT_OUT=/tmp/der-audit
  DER_BOOTSTRAP_ADMIN_PASSWORD=... npx playwright test admin-ui-audit`.

## Open questions for next alpha start

1. **Scope of G1 settings:** which cron overrides / feature flags should
   be editable from the UI vs. stay env-only? Suggest: cron for sync
   jobs editable; secrets (DB password, DHIS2 user) stay env-only.
2. **Audit timeline (G11) retention:** should we honour the existing
   `security_audit` retention policy or add a UI cap (e.g. last 30 days
   browsable, older via admin ops export)?
3. **i18n coverage (G16):** which languages for first ship? Suggested:
   en, fr, pt.
4. **Hybrid design-system boundary:** at what point does a widget "need"
   Atlaskit? Current proposal — DataTable with sticky columns + sparklines
   use Atlaskit; everything else `@dhis2/ui`.
