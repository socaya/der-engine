# der-2.0.3-alpha.3 — admin UI served on port 8085 evidence

**Captured:** 2026-10-23

## Flow verified

```
operator browser → GET  http://localhost:8085/admin           → 302 /admin/
                 → GET  http://localhost:8085/admin/          → 200 index.html (no-cache)
                 → GET  http://localhost:8085/admin/assets/*  → 200 immutable asset
                 → GET  http://localhost:8085/admin/users     → 200 index.html (SPA fallback)
         SPA JS → POST http://localhost:8085/edge-api/v1/auth/sign-in → session cookie
         SPA JS → GET  http://localhost:8085/edge-api/v1/system/info  → 200 (same origin, cookie flows)
```

## Live headers

See `admin-root-headers.txt`, `admin-asset-headers.txt`,
`admin-spa-fallback-headers.txt`:

- Root (`/admin/`): `Content-Type: text/html; charset=UTF-8`,
  `Cache-Control: no-cache`.
- Asset (`/admin/assets/index-CPULC5eN.js`): `Content-Type:
  text/javascript`, `Cache-Control: max-age=31536000, public,
  immutable`.
- SPA deep link (`/admin/users`): `Content-Type: text/html;
  charset=UTF-8`, same no-cache (serves index.html).

`admin-index.html` is the live bytes served for `/admin/` — the
Vite build with `base: '/admin/'` so the asset `src` is
`/admin/assets/...`.

## Security model

- `GET /admin/**` is `permitAll` so the login screen renders
  before authentication.
- All `/edge-api/v1/**` calls remain session-gated — the SPA
  obtains the `DER_SESSION` cookie by posting to
  `/edge-api/v1/auth/sign-in` and the browser carries it on every
  subsequent same-origin request.
- Non-GET methods on `/admin/**` (POST/PUT/DELETE) are rejected
  with 401 by the catch-all matcher — the UI is read-only static
  content.

## Build

```
cd admin-ui && DER_ADMIN_UI_BASE=/admin/ npm run build
cd .. && java -jar server/target/der-server-2.0.3-alpha.3-SNAPSHOT.jar
```

Dist location is configurable via `der.admin-ui.dist` (default
`admin-ui/dist`); missing dist → 503 `ADMIN_UI_NOT_BUILT`.

## Browser verification (alpha.3 follow-up)

Live Playwright suite `client/e2e/admin-ui-live.spec.ts` — 9 tests, all
green (opt in via `DER_LIVE_SMOKE=true`):

- `/admin → 302 /admin/`
- `/admin/` serves SPA shell with Vite-prefixed asset reference
- `/admin/assets/<js>` loads with `immutable` cache
- SPA deep link `/admin/scheduler` → index.html fallback
- `/admin/` renders in Chromium without unexpected JS errors
- Admin sign-in grants `DER_SESSION` cookie
- Same-origin `/edge-api/v1/admin/users/dhis2-mappings` returns 200
- `POST /admin/` denied (static-only surface, 401)
- Missing `/admin/assets/...` returns 404 (does NOT fall through to
  index.html — assets fail fast so loaders don't retry on HTML)

### Screenshots

- `admin-shell.png` — unauthenticated shell rendered at
  `http://localhost:8085/admin/`: "DER Administration" brand +
  nav to Overview/Provisioning/Compatibility/Jobs/Drift/Conflicts/
  Worker/Approvals/Workflows/Devices/Analytics/Audit/Referral/
  Metadata.
- `admin-authenticated.png` — same shell with an active session.
- `admin-jobs.png` — SPA deep link to `/admin/sync/jobs` works via
  react-router basename.

### Fix applied during this smoke

The initial build raised a React Router "Cannot destructure
'basename' of useContext(...) as it is null" because `App.tsx`
used `<Link>` / `<Routes>` without a surrounding Router. Added:

- `admin-ui/src/main.tsx`: wrap `<App />` in
  `<BrowserRouter basename={__DER_ADMIN_BASE__}>`.
- `admin-ui/vite.config.ts`: expose `__DER_ADMIN_BASE__` build
  constant via `define`.
- `admin-ui/src/env.d.ts`: declare the new global.

`basename` reduces to `undefined` when running under dev server
(base = `/`), and to `/admin` when the admin UI is bundled under
`/admin/`. Tests continue to use `MemoryRouter` and are unaffected.

## Open items for alpha.4+

- Package admin-ui/dist into the server JAR so deployment is a
  single artifact; alpha.4 can add a Maven resource plugin step.
