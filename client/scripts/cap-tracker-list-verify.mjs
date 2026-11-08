#!/usr/bin/env node
/**
 * Verify Tracker list polish — metadata columns, sort toggles,
 * CSV export button, row checkbox + bulk bar.
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

  const programUid = process.env.DER_PROGRAM_UID ?? 'ZpnlInpnyt5';
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.locator('[data-test="cap-program-select"]')
    .selectOption({ value: programUid });
  await page.waitForTimeout(3000);

  async function shot(name) {
    const p = `/tmp/cap-tr-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // Verify metadata-driven table rendered
  const headerSorts = await page.locator(
    'button.cap-table__sortbtn').count();
  console.log('sort buttons rendered:', headerSorts);
  if (headerSorts < 2) {
    errors.push('too few sortable headers (' + headerSorts + ')');
  }

  // Verify Export CSV button present
  const exportBtn = await page.locator(
    '[data-test="tr-export-csv"]').count();
  if (exportBtn === 0) {
    errors.push('Export CSV button missing');
  }

  // Sort by UID — glyph should change on click
  const uidSort = page.locator('[data-test="tr-list-sort-uid"]');
  if (await uidSort.count() > 0) {
    const before = (await uidSort.innerText()).trim();
    await uidSort.click({ force: true });
    await page.waitForTimeout(200);
    const after = (await uidSort.innerText()).trim();
    console.log('UID sort glyph:', before, '→', after);
    if (after === before || !after.includes('↑')) {
      errors.push('UID sort did not advance to asc');
    }
  }

  // Check a row + verify bulk bar
  const anyCheck = page.locator(
    'input[data-test^="tr-row-check-"]').first();
  if (await anyCheck.count() === 0) {
    console.log('no TEI rows to check — program may be empty');
  } else {
    await anyCheck.click({ force: true });
    await page.waitForTimeout(200);
    const bar = await page.locator('[data-test="tr-bulk-bar"]')
      .count();
    console.log('bulk bar visible after check:', bar);
    if (bar === 0) {
      errors.push('bulk bar did not appear');
    }
    await shot('10-selected');
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — tracker list polish verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
