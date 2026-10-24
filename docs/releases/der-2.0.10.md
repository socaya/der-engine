# der-2.0.10 (stable)

**Date:** 2026-10-24
**Previous stable:** `der-2.0.9`

## Headline

Admin lifecycle controls — on-site administrators can now stop, restart,
clear sessions, reload DHIS2 config, and tail the server log straight
from the admin UI, no shell on the host required.

## Changes

### Backend
- `LifecycleController` (ADMIN-only) at
  `/edge-api/v1/admin/lifecycle` exposes:
  - `POST /shutdown`          graceful `SpringApplication.exit` with a
    short delay so the HTTP response flushes.
  - `POST /restart`           writes `der.lifecycle.restart-flag`
    (default `/tmp/der-restart.flag`) and exits so a host supervisor
    (systemd / launchd / Docker restart-policy) respawns the process.
  - `POST /clear-sessions`    revokes every active `DER_SESSION` row.
  - `POST /reload-dhis2-config`  returns `OK`; DER already reads the
    editable config on each call, no cache to invalidate.
  - `GET  /logs?lines=N`      tails `der.lifecycle.log-path` (default
    `/tmp/der.log`), 1 – 2000 lines.
- All five endpoints guarded by `@PreAuthorize("hasRole('ADMIN')")`.

### Admin UI
- New `MockupAdminTasks` at `/admin-tasks`:
  - 4 KPIs — Uptime / Heap used / DB sessions / Scheduler.
  - 4 panels — Service control (Shut down / Restart), Sessions (Clear
    all), Configuration (Reload DHIS2 config), Recent server log (lines
    picker + Load button + dark-mode `<pre>` tail).
  - Shutdown / Restart / Clear sessions require a second confirm click.
- `NAV_GROUPS.workspace.items` adds the Admin tasks entry; section
  tabs on the Workspace primary route now show
  `Workspace · System info · Admin tasks`.
- `edgeApi` additions: `adminShutdown`, `adminRestart`,
  `adminClearSessions`, `adminReloadDhis2Config`, `adminLogs`.

## Verification

- 244 / 244 admin-ui tests passing.
- Server build and launch clean on v2.0.10.
- Live-verified: `clear-sessions` revoked 154 sessions,
  `reload-dhis2-config` returned OK, `logs?lines=5` returned 5 of 65.

Evidence: `docs/evaluation/evidence/alpha.19-admin-tasks/`.
