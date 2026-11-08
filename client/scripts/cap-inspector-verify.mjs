#!/usr/bin/env node
/**
 * Live-verify the ContextInspector drawer:
 *   • Toolbar button opens the panel
 *   • Panel renders both Sync + Context tabs with real data
 *   • Esc closes the panel
 *   • Alt+D toggles the panel
 */
import { chromium } from 'playwright-core';

async function run() {
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({
    executablePath: chromePath, headless: true,
    args: ['--ignore-certificate-errors', '--disable-dev-shm-usage',
      '--no-sandbox'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message);
    errors.push(e.message); });

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  const signIn = await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });
  console.log('sign-in HTTP:', signIn.status());

  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  await page.locator('[data-test="cap-program-select"]')
    .selectOption({ value: 'ZpnlInpnyt5' });
  await page.waitForTimeout(1500);

  async function shot(name) {
    const p = `/tmp/cap-inspector-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-closed');

  // 1. Click the toolbar button
  const btn = page.locator('[data-test="cap-inspector-btn"]');
  const btnCount = await btn.count();
  console.log('inspector button present:', btnCount);
  if (btnCount === 0) { errors.push('inspector button missing');
    await browser.close(); process.exit(1); }
  await btn.click({ force: true });
  await page.waitForTimeout(400);
  await shot('10-opened-sync-tab');

  const panel = page.locator('[data-test="cap-inspector"]');
  if (await panel.count() === 0) {
    errors.push('inspector panel missing after click');
  }
  const syncBody = page.locator('[data-test="cap-insp-body-sync"]');
  if (await syncBody.count() === 0) {
    errors.push('sync tab body not rendered by default');
  }

  // 2. Switch to context tab
  await page.locator('[data-test="cap-insp-tab-context"]').click();
  await page.waitForTimeout(200);
  await shot('20-context-tab');
  const ctxBody = page.locator('[data-test="cap-insp-body-context"]');
  if (await ctxBody.count() === 0) {
    errors.push('context tab body not rendered after switch');
  }

  // 3. Close via Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (await page.locator('[data-test="cap-inspector"]').count() > 0) {
    errors.push('inspector did not close on Esc');
  }
  await shot('30-closed-via-esc');

  // 4. Toggle via Alt+D
  await page.keyboard.down('Alt');
  await page.keyboard.press('KeyD');
  await page.keyboard.up('Alt');
  await page.waitForTimeout(300);
  if (await page.locator('[data-test="cap-inspector"]').count() === 0) {
    errors.push('inspector did not open on Alt+D');
  }
  await shot('40-opened-via-alt-d');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — ContextInspector verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
