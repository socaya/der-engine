# der-2.0.2-alpha.4 — proxy + CSP + App Hub + strict-mode evidence

**Captured:** 2026-10-23
**Edge:** `localhost:8085` (DER 2.0.2-alpha.3-SNAPSHOT with alpha.4 features)
**Flags enabled for this test run:**
`--der.dhis2.proxy.enabled=true --der.apps.csp.enabled=true`

## 1. DHIS2 `/api/**` passthrough proxy

New controller `Dhis2ApiProxyController` acts as a catch-all for
`/api/**` paths NOT handled by the emulator. Spring MVC picks the
more-specific emulator mapping first.

### Verified live

| Call | Result | File |
|---|---|---|
| `GET /api/analytics?...` (allow-list) | HTTP 409 (proxied, DHIS2 said "no such dimension") | `proxy-analytics-reach.txt` |
| `GET /api/users` (not on allow-list) | HTTP 403 + `path not in proxy allow-list` | `proxy-denied-path.json` |
| `DELETE /api/analytics` (write with allow-writes=false) | HTTP 405 + `writes blocked at proxy` | `proxy-write-blocked.json` |

### Configuration

```yaml
der:
  dhis2:
    proxy:
      enabled: true           # default false → 501 NotImplemented
      allow-writes: false     # default false → GET/HEAD only
      allow-paths: ""         # default = /api/analytics, /api/me,
                              # /api/dataValueSets.json, /api/userDataStore,
                              # /api/dataStore, /api/sqlViews,
                              # /api/visualizations, /api/eventReports,
                              # /api/maps, /api/charts, /api/reports,
                              # /api/indicators, /api/organisationUnitLevels,
                              # /api/categoryOptions,
                              # /api/categoryOptionCombos,
                              # /api/categoryCombos
```

## 2. CSP nonce injection on custom app `index.html`

New flag `der.apps.csp.enabled=true` instructs `AppStaticHandler` to:
1. Generate a per-request 128-bit nonce.
2. Inject `nonce="..."` into every `<script` and `<style` tag.
3. Emit a strict `Content-Security-Policy` header:
   `default-src 'self'; script-src 'self' 'nonce-<n>'; style-src 'self'
   'nonce-<n>' 'unsafe-inline'; img-src 'self' data: blob:;
   connect-src 'self'; font-src 'self' data:; object-src 'none';
   frame-ancestors 'self'`.
4. Force `Cache-Control: no-cache` on HTML (nonces must not be cached).
5. Leave non-HTML assets untouched.

### Verified live

See `csp-headers.txt`:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-_jyhpZG7tXk-XW7i6KCznA'; ...
```

And `csp-index-with-nonce.html` has the body rewritten:
`<script nonce="ahHo92m79n4GBdFN9-Y1kg" src="app.js">...`
Each page view gets a fresh nonce.

## 3. App Hub install-by-URL

New endpoint `POST /edge-api/v1/apps/install-from-url` with
`{"url":"https://...zip"}` body. HTTPS only. Delegates to the
existing `AppInstaller` after a 60-second HTTP GET fetch.

Not live-tested (requires a real App Hub endpoint; unit path validated
in `AppsControllerTest` via the fetch pathway).

## 4. Strict-mode attribution

`CapturedByResolver` gains a `der.attribution.strict` flag (default
false). When true, `enforcedStoredByFor(edgeUserId)` throws
`UserNotMappedException` instead of returning empty — drains that
would otherwise fall back to the service account are now rejected
with `USER_NOT_MAPPED`.

6 `StrictModeTest` cases cover lenient/strict × mapped/unmapped +
exception payload shape.

## Summary

- Server booted in 1.75s with both alpha.4 flags enabled.
- 1360 total tests green (+17 new).
- All three live-verified features behave as spec'd above; the
  installed sample app from alpha.3 continues to serve under CSP.
