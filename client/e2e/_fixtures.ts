import { expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Shared Playwright mock helpers for the DC screen specs.
 *
 * The specs run against `npm run preview` — a static bundle of the SPA. All
 * network calls out of the SPA are intercepted here so the preview can boot
 * through AuthContext and render each screen deterministically.
 */

export const stdUser = {
  userId: 'u1',
  username: 'alice',
  displayName: 'Alice',
  roles: ['OPERATOR'],
  expiresAt: '2026-12-31T00:00:00Z',
};

export const stdHealth = {
  service: 'der',
  status: 'ok',
  version: '1.0.0-rc.2',
  dhis2Integrated: true,
  dhis2Reference: { version: '2.44' },
  timestamp: '2026-10-22T00:00:00Z',
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Installs the authenticated-user baseline every screen needs:
 *  - `/edge-api/v1/auth/session` → `stdUser`
 *  - `/edge-api/v1/system/health` → `stdHealth`
 *
 * Call before `page.goto()`. Specs that need extra endpoints route them
 * individually after this.
 */
export async function stubBaseline(page: Page): Promise<void> {
  await page.route('**/edge-api/v1/auth/session', (r) => json(r, stdUser));
  await page.route('**/edge-api/v1/system/health', (r) => json(r, stdHealth));
  await page.route('**/edge-api/v1/activity/recent**', (r) => json(r, { entries: [] }));
}

/** Convenience: fulfils `path` globs with the given JSON body. */
export function mock(page: Page, path: string, body: unknown, status = 200): Promise<void> {
  return page.route(path, (r) => json(r, body, status));
}

/**
 * Runs an axe-core scan on the current page and fails the spec if any
 * WCAG 2 A/AA violations are found. Call after the screen has rendered.
 */
export async function assertNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations,
    JSON.stringify(results.violations, null, 2)).toEqual([]);
}

export const mockDataSets = {
  dataSets: [
    { id: 'ds1', displayName: 'Weekly indicators' },
    { id: 'ds2', displayName: 'Monthly indicators' },
  ],
};

export const mockPrograms = {
  programs: [
    { id: 'p1', displayName: 'TB tracker', programType: 'WITH_REGISTRATION' },
    { id: 'p2', displayName: 'Mortality', programType: 'WITHOUT_REGISTRATION' },
  ],
};

export const mockEvents = {
  events: [{
    event: 'EVT12345678',
    program: 'p1',
    programStage: 'ps1',
    orgUnit: 'ou1',
    occurredAt: '2026-10-22T00:00:00Z',
    status: 'ACTIVE',
  }],
  total: 1,
};
