# der-2.0.2-alpha.3 — custom app engine evidence

**Captured:** 2026-10-23
**Edge:** `localhost:8085` (DER 2.0.2-alpha.3-SNAPSHOT)

## Flow verified end-to-end

```
operator → POST /edge-api/v1/apps/install (multipart .zip)      [HTTP 200]
         → GET /api/apps                                         [HTTP 200, DHIS2-shape array]
     DC  → GET /dhis-web-<key>              (no slash)           [HTTP 301 → /dhis-web-<key>/]
     DC  → GET /dhis-web-<key>/             (trailing slash)     [HTTP 200, index.html, no-cache]
     DC  → GET /dhis-web-<key>/manifest.webapp                   [HTTP 200, served from DB]
     DC  → GET /dhis-web-<key>/app.js       (static asset)       [HTTP 200, max-age=3600 public]
     app → fetch('/api/system/info')                             [HTTP 200, DHIS2-emulated]
```

## Live install

```
$ zip -r der-sample-app.zip manifest.webapp index.html app.js
$ curl -b cookies -F "file=@der-sample-app.zip" \
    http://localhost:8085/edge-api/v1/apps/install
→ {"appKey":"der-sample-app","version":"1.0.0","enabled":true, ...}
```

## Alpha.3 upgrades to the engine

| Behavior | Before | Alpha.3 |
|---|---|---|
| `/dhis-web-<key>` (no slash) | 404 | **301** → `/dhis-web-<key>/` |
| `/dhis-web-<key>/` | 404 | **200** + `index.html` |
| `/dhis-web-<key>/manifest.webapp` | 404 unless on disk | **200** from DB-stored manifest JSON |
| Disabled app | still served | **404** |
| `.svg`, `.woff2`, `.woff`, `.mjs` MIMEs | octet-stream | correct |
| Cache-Control | `no-cache` on everything | `no-cache` for HTML, `max-age=3600, public` for assets |
| `/api/apps` endpoint | missing | **200**, DHIS2-compat array |

## Confirmation that app "runs as if on DHIS2"

1. `/api/apps` returns the installed app with `key`, `name`, `baseUrl`,
   `launchUrl`, `version`, `appType=APP`, developer, icons, description.
   Shape matches DHIS2 2.44 so `@dhis2/app-runtime` clients discover
   DER-hosted apps the same way they discover central-hosted ones.
2. `/api/system/info` already returned DHIS2-compat shape with
   `version`, `revision`, `systemId`, `systemName`, `instanceBaseUrl`
   (added earlier in Phase 03.5 — see
   `dhis2emulator/SystemInfoController.java`).
3. The app's XHR to `/api/system/info` from `app.js` succeeded, proving
   same-origin behavior: no CORS, no auth gymnastics.
4. The sample app's manifest is served from DER's DB — the engine's
   authoritative source — not from the on-disk bundle. This means
   `AppManager` metadata (icons, activities, developer) travels with
   the install, not the extracted zip.

## /edge-api/v1/system/info — rich snapshot

Alpha.3 adds `/edge-api/v1/system/info` (admin-only) returning:

- **build:** version, commit, branch, dirty, buildTime
- **runtime:** java version/vendor, OS, hostname, uptime, heap stats
- **dhis2:** central URL, pinned version, probe reachable, central
  version from the compat engine, probe duration, snapshot time
- **database:** PostgreSQL product, Flyway version/count, user +
  active session counts
- **scheduler:** Quartz name, started, standby, executing jobs, total
- **journal:** per-state counts (pending / in-flight / central_accepted
  / central_rejected / retryable / unknown_outcome / conflict_review)
- **storage:** root, status (OK/WARN/REJECT), usable/total/warn/reject bytes
- **apps:** installed/enabled counts + per-app `launchUrl`
- **attribution:** mapped user count

The existing `/edge-api/v1/system/health` stays minimal (anonymous
readiness probe). The two endpoints play complementary roles.

## Known limitations (alpha.4+)

- **DHIS2 `/api/**` passthrough proxy** — custom apps that call,
  e.g., `/api/dataValueSets.json?dataSet=...` currently hit DER's
  emulator which handles aggregate submission but not arbitrary
  reads. Alpha.4 adds a configurable proxy for whitelisted paths.
- **CSP / nonce injection** — `index.html` is served verbatim.
  Alpha.4 can inject a per-request nonce if operator-set strict CSP.
- **App Hub integration** — `appHubId` is `null`; alpha.5 wires
  DHIS2's app-hub so admins can install directly from the hub URL.
