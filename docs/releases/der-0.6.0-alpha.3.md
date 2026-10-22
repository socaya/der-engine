# DER 0.6.0-alpha.3 — Phase 06 Release 3: EA remainder (19-36)

> **Scope:** 18 remaining admin screens. ADR-0011 ACCEPTED (admin-ui/client separation + backup-stub scope). V010 schema for `backup_run` + `restore_run` audit tables.

**Release label:** `der-0.6.0-alpha.3`
**Git tag:** `der-0.6.0-alpha.3`

## New

- **ADR-0011** — admin-ui vs device-client separation; backup/restore
  scope boundary (Phase 06 ships UI + persistence; Phase 07 ships the
  pg_dump orchestration worker).
- **V010 migration** — `backup_run` + `restore_run` stub tables.
- **`admin-ui/src/api/edgeApi.ts`** gains helpers for installed apps,
  backups, restores, diagnostics, and settings.
- **`admin-ui/src/screens/EARemainderScreens.tsx`** — 7 exported
  components covering 18 EA-* screens:
  - EA-19/20/21/22 EARecoveryTools
  - EA-23/24 EABackupList
  - EA-25/26 EARestoreList
  - EA-27/28/29/30 EAEvaluationReports
  - EA-31/32/33/34 EAAppsList
  - EA-35 EADiagnostics
  - EA-36 EASettings
- Routes added under `/recovery`, `/backup`, `/restore`, `/evaluation`,
  `/apps`, `/diagnostics`, `/settings`.

## Test state

- **53 admin-ui tests pass** (33 from alpha.2 EA-01..18 + 20 new).
- Both EA screen files: 100% line, ~89% branch, 97-100% function.
- Thresholds unchanged from alpha.2 (progressive; stable 1.0 raises to 100%).

## Deliberate non-goals

- Server endpoints for `/edge-api/v1/backup`, `/restore`, `/admin/diagnostics`
  and `/admin/settings` ship in Phase 07 (currently return 404 against the
  live DER; the admin-ui error state handles that gracefully).
- Playwright E2E + axe-core — Phase 06.5.
- Shared-helpers contract test — Phase 06.5.
- Server coverage lift back to 100% branch — Phase 07.
