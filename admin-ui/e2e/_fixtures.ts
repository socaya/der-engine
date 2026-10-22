import type { Page, Route } from '@playwright/test';

/** Shared Playwright mock helpers for the EA admin-ui screen specs. */

export const stdUser = {
  userId: 'u-admin', username: 'admin', displayName: 'Admin',
  roles: ['ADMIN'], expiresAt: '2026-12-31T00:00:00Z',
};

export const stdHealth = {
  service: 'der', status: 'ok', version: '1.0.0-rc.2',
  dhis2Integrated: true, dhis2Reference: { version: '2.44' },
  timestamp: '2026-10-22T00:00:00Z',
};

export const stdCompat = {
  status: 'OK', profileName: 'V2_44', centralVersion: '2.44',
  probeReachable: true, capabilities: {},
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(body),
  });
}

export async function stubBaseline(page: Page): Promise<void> {
  await page.route('**/edge-api/v1/auth/session', (r) => json(r, stdUser));
  await page.route('**/edge-api/v1/system/health', (r) => json(r, stdHealth));
  await page.route('**/edge-api/v1/compat', (r) => json(r, stdCompat));
}

export function mock(page: Page, path: string, body: unknown, status = 200): Promise<void> {
  return page.route(path, (r) => json(r, body, status));
}
