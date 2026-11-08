#!/usr/bin/env node
/**
 * Live-verify SHEET-M Columns picker:
 *   1. Click "Columns" → popover appears with N checkboxes.
 *   2. Uncheck the first checkbox → that column disappears
 *      from the sheet, "N-1 of N visible" counter updates.
 *   3. Type "Awareness" in the filter → checkbox list shrinks
 *      to columns whose label includes "Awareness".
 *   4. Clear filter, re-check the first checkbox → column
 *      returns.
 *   5. Click "Hide all" → every data column disappears.
 *   6. Click "Show all" → every data column returns.
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
    viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message);
    errors.push(e.message); });
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('[sheet]') || m.type() === 'error') {
      console.log('[page.' + m.type() + ']', t);
    }
  });

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });

  const programUid = process.env.DER_PROGRAM_UID ?? 'hkLAfUiAUx7';
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  // Clear persisted sheet state so the baseline is clean.
  await page.evaluate((uid) => {
    for (const key of [
      'cap:sheet-cols:' + uid,
      'cap:sheet-order:' + uid,
      'cap:sheet-hidden:' + uid,
      'cap:sheet-frozen:' + uid,
    ]) sessionStorage.removeItem(key);
  }, programUid);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.locator('[data-test="cap-program-select"]')
    .selectOption({ value: programUid });
  await page.waitForTimeout(2000);
  await page.locator('[data-test="ev-view-sheet"]').click({ force: true });
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-m-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  const totalCols = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('total data columns:', totalCols);

  // Open picker.
  await page.locator('[data-test="ev-sheet-columns-btn"]')
    .click({ force: true });
  await page.waitForTimeout(400);
  const popoverCount = await page.locator(
    '[data-test="ev-sheet-columns-popover"]').count();
  if (popoverCount === 0) {
    errors.push('Columns popover did not open');
    await browser.close(); process.exit(1);
  }
  const countText = (await page.locator(
    '[data-test="ev-sheet-columns-count"]').innerText()).trim();
  console.log('counter text:', countText);
  if (!countText.includes(totalCols + ' of ' + totalCols)) {
    errors.push('counter does not match total: ' + countText);
  }
  await shot('10-open');

  // Uncheck the first column.
  const firstCheck = page.locator(
    '[data-test^="ev-sheet-columns-check-"]').first();
  const firstFieldId = (await firstCheck.getAttribute('data-test'))
    .replace('ev-sheet-columns-check-', '');
  console.log('unchecking', firstFieldId);
  await firstCheck.click({ force: true });
  await page.waitForTimeout(300);
  const countAfterUncheck = (await page.locator(
    '[data-test="ev-sheet-columns-count"]').innerText()).trim();
  console.log('counter after uncheck:', countAfterUncheck);
  if (!countAfterUncheck.includes((totalCols - 1) + ' of ' + totalCols)) {
    errors.push('counter did not decrement: ' + countAfterUncheck);
  }
  // The actual th should be gone from the sheet.
  const stillPresent = await page.locator(
    'th[data-test="ev-sheet-col-' + firstFieldId + '"]').count();
  if (stillPresent !== 0) {
    errors.push('unchecked column is still in the sheet');
  }
  await shot('20-unchecked');

  // Filter by "Awareness".
  await page.locator('[data-test="ev-sheet-columns-filter"]')
    .fill('Awareness');
  await page.waitForTimeout(300);
  const filteredChecks = await page.locator(
    '[data-test^="ev-sheet-columns-check-"]').count();
  console.log('filtered rows:', filteredChecks);
  if (filteredChecks === 0) {
    errors.push('filter produced no results for "Awareness"');
  }
  if (filteredChecks >= totalCols) {
    errors.push('filter did not narrow the list');
  }
  await shot('30-filtered');

  // Clear filter + re-check firstFieldId to restore it.
  await page.locator('[data-test="ev-sheet-columns-filter"]')
    .fill('');
  await page.waitForTimeout(200);
  await page.locator(
    '[data-test="ev-sheet-columns-check-' + firstFieldId + '"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const restored = await page.locator(
    'th[data-test="ev-sheet-col-' + firstFieldId + '"]').count();
  if (restored !== 1) {
    errors.push('re-checking did not restore the column');
  }

  // Hide all.
  await page.locator('[data-test="ev-sheet-columns-hide-all"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const afterHideAll = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns after Hide all:', afterHideAll);
  if (afterHideAll !== 0) {
    errors.push('Hide all did not hide every column; got '
      + afterHideAll);
  }
  await shot('40-hide-all');

  // Show all.
  await page.locator('[data-test="ev-sheet-columns-show-all"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const afterShowAll = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns after Show all:', afterShowAll);
  if (afterShowAll !== totalCols) {
    errors.push('Show all did not restore every column; expected '
      + totalCols + ' got ' + afterShowAll);
  }
  await shot('50-show-all');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-M verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
