# Phase 07 (backup / restore engine) — Server-Module alignment

> **Scope.** Audits the Phase 07 backup/restore engine (shipped
> `der-0.7.0-alpha.1`) against the Server-Module alignment pattern
> applied to EA-01..18 (`docs/ui/EA-01-18-alignment.md`) and EA-19..36
> (`docs/ui/EA-19-36-alignment.md`). Produced on commit `9629083`.
>
> **Finding.** The engine's operator-facing surface — request a backup,
> list runs, request a restore, upload a restore archive, verify WAL —
> is aligned: every endpoint called by the admin-ui resolves to a
> Spring `@RestController` under the `Security & Audit` nav group. Four
> server endpoints (`/backup/pitr/wal/segments`,
> `/backup/pitr/wal/postgresql-conf`, `/backup/pitr/plan`,
> `/backup/runs/{id}/archive`) are **reserved for future UI** —
> deliberate hold-outs behind the current backup/restore workflow.

## Server endpoints

| Method | Path | Authority gate | Audience |
|---|---|---|---|
| POST | `/edge-api/v1/backup/request` | EdgeUserPrincipal + admin role | admin |
| GET | `/edge-api/v1/backup/runs` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/backup/runs/{id}` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/backup/runs/{id}/archive` | admin | admin (reserved for future UI) |
| POST | `/edge-api/v1/restore/request` | admin | admin |
| POST | `/edge-api/v1/restore/upload` | admin | admin |
| GET | `/edge-api/v1/restore/runs` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/restore/runs/{id}` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/backup/pitr/wal` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/backup/pitr/wal/segments` | EdgeUserPrincipal | reserved for future UI |
| GET | `/edge-api/v1/backup/pitr/wal/postgresql-conf` | admin | reserved for future UI |
| POST | `/edge-api/v1/backup/pitr/plan` | admin | reserved for future UI |
| GET | `/edge-api/v1/backup/pitr/verify/status` | EdgeUserPrincipal | op |
| GET | `/edge-api/v1/backup/pitr/verify/history` | EdgeUserPrincipal | op |
| POST | `/edge-api/v1/backup/pitr/verify/run` | admin | admin |

Path prefixes are singular (`/backup`, `/restore`) in the live server.
See the "Correction" section at the bottom of this doc for a minor
drift in the EA-19..36 traceability table (which used `/backups`
plural) — that doc is amended to match.

## Admin-ui screens

| ID | Component | Canonical route | Nav group | Endpoints called |
|---|---|---|---|---|
| EA-30 | `MockupBackupList` | `/backup` | Security & Audit | `/backup/runs` · `/backup/request` · `/backup/pitr/wal` · `/backup/pitr/verify/status` · `/backup/pitr/verify/history` · `/backup/pitr/verify/run` · `/system/settings` |
| EA-31 | `MockupRestoreList` | `/restore` | Security & Audit | `/restore/runs` · `/restore/request` · `/restore/upload` · `/backup/runs` (LOCAL-source picker) · `/backup/pitr/verify/history` |

## Reserved-for-future-UI endpoints

The four endpoints below exist on the server (Phase 07 technical
plumbing) but are not yet surfaced in any screen:

1. `GET /backup/runs/{id}/archive` — raw archive download. The admin-ui
   `MockupBackupList` lists runs and exposes verify flows but not a
   per-run download button. Access is via direct URL or the `curl`
   runbook in `docs/operations/backup-runbook.md`.
2. `GET /backup/pitr/wal/segments` — WAL segment listing. Deferred
   until the PITR dashboard (post-1.0 roadmap).
3. `GET /backup/pitr/wal/postgresql-conf` — operator-facing PITR
   configuration. Deferred.
4. `POST /backup/pitr/plan` — PITR recovery planner. Deferred.

These are intentional hold-outs, not gaps. They will be wired when the
post-1.0 PITR dashboard initiative is scheduled.

## Verification method

Same approach as EA-01..18 and EA-19..36:

1. Server endpoints: `grep -n '@(Get|Post)Mapping|@RequestMapping' server/src/main/java/ug/ac/mak/der/web/BackupController.java …`.
2. Admin-ui callers: `grep -nE "'/edge-api/v1/(backup|restore)" admin-ui/src/api/edgeApi.ts`.
3. Nav-group membership: `grep -n '/backup\|/restore' admin-ui/src/app/navigation.ts`.

## Correction to EA-19..36 doc

`docs/ui/EA-19-36-alignment.md` originally listed the paths as
`/edge-api/v1/backups` and `/edge-api/v1/restores` (plural). The live
server uses the singular forms `/edge-api/v1/backup` and
`/edge-api/v1/restore`. The EA-19..36 doc has been corrected to match
the paths verified against `BackupController.java` and
`RestoreController.java` on commit `9629083`.

## Combined summary

Across EA-01..36 and Phase 07:

- 54 screen specs, 53 implemented via a direct component, 1 (EA-24)
  implemented cross-module through the shared audit feed.
- 15 backup/restore server endpoints, 11 wired to admin-ui, 4 reserved
  for post-1.0 PITR dashboard.
- All admin-ui-reachable surfaces placed under a Server-Module nav
  group. Zero code changes required by this audit.
