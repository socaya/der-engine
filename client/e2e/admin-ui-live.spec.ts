import { test, expect } from '@playwright/test';

/**
 * Admin UI end-to-end smoke against a real DER on 8085.
 * Alpha.3 of 2.0.3 — ADR-0033.
 *
 * Opt in via DER_LIVE_SMOKE=true. Verifies the SPA mounts, the login
 * form renders, authentication succeeds, and an authenticated route
 * loads data from /edge-api/v1/**.
 */
const LIVE = process.env.DER_LIVE_SMOKE === 'true';
const BASE = process.env.DER_BASE_URL ?? 'http://localhost:8085';
const ADMIN_USER = process.env.DER_BOOTSTRAP_ADMIN_USERNAME ?? 'der-admin';
const ADMIN_PASSWORD = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD ?? '';

test.describe.configure({ mode: 'serial' });

test.describe('DER admin UI live', () => {
  test.skip(!LIVE, 'DER_LIVE_SMOKE != true');
  test.skip(!ADMIN_PASSWORD, 'DER_BOOTSTRAP_ADMIN_PASSWORD env var not set');

  test('/admin → 302 /admin/', async ({ request }) => {
    const res = await request.get(`${BASE}/admin`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('/admin/');
  });

  test('/admin/ serves SPA shell with asset reference', async ({ request }) => {
    const res = await request.get(`${BASE}/admin/`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('<html');
    expect(body).toMatch(/\/admin\/assets\/index-[A-Za-z0-9]+\.js/);
    expect(body).toContain('DER Administration');
  });

  test('/admin/assets/<js> loads with immutable cache', async ({ request }) => {
    const shell = await request.get(`${BASE}/admin/`);
    const body = await shell.text();
    const jsMatch = body.match(/\/admin\/assets\/(index-[A-Za-z0-9]+\.js)/);
    expect(jsMatch).not.toBeNull();
    const res = await request.get(`${BASE}/admin/assets/${jsMatch![1]}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('immutable');
    expect(res.headers()['content-type']).toContain('javascript');
  });

  test('SPA deep link falls back to index.html', async ({ request }) => {
    const res = await request.get(`${BASE}/admin/scheduler`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
    expect(await res.text()).toContain('<html');
  });

  test('/admin/ renders in Chromium without JS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') {
        consoleErrors.push(m.text());
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    await page.goto(`${BASE}/admin/`);
    await expect(page).toHaveTitle(/DER Administration/i);
    // Wait for the SPA to mount — root div gets content once React boots.
    await page.waitForFunction(
      () => !!document.querySelector('#root')?.children.length,
      undefined,
      { timeout: 10_000 },
    );
    // Session-check 401s from AuthContext are expected before login; filter them.
    const unexpected = consoleErrors.filter(
      (e) =>
        !/401|Unauthorized|AbortError|session|AuthProbeError/i.test(e) &&
        !/favicon/i.test(e),
    );
    expect(unexpected, unexpected.join('\n')).toHaveLength(0);
  });

  test('login via /edge-api/v1/auth/sign-in grants session cookie', async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.roles).toContain('ADMIN');
    const cookies = res.headers()['set-cookie'];
    expect(cookies).toContain('DER_SESSION=');
  });

  test('authenticated /edge-api/v1/admin/users/dhis2-mappings reachable from admin UI origin', async ({
    request,
  }) => {
    const signIn = await request.post(`${BASE}/edge-api/v1/auth/sign-in`, {
      data: { username: ADMIN_USER, password: ADMIN_PASSWORD },
    });
    expect(signIn.status()).toBe(200);
    const res = await request.get(
      `${BASE}/edge-api/v1/admin/users/dhis2-mappings`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.mappings)).toBe(true);
  });

  test('POST /admin/ denied (static-only surface)', async ({ request }) => {
    const res = await request.post(`${BASE}/admin/`);
    expect(res.status()).toBe(401);
  });

  test('missing admin asset → 404 (not SPA fallback)', async ({ request }) => {
    const res = await request.get(
      `${BASE}/admin/assets/does-not-exist-123456.js`,
    );
    expect(res.status()).toBe(404);
  });
});
