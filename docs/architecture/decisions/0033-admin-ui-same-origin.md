# ADR-0033 — Admin UI served same-origin from DER server

**Status:** Accepted (alpha.3 of 2.0.3)
**Date:** 2026-10-23
**Decision owners:** socaya

## Context

Before this ADR, the admin UI (`admin-ui/`) ran as a separate Vite dev
server on port 5173 that proxied `/edge-api` and `/api` to the DER
server on 8085. Operators had to launch two processes and manage CORS
mentally; the deployment story for a pilot edge box was unclear.

The device client (`client/`) already follows a same-origin pattern:
it is served by DER's custom-app engine or by a browser pointed
directly at the DER host. The admin UI should match.

## Decision

Serve the admin UI SPA from the DER server itself at `/admin/`.

- Vite build runs with `base: '/admin/'` so every asset URL is
  prefixed. `DER_ADMIN_UI_BASE` env var toggles between dev (`/`) and
  bundled (`/admin/`).
- New `AdminUiController` streams files from
  `${der.admin-ui.dist:admin-ui/dist}`:
  - `GET /admin` → 302 to `/admin/`.
  - `GET /admin/` → `index.html`, `no-cache`.
  - `GET /admin/assets/<file>` → `max-age=31536000, immutable`
    (safe because Vite content-hashes asset filenames).
  - `GET /admin/<non-asset-deep-link>` → `index.html` so
    react-router handles it (SPA fallback).
  - Missing dist directory → 503 `ADMIN_UI_NOT_BUILT` with the
    expected location, so operators get a clear message instead of
    a stack trace.
- `SecurityConfig`: `GET /admin/**` is `permitAll` so the login
  screen renders. All data calls (`/edge-api/v1/**`) remain
  session-cookie-gated by existing matchers. Non-GET methods on
  `/admin/**` fall through to the catch-all `.authenticated()` so
  only `GET` is public.

## Alternatives considered

- **Separate port for the admin UI** — simpler to build, but every
  pilot operator has to understand CORS, cross-port cookies, and
  two processes. Not chosen.
- **Serve the SPA from a CDN** — not viable for offline-first
  pilot deployments where DER is often the only reachable server.
- **Serve from the custom-app engine (`/dhis-web-admin/`)** —
  works but mixes DER administration (operator-facing) with the
  DHIS2 app simulation layer. Keep concerns separated.

## Consequences

- Deployment is now `java -jar der-server-*.jar` + `admin-ui/dist/`
  on the same host; no second process.
- Session cookie travels naturally; no CORS. No `X-Frame-Options`
  conflicts with the client's `frame-ancestors 'self'` CSP.
- Admin UI builds must be rebuilt against each DER release to keep
  the Vite base path aligned, but `DER_ADMIN_UI_BASE=/admin/` makes
  it a one-env-var operation. Dev workflow (`npm run dev` on 5173)
  is unchanged.
- The anonymous `/admin/**` surface is static HTML/JS/CSS only;
  no data endpoints are exposed through it. The SPA's data calls
  go through `/edge-api/v1/**` which stays protected.

## Verification

- 8 `AdminUiControllerTest` cases: redirect, 503 on missing dist,
  index serving, asset long-cache, SPA fallback, missing asset 404,
  path-traversal guard, content-type mapping.
- Live-verified against `admin-ui/dist/` built with
  `DER_ADMIN_UI_BASE=/admin/`: index, hashed asset, deep-link
  fallback all 200.
- Evidence: `docs/evaluation/evidence/alpha.7-admin-ui-served/`.
