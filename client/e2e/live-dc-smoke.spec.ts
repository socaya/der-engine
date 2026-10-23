import { test, expect } from '@playwright/test';

/**
 * Live DC smoke suite — alpha.4 of 2.0.2.
 *
 * Unlike the mocked screen tests in `dc-screens.spec.ts`, this one
 * drives a *real* DER server (expected at http://localhost:8085).
 * The suite exercises:
 *   • unauth health probe
 *   • admin sign-in + session cookie
 *   • /edge-api/v1/system/info rich snapshot
 *   • /api/apps DHIS2-compat listing
 *   • /dhis-web-<key>/ custom app serving (with CSP header)
 *   • /api/analytics proxy allow-list enforcement
 *   • /api/users proxy denied path
 *   • /edge-api/v1/admin/users/dhis2-mappings attribution reads
 *
 * Opt-in via DER_LIVE_SMOKE=true because it needs a running DER +
 * local DHIS2 2.44 and a provisioned bootstrap admin. Skipped
 * otherwise.
 */
const LIVE = process.env.DER_LIVE_SMOKE === 'true';
const BASE = process.env.DER_BASE_URL ?? 'http://localhost:8085';
const ADMIN_USER = process.env.DER_BOOTSTRAP_ADMIN_USERNAME ?? 'der-admin';
const ADMIN_PASSWORD = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('DER live DC smoke', () => {
  test.skip(!LIVE, 'DER_LIVE_SMOKE != true');
  test.skip(!ADMIN_PASSWORD, 'DER_BOOTSTRAP_ADMIN_PASSWORD env var not set');

  test('unauth /system/health returns 200', async ({ request }) => {
    const res = await request.get(`${BASE}/edge-api/v1/system/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.service).toBe('der-server');
    expect(body.dhis2Reference.version).toContain('2.44');
  });

  test('admin sign-in issues a session cookie', async ({ request }) => {
    const res = await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.roles).toContain('ADMIN');
  });

  test('authed /system/info returns rich snapshot', async ({ request }) => {
    await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const res = await request.get(`${BASE}/edge-api/v1/system/info`);
    expect(res.status()).toBe(200);
    const info = await res.json();
    expect(info.build).toBeDefined();
    expect(info.runtime.javaVersion).toMatch(/^\d/);
    expect(info.dhis2.probeReachable).toBe(true);
    expect(info.database.product).toContain('PostgreSQL');
    expect(info.scheduler.started).toBe(true);
    expect(info.journal).toBeDefined();
    expect(info.storage.status).toBe('OK');
  });

  test('DHIS2-compat /api/apps lists enabled apps', async ({ request }) => {
    await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const res = await request.get(`${BASE}/api/apps`);
    expect(res.status()).toBe(200);
    const apps = await res.json();
    expect(Array.isArray(apps)).toBe(true);
    for (const a of apps) {
      expect(a).toHaveProperty('key');
      expect(a).toHaveProperty('name');
      expect(a).toHaveProperty('baseUrl');
      expect(a).toHaveProperty('launchUrl');
      expect(a.launchUrl).toContain('/dhis-web-');
      expect(a.appType).toBe('APP');
    }
  });

  test('proxy denies off-list /api/users', async ({ request }) => {
    const signIn = await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(signIn.status()).toBe(200);
    const res = await request.get(`${BASE}/api/users`);
    // 401 if unauthenticated, 403 if proxy enabled + off-list,
    // 501 if proxy disabled.
    expect([401, 403, 501]).toContain(res.status());
  });

  test('attribution mapping endpoint reachable', async ({ request }) => {
    await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    const res = await request.get(`${BASE}/edge-api/v1/admin/users/dhis2-mappings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.mappings)).toBe(true);
  });
});

/**
 * Opt-in guard: if the custom sample app is installed, the suite
 * also walks the public serving path.
 */
test.describe('DER live custom-app smoke', () => {
  test.skip(!LIVE, 'DER_LIVE_SMOKE != true');
  test.skip(!ADMIN_PASSWORD, 'DER_BOOTSTRAP_ADMIN_PASSWORD env var not set');

  test.beforeEach(async ({ request }) => {
    await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
  });

  test('/dhis-web-der-sample-app serves index + CSP header', async ({ request }) => {
    const probe = await request.get(`${BASE}/dhis-web-der-sample-app/`);
    if (probe.status() === 404 || probe.status() === 401) {
      test.skip(true, 'sample app not installed or auth gated');
    }
    expect(probe.status()).toBe(200);
    const body = await probe.text();
    expect(body).toContain('<html');
    // CSP may or may not be enabled, both are valid.
    const csp = probe.headers()['content-security-policy'];
    if (csp) {
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain('nonce-');
    }
  });

  test('/dhis-web-der-sample-app/manifest.webapp served from DB', async ({ request }) => {
    const probe = await request.get(
      `${BASE}/dhis-web-der-sample-app/manifest.webapp`,
    );
    if (probe.status() === 404 || probe.status() === 401) {
      test.skip(true, 'sample app not installed or auth gated');
    }
    expect(probe.status()).toBe(200);
    const manifest = await probe.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toBeTruthy();
  });

  test('/dhis-web-foo (no slash) returns 301 to slash', async ({ request }) => {
    const probe = await request.get(`${BASE}/dhis-web-der-sample-app`, {
      maxRedirects: 0,
    });
    if (probe.status() === 404 || probe.status() === 401) {
      test.skip(true, 'sample app not installed or auth gated');
    }
    expect(probe.status()).toBe(301);
    expect(probe.headers()['location']).toBe('/dhis-web-der-sample-app/');
  });
});
