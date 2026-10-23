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

## Open items for alpha.4+

- Admin UI's AuthContext may still call `/edge-api/v1/auth/me` or
  similar — verify it hits the new SPA entry correctly from a real
  browser (Playwright follow-up).
- Package admin-ui/dist into the server JAR so deployment is a
  single artifact; alpha.4 can add a Maven resource plugin step.
