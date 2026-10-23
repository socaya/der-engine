import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * D1: axe-core zero-violations sweep. Walks every admin route and
 * runs @axe-core/playwright with WCAG2A + WCAG2AA + best-practice
 * tags. Writes a per-route JSON report. Opt-in via DER_LIVE_SMOKE.
 */

const LIVE = process.env.DER_LIVE_SMOKE === 'true';
const BASE = process.env.DER_BASE_URL ?? 'http://localhost:8085';
const ADMIN_USER = process.env.DER_BOOTSTRAP_ADMIN_USERNAME ?? 'der-admin';
const ADMIN_PASSWORD = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD ?? '';
const OUT = process.env.DER_AXE_OUT ?? '/tmp/der-axe';

const ROUTES: readonly { path: string; label: string }[] = [
  { path: '/sign-in', label: 'Sign-in' },
  { path: '/', label: 'Overview' },
  { path: '/sync/jobs', label: 'Jobs' },
  { path: '/compat', label: 'Compatibility' },
  { path: '/compat/history', label: 'Compat history' },
  { path: '/metadata', label: 'Metadata' },
  { path: '/apps', label: 'Apps' },
  { path: '/provisioning/users', label: 'Users' },
  { path: '/provisioning/users/new', label: 'Users — new' },
  { path: '/audit/events', label: 'Audit events' },
  { path: '/devices', label: 'Devices' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/settings', label: 'Settings' },
  { path: '/diagnostics', label: 'Diagnostics' },
];

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/admin/`);
  await page.waitForSelector('[data-test="sign-in"]');
  await page.locator('[data-test="sign-in-username-field"] input').fill(ADMIN_USER);
  await page.locator('[data-test="sign-in-password-field"] input').fill(ADMIN_PASSWORD);
  await page.locator('[data-test="sign-in-submit"] button').click();
  await page.waitForURL(/\/admin\/?$/, { timeout: 10_000 });
  await page.waitForTimeout(800);
}

test.describe('Axe accessibility', () => {
  test.skip(!LIVE, 'DER_LIVE_SMOKE != true');
  test.skip(!ADMIN_PASSWORD, 'DER_BOOTSTRAP_ADMIN_PASSWORD not set');
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  test('axe over admin routes', async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page);

    const summary: Array<{ route: string; violations: number; serious: number }> = [];

    for (const r of ROUTES) {
      await page.goto(`${BASE}/admin${r.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze();
      writeFileSync(
        join(OUT, `${r.path.replace(/[^A-Za-z0-9]+/g, '_') || 'home'}.json`),
        JSON.stringify({
          route: r.path,
          label: r.label,
          at: new Date().toISOString(),
          violations: results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            nodes: v.nodes.length,
            targets: v.nodes.slice(0, 3).map((n) => n.target.join(' > ')),
          })),
          incomplete: results.incomplete.length,
          passes: results.passes.length,
        }, null, 2),
      );
      const serious = results.violations.filter((v) =>
        v.impact === 'serious' || v.impact === 'critical',
      ).length;
      summary.push({ route: r.path, violations: results.violations.length, serious });
    }

    writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
    await context.close();

    const totalSerious = summary.reduce((a, s) => a + s.serious, 0);
    expect(totalSerious, `serious/critical a11y violations: ${totalSerious}`)
      .toBeLessThanOrEqual(0);
  });
});
