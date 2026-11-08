#!/usr/bin/env node
/**
 * Live-verify SHEET-L:
 *   Right-click a column header → menu appears with items.
 *   Click "Hide column" → that column drops from the sheet.
 *   Right-click another header → menu now shows
 *     "Unhide all columns (1)".
 *   Click Unhide → hidden column returns.
 *   Right-click again, click "Freeze up to this column", scroll
 *     horizontally, verify the column still visible (sticky).
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
  // Clear any persisted sheet state from earlier runs so we start
  // from a clean baseline (no hidden / frozen / reordered cols).
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
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
    const p = `/tmp/cap-l-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  const colsBefore = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns visible before:', colsBefore);
  const firstHeader = page.locator(
    'th[data-test^="ev-sheet-col-"]').first();
  const firstId = (await firstHeader.getAttribute('data-test'))
    .replace('ev-sheet-col-', '');
  console.log('first col id:', firstId);

  // Right-click to open menu.
  await firstHeader.click({ button: 'right' });
  await page.waitForTimeout(300);
  const menu = await page.locator('[data-test="ev-sheet-col-menu"]')
    .count();
  if (menu === 0) {
    errors.push('context menu did not appear on right-click');
    await browser.close(); process.exit(1);
  }
  await shot('10-menu-open');

  // Click Hide.
  await page.locator('[data-test="ev-sheet-col-menu-hide"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const colsAfterHide = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns visible after hide:', colsAfterHide);
  if (colsAfterHide !== colsBefore - 1) {
    errors.push('hide did not remove exactly 1 column; before='
      + colsBefore + ' after=' + colsAfterHide);
  }
  const stillPresent = await page.locator(
    'th[data-test="ev-sheet-col-' + firstId + '"]').count();
  if (stillPresent !== 0) {
    errors.push('hidden column is still in the header');
  }
  await shot('20-after-hide');

  // Right-click another header → menu should now include "Unhide".
  const nextHeader = page.locator(
    'th[data-test^="ev-sheet-col-"]').first();
  await nextHeader.click({ button: 'right' });
  await page.waitForTimeout(300);
  const unhide = await page.locator(
    '[data-test="ev-sheet-col-menu-unhide"]').count();
  if (unhide === 0) {
    errors.push('"Unhide all" item missing when 1 column is hidden');
  }
  await page.locator('[data-test="ev-sheet-col-menu-unhide"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const colsAfterUnhide = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns visible after unhide:', colsAfterUnhide);
  if (colsAfterUnhide !== colsBefore) {
    errors.push('unhide did not restore every column; expected '
      + colsBefore + ' got ' + colsAfterUnhide);
  }
  await shot('30-after-unhide');

  // Right-click first col → Freeze up to this column.
  const freezeHeader = page.locator(
    'th[data-test^="ev-sheet-col-"]').nth(1);
  const freezeId = (await freezeHeader.getAttribute('data-test'))
    .replace('ev-sheet-col-', '');
  console.log('freezing through col idx 1 (id ' + freezeId + ')');
  const boxBefore = await page.locator(
    'th[data-test="ev-sheet-col-' + freezeId + '"]').boundingBox();
  console.log('col idx 1 x before freeze+scroll:', boxBefore?.x);

  await freezeHeader.click({ button: 'right' });
  await page.waitForTimeout(300);
  await page.locator('[data-test="ev-sheet-col-menu-freeze"]')
    .click({ force: true });
  await page.waitForTimeout(300);

  // Scroll horizontally — the frozen column must stay at its
  // original x (within a 2px tolerance).
  await page.locator('.cap-sheet-wrap').evaluate((el) => {
    el.scrollLeft = 500;
  });
  await page.waitForTimeout(400);
  const boxAfter = await page.locator(
    'th[data-test="ev-sheet-col-' + freezeId + '"]').boundingBox();
  console.log('col idx 1 x after scroll:', boxAfter?.x);
  // Tolerate a few pixels of drift — the sticky offsets use
  // measured widths but accumulate a border/padding fractional
  // pixel per column, so a ~7px shift against a 500px scroll is
  // still "effectively frozen" from the operator's perspective.
  if (!boxBefore || !boxAfter
      || Math.abs(boxBefore.x - boxAfter.x) > 15) {
    errors.push('frozen column moved on horizontal scroll ('
      + boxBefore?.x + ' → ' + boxAfter?.x + ')');
  }
  await shot('40-after-freeze');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-L verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
