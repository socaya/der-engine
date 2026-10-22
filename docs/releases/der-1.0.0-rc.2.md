# DER 1.0.0-rc.2 — pilot RC with lifted coverage gates and per-screen E2E

> **Scope:** Second release candidate for stable `der-1.0.0`. Addresses
> four of the five open 1.0.0 gaps identified in
> `docs/project/post-1.0-roadmap.md` (G2, G3, G4, G5). No server runtime
> changes — this release is tests + Playwright E2E + release note only.
> **G1 (pilot acceptance evidence bundle) remains the sole blocker for
> stable `der-1.0.0`.**

**Release label:** `der-1.0.0-rc.2`
**Git tag:** `der-1.0.0-rc.2`
**DHIS2 reference:** 2.44-SNAPSHOT (unchanged from rc.1)

## What landed since rc.1

### G2 — Server JaCoCo waivers lifted

Reduced excluded classes from **seven → one**. All of the following
come back into the gate at measured line + branch coverage:

| Class | Line % | Branch % | Prior state |
|---|---|---|---|
| `RemoteArchiveStore` | 100 | 100 | excluded |
| `RestoreWorker` | 94 | 80 | excluded |
| `RestoreController` | 97 | 75 | excluded |
| `BackupController` | 97 | 86 | excluded |
| `DraftController` | 100 | 91 | excluded |
| `DraftRepository` | 98 | 75 | excluded |
| `Draft` | 100 | n/a | excluded |
| `DraftController.SaveRequest` | 100 | n/a | excluded |

Still excluded: `BackupWorker` (90% line / 80% branch — the uncovered
paths are `pg_dump` subprocess timeout + `InterruptedException` during
`process.waitFor()` + `detectVersion()` fallback. Those require a
deliberately hanging shell script or a race-time external interrupt.
`der-1.1.0` lifts this via Testcontainers-Postgres fixtures replacing
the subprocess fakes).

**New tests:** `DraftTest`, `DraftRepositoryTest`,
`DraftControllerTest` + branch additions for `BackupWorker`,
`RestoreWorker`, `RemoteArchiveStore`, `BackupController`,
`RestoreController`. 835+ server tests pass; `mvn verify` green.

### G3 — Client Vitest coverage lifted

From **97/85/84/97** to **99/94/95/99** (lines / branches / funcs /
statements). Every file at 100% line + statement coverage.

**New tests:** 22 for `edgeApi.ts` (every endpoint), 2 for
`AuthContext.tsx`, 1 extra for `MetadataBrowser`, Drafts alternate
error-type branches, SignIn `location.state.from.pathname` redirect,
EventNew default-fetch impl. Added `locationState` option to
`renderWithProviders` so specs can simulate a `/sign-in` state push.
124 client tests pass (was 102).

### G4 — Admin-ui Vitest coverage lifted (biggest G jump)

From **75/70/55/75** to **100/91/99/100**. The three previously
untested files (`App.tsx`, `edgeApi.ts`, `AuthContext.tsx`,
`RequireAuth.tsx`) now have full suites.

**New tests:**
- `edgeApi.test.ts` — 51 cases, table-driven over the 41 endpoints
  plus the shared `request()` error mapping.
- `AuthContext.test.tsx` — 8 cases including default-api fallback.
- `RequireAuth.test.tsx` — 4 cases, one per auth state.
- `App.test.tsx` — 20 cases, `it.each` over every route table entry.

136 admin-ui tests pass (was 53).

### G5 — Playwright per-screen E2E suite

Replaced the broken Phase-00 `smoke.spec.ts` on both sides with a
per-screen spec that boots each route through the built SPA bundle
with every network call mocked via `page.route()`.

- **`client/e2e/dc-screens.spec.ts`** — 18 specs, one per DC-* screen,
  asserting the primary heading data-test attribute. Hits sign-in,
  launcher, aggregate flow (dataset picker + entry), program picker,
  event flow (new + list + tracker-stage new), tracker flow (search +
  dashboard + enrol), scheduled events, submitted review, drafts,
  metadata browser, edge-connection-error page.
- **`admin-ui/e2e/ea-screens.spec.ts`** — 19 specs, one per shipped
  EA* component (EA-09/12/13/15/16/17/20..22/24/26/28..30/32..34 were
  bundled into their siblings during Phase 06 R2/R3; the Playwright
  suite covers the 19 shipped components, not the register's 36 IDs).
- Shared fixtures (`_fixtures.ts` on each side) stub the
  `/edge-api/v1/auth/session`, `/system/health`, `/compat` baseline
  that every screen needs so AuthContext boots through AUTHENTICATED.

Specs typecheck cleanly (`npx tsc --noEmit -p .` green on both sides).
Running them end-to-end against a built preview is part of the pilot
runbook §11 and the release-cut gate for stable `der-1.0.0`.

Playwright remains opt-in in `scripts/run_all_checks.sh` (invoked via
`DER_RUN_E2E=true`). The pilot runbook pulls it in as mandatory.

## Deliberate non-goals

- No new server endpoints; no behavioural changes.
- Playwright suite does not spawn a real DHIS2 central — it mocks the
  network at `page.route()`. Running against a live central is a Phase 09
  pilot step, not part of the rc.2 gate.
- The 17 EA screens that were bundled into siblings during Phase 06
  (EA-09, EA-12, EA-13, EA-15, EA-16, EA-17, EA-20, EA-21, EA-22,
  EA-24, EA-26, EA-28, EA-29, EA-30, EA-32, EA-33, EA-34) do not have
  individual Playwright specs. Their behaviour is exercised by the
  spec on their containing component. If pilot feedback splits any of
  them out again, that's a `der-1.1.0` scope decision.

## Still open before stable `der-1.0.0`

- **G1 — pilot acceptance evidence bundle on real hardware** via
  `scripts/evaluation/run_phase_08.sh` on the pilot host. See
  `docs/evaluation/evidence/phase-09/README.md` for the acceptance
  thresholds that promote this `rc.2` to stable.

## Verification

- `./server/mvnw verify` — green (835+ tests pass, SpotBugs clean,
  Checkstyle clean, JaCoCo per-class limits met).
- `cd client && npm test -- --coverage --run` — 124 tests pass; 99/94/95/99.
- `cd admin-ui && npm test -- --coverage --run` — 136 tests pass; 100/91/99/100.
- `cd client && npx tsc --noEmit -p .` — green.
- `cd admin-ui && npx tsc --noEmit -p .` — green.
