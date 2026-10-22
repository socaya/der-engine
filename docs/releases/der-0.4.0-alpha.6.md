# DER 0.4.0-alpha.6 — Phase 05 part B, custom DHIS2 app hosting

> **Scope:** finalise ADR-0005. DER accepts a DHIS2 app `.zip`, validates its `manifest.webapp`, extracts under `~/.der/apps/<key>/<version>/`, and serves `/dhis-web-<key>/**` with the app's `/api/*` XHRs routed to DER's own emulator (ADR-0004).

**Release label:** `der-0.4.0-alpha.6`
**Git tag:** `der-0.4.0-alpha.6`

## New

- V007 — `installed_app` table (UNIQUE `(app_key, version)`).
- `ug.ac.mak.der.apps.*` — `InstalledApp`, `InstalledAppRepository`,
  `AppInstaller` (strict path-traversal check, bundle-size cap),
  `AppStaticHandler` (serves static files; path-safety guard).
- `AppsController` — admin REST for install / list / enable / uninstall.
- SecurityConfig allows `/edge-api/v1/apps/**` + `/dhis-web-**/**`
  for authenticated users.
- Config: `der.apps.root` (default `~/.der/apps`),
  `der.apps.max-bundle-bytes` (default 50 MiB).

## Non-goals

- Client UI tile for installed apps (Phase 06).
- Signed-manifest validation.
- Multi-origin app ↔ `/api/*` routing beyond same-origin.
