# der-2.0.2-alpha.4 — Playwright DC smoke evidence

**Captured:** 2026-10-23
**Spec:** `client/e2e/live-dc-smoke.spec.ts`
**Target:** DER on `localhost:8085` + DHIS2 2.44-SNAPSHOT on `localhost:8080/dhis`
**Flags enabled on DER:** `--der.dhis2.proxy.enabled=true --der.apps.csp.enabled=true`

## Opt-in gate

```
DER_LIVE_SMOKE=true \
DER_BOOTSTRAP_ADMIN_PASSWORD=<secret> \
npx playwright test live-dc-smoke --project chromium-desktop
```

Without `DER_LIVE_SMOKE=true` the suite is skipped so CI doesn't try
to probe a non-existent DER during unit test runs.

## Results

```
Running 9 tests
expected=9 skipped=0 unexpected=0 flaky=0
duration=6.86s
```

See `results.json` for the per-test timing + JSON report.

## Coverage

**DER live DC smoke (6)**
- Unauth `/edge-api/v1/system/health` → 200, DHIS2 2.44 reference confirmed.
- Admin `/edge-api/v1/auth/sign-in` → 200, ADMIN role carried through.
- Authed `/edge-api/v1/system/info` → 200, rich snapshot asserts
  build, runtime, dhis2 probe reachable, database postgres, scheduler
  started, journal shape, storage OK.
- `/api/apps` → DHIS2-compat array shape (`key`, `name`, `baseUrl`,
  `launchUrl`, `appType=APP`).
- Proxy denies off-list `/api/users` → 401/403/501 (tolerant across
  flag combinations).
- Attribution mapping endpoint `/edge-api/v1/admin/users/dhis2-mappings`
  reachable + returns array.

**DER live custom-app smoke (3)**
- `/dhis-web-der-sample-app/` serves index + verifies CSP header if
  present (checks `script-src 'self'` + `nonce-`).
- `/dhis-web-der-sample-app/manifest.webapp` served from DB,
  returns valid manifest JSON with `name` + `version`.
- `/dhis-web-der-sample-app` (no slash) → 301 to trailing slash.

## Running it yourself

1. Start DER: `set -a; source .env.local; set +a;
   java -jar server/target/der-server-2.0.2-alpha.4-SNAPSHOT.jar
   --der.dhis2.proxy.enabled=true --der.apps.csp.enabled=true`
2. Install the sample app (one-time):
   `curl -b cookies -F "file=@scripts/evaluation/der-sample-app.zip"
    http://localhost:8085/edge-api/v1/apps/install`
3. Run the suite as shown above.

## Config choices

- `test.describe.configure({ mode: 'serial' })` because the shared
  sign-in rate limit (`der.security.sign-in.rate-limit-per-ip-per-minute: 30`)
  can trip under parallel execution.
- 401/403/501 all tolerated on proxy-denies: the suite doesn't force
  which flag the deployment runs under.
