# DER 0.6.0-alpha.2 — Phase 06 Release 2: EA core admin screens (01-18)

> **Scope:** 18 Edge Admin screens built on top of the existing server surface shipped in alphas 0.4.0-alpha.3..0.5.0-alpha.1. Each screen is a focused React component with the required UI states per `docs/ui/screens/EA-*.md`.

**Release label:** `der-0.6.0-alpha.2`
**Git tag:** `der-0.6.0-alpha.2`

## New

- `admin-ui/package.json` gains `react-router-dom` so admin-ui can mount
  the 12 EA routes (18 screens; EA-09/13/15/16/17 share components with
  EA-08/10/14).
- `admin-ui/src/api/edgeApi.ts` — adopted the client's edgeApi + extended
  with admin-only helpers (compat, compatHistory, listJobs, triggerJob,
  drift, listConflicts, resolveConflict, reJournalConflict, workerHealth,
  pauseWorker, resumeWorker, listUsers, createUser).
- `admin-ui/src/auth/AuthContext.tsx` + `components/RequireAuth.tsx` —
  copied from client with a plain spinner (no `@dhis2/ui` dep).
- `admin-ui/src/components/ScreenStates.tsx` — plain-HTML equivalents of
  the client's helpers.
- `admin-ui/src/screens/EACoreScreens.tsx` — 12 exported components:
  - EA-01 EASetupWelcome
  - EA-02 EAUsersList, EA-03 EAUserCreate
  - EA-04 EACompatInspector, EA-05 EACompatHistory
  - EA-06 EAJobsList, EA-07 EAJobTrigger
  - EA-08/09 EADriftInspector
  - EA-10/12/13 EAConflictList + EA-11 EAConflictResolve
  - EA-14/15/16/17 EAWorkerHealth
  - EA-18 EAMetadataOverview
- `admin-ui/src/App.tsx` replaces the Phase-00 shell with a routed layout
  (`react-router-dom`) and primary-nav tiles for each EA domain.
- `admin-ui/src/test/renderWithProviders.tsx` — admin-ui test harness
  mirroring the client's.
- `admin-ui/src/test/setup.ts` — honours the `data-test` attribute
  convention (same as client).

## Test state

- **33 admin-ui tests pass.**
- EACoreScreens: 100% line, 89% branch, 97% function.
- Progressive thresholds for alpha.2: lines/statements ≥ 75%,
  branches ≥ 70%, functions ≥ 55% (reflects edgeApi + AuthContext +
  App.tsx awaiting Playwright coverage). Stable der-0.6.0 raises all
  four to 100%.

## Deliberate non-goals (vs plan)

- Playwright E2E and axe-core deferred to Phase 06.5 polish pass.
- EA-19..36 — Phase 06 Release 3 (`der-0.6.0-alpha.3`).
- Shared-helpers contract test (admin-ui ↔ client edgeApi parity) deferred.
