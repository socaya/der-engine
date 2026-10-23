import { test, type Page, type BrowserContext } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIVE = process.env.DER_LIVE_SMOKE === 'true';
const BASE = process.env.DER_BASE_URL ?? 'http://localhost:8085';
const ADMIN_USER = process.env.DER_BOOTSTRAP_ADMIN_USERNAME ?? 'der-admin';
const ADMIN_PASSWORD = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD ?? '';
const OUT = process.env.DER_AUDIT_OUT ?? 'audit-out';

type RouteSpec = { path: string; label: string; group: string };

const ROUTES: readonly RouteSpec[] = [
  { path: '/', label: 'Overview', group: 'Home' },
  { path: '/sync/jobs', label: 'Sync — jobs', group: 'Sync' },
  { path: '/sync/jobs/trigger', label: 'Sync — trigger', group: 'Sync' },
  { path: '/sync/drift', label: 'Sync — drift', group: 'Sync' },
  { path: '/journal/conflicts', label: 'Journal — conflicts', group: 'Journal' },
  { path: '/journal/worker', label: 'Journal — worker', group: 'Journal' },
  { path: '/approvals', label: 'Approvals', group: 'Workflow' },
  { path: '/workflows', label: 'Workflows', group: 'Workflow' },
  { path: '/metadata', label: 'Metadata', group: 'Metadata' },
  { path: '/compat', label: 'Compatibility', group: 'Metadata' },
  { path: '/compat/history', label: 'Compat history', group: 'Metadata' },
  { path: '/devices', label: 'Devices', group: 'Fleet' },
  { path: '/analytics', label: 'Analytics', group: 'Fleet' },
  { path: '/apps', label: 'Apps', group: 'Apps' },
  { path: '/provisioning/users', label: 'Users', group: 'Admin' },
  { path: '/provisioning/users/new', label: 'Users — new', group: 'Admin' },
  { path: '/audit/verify', label: 'Audit', group: 'Admin' },
  { path: '/referral/inbox', label: 'Referral inbox', group: 'Workflow' },
  { path: '/recovery', label: 'Recovery tools', group: 'Ops' },
  { path: '/backup', label: 'Backup', group: 'Ops' },
  { path: '/restore', label: 'Restore', group: 'Ops' },
  { path: '/evaluation', label: 'Evaluation reports', group: 'Ops' },
  { path: '/diagnostics', label: 'Diagnostics', group: 'Ops' },
  { path: '/settings', label: 'Settings', group: 'Ops' },
];

interface RouteReport {
  route: string;
  label: string;
  group: string;
  httpAfterLoad: number | null;
  pageUrl: string;
  mainText: string;
  hasTable: boolean;
  hasForm: boolean;
  buttonCount: number;
  linkCount: number;
  consoleErrors: string[];
  pageErrors: string[];
  networkFailures: { url: string; status: number }[];
  screenshotKb: number;
}

function appendReport(entry: RouteReport): void {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'report.json');
  const existing: RouteReport[] = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf-8')) as RouteReport[])
    : [];
  const next = existing.filter((e) => e.route !== entry.route);
  next.push(entry);
  writeFileSync(file, JSON.stringify(next, null, 2));
}

test.describe('DER admin UI audit', () => {
  test.skip(!LIVE, 'DER_LIVE_SMOKE != true');
  test.skip(!ADMIN_PASSWORD, 'DER_BOOTSTRAP_ADMIN_PASSWORD env var not set');
  test.describe.configure({ mode: 'serial' });

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`${BASE}/admin/`);
    await page.waitForSelector('[data-test="sign-in"]');
    await page
      .locator('[data-test="sign-in-username-field"] input')
      .fill(ADMIN_USER);
    await page
      .locator('[data-test="sign-in-password-field"] input')
      .fill(ADMIN_PASSWORD);
    await page.locator('[data-test="sign-in-submit"] button').click();
    await page.waitForURL(/\/admin\/?$/, { timeout: 10_000 });
    await page.waitForTimeout(1200);
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const route of ROUTES) {
    test(`audit ${route.path}`, async () => {
      test.setTimeout(30_000);
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const networkFailures: { url: string; status: number }[] = [];

      const onConsole = (m: { type: () => string; text: () => string }) => {
        if (m.type() === 'error') {
          const t = m.text();
          if (!/favicon|session/i.test(t)) consoleErrors.push(t);
        }
      };
      const onPageError = (e: Error) => pageErrors.push(e.message);
      const onResponse = (r: { status: () => number; url: () => string }) => {
        const s = r.status();
        const u = r.url();
        if (s >= 400 && !u.includes('/edge-api/v1/auth/session')) {
          networkFailures.push({ url: u, status: s });
        }
      };

      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      page.on('response', onResponse);

      const nav = await page.goto(`${BASE}/admin${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });
      await page.waitForTimeout(1000);

      const mainText = (await page
        .locator('main')
        .innerText()
        .catch(() => '')) as string;
      const screenshotPath = join(
        OUT,
        `${route.path.replace(/[^A-Za-z0-9]+/g, '_') || 'home'}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const sizeKb = Math.round(statSync(screenshotPath).size / 1024);

      appendReport({
        route: route.path,
        label: route.label,
        group: route.group,
        httpAfterLoad: nav?.status() ?? null,
        pageUrl: page.url(),
        mainText: mainText.slice(0, 500),
        hasTable: (await page.locator('main table').count()) > 0,
        hasForm: (await page.locator('main form').count()) > 0,
        buttonCount: await page.locator('main button').count(),
        linkCount: await page.locator('main a').count(),
        consoleErrors,
        pageErrors,
        networkFailures,
        screenshotKb: sizeKb,
      });

      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('response', onResponse);
    });
  }
});
