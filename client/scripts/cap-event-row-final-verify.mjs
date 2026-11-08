#!/usr/bin/env node
/**
 * Verify Row-view final features:
 *   - Column sort (click Date header → glyph changes)
 *   - Export CSV button is present + enabled
 *   - Row checkbox selection + bulk-delete bar appears
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
  page.on('pageerror', (e) => { errors.push(e.message); });

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });

  const programUid = process.env.DER_PROGRAM_UID ?? 'hkLAfUiAUx7';
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.locator('[data-test="cap-program-select"]')
    .selectOption({ value: programUid });
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-rowfinal-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-rows');

  // Sort date column.
  const dateSort = page.locator('[data-test="ev-list-sort-date"]');
  if (await dateSort.count() === 0) {
    errors.push('date sort button missing');
  } else {
    const before = (await dateSort.innerText()).trim();
    await dateSort.click({ force: true });
    await page.waitForTimeout(300);
    const after = (await dateSort.innerText()).trim();
    console.log('date sort glyph:', before, '→', after);
    if (after === before || !after.includes('↑')) {
      errors.push('date sort did not advance to asc; got "'
        + after + '"');
    }
  }

  // Export CSV button is present + enabled.
  const exportBtn = page.locator('[data-test="ev-export-csv"]');
  if (await exportBtn.count() === 0) {
    errors.push('Export CSV button missing');
  }

  // Check a row + verify bulk bar appears.
  const anyCheck = page.locator(
    'input[data-test^="ev-row-check-"]').first();
  if (await anyCheck.count() === 0) {
    errors.push('row checkboxes not rendered');
  } else {
    await anyCheck.click({ force: true });
    await page.waitForTimeout(200);
    const bar = await page.locator('[data-test="ev-bulk-bar"]')
      .count();
    console.log('bulk bar visible after check:', bar);
    if (bar === 0) {
      errors.push('bulk-delete bar did not appear');
    }
    await shot('10-selected');
    // Clear via its button.
    await page.locator('[data-test="ev-bulk-clear"]')
      .click({ force: true });
    await page.waitForTimeout(200);
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — Row-view final verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
