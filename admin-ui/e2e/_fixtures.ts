import { expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

/** Fails the spec on any WCAG 2 A/AA axe-core violation. */
export async function assertNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations,
    JSON.stringify(results.violations, null, 2)).toEqual([]);
}
