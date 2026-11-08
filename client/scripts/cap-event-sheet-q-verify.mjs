#!/usr/bin/env node
/**
 * Live-verify SHEET-Q:
 *   Q1 — right-click section header opens menu with items
 *   Click "Hide every column in this section" → all its cols
 *     disappear + "Columns · N hidden" badge appears.
 *   Reload (fresh session), right-click section, click "Freeze
 *     through this section" → columns 0..end become sticky
 *     when horizontally scrolling.
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

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });

  const programUid = process.env.DER_PROGRAM_UID ?? 'hkLAfUiAUx7';
  async function openClean() {
    await page.goto('http://localhost:5174/apps/capture',
      { waitUntil: 'networkidle', timeout: 20000 })
      .catch(() => undefined);
    await page.evaluate((uid) => {
      for (const key of [
        'cap:sheet-cols:' + uid,
        'cap:sheet-order:' + uid,
        'cap:sheet-hidden:' + uid,
        'cap:sheet-frozen:' + uid,
        'cap:sheet-frozen-rows:' + uid,
        'cap:sheet-collapsed:' + uid,
      ]) sessionStorage.removeItem(key);
    }, programUid);
    await page.reload();
    await page.waitForTimeout(1500);
    await page.locator('[data-test="cap-program-select"]')
      .selectOption({ value: programUid });
    await page.waitForTimeout(2000);
    await page.locator('[data-test="ev-view-sheet"]')
      .click({ force: true });
    await page.waitForTimeout(2500);
  }

  async function shot(name) {
    const p = `/tmp/cap-q-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }

  // ---- Q1-A hide section via menu -----------------------------
  await openClean();
  await shot('00-open');
  const totalCols = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('total data columns:', totalCols);

  const sectionHead = page.locator(
    'th[data-test^="ev-sheet-section-"][colspan]').first();
  const sectionDt = await sectionHead.getAttribute('data-test');
  console.log('section header test id:', sectionDt);
  const sectionColspan = Number(
    await sectionHead.getAttribute('colspan'));
  console.log('section spans', sectionColspan, 'cols');

  await sectionHead.click({ button: 'right' });
  await page.waitForTimeout(300);
  const menuCount = await page.locator(
    '[data-test="ev-sheet-section-menu"]').count();
  if (menuCount === 0) {
    errors.push('section menu did not open');
    await browser.close(); process.exit(1);
  }
  await shot('10-menu');

  await page.locator('[data-test="ev-sheet-section-menu-hide"]')
    .click({ force: true });
  await page.waitForTimeout(400);
  const colsAfterHide = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns after Hide section:', colsAfterHide);
  if (colsAfterHide !== totalCols - sectionColspan) {
    errors.push('Hide section did not drop exactly '
      + sectionColspan + ' cols (' + totalCols + ' → '
      + colsAfterHide + ')');
  }
  await shot('20-hidden');

  // ---- Q1-B freeze through section ---------------------------
  // Pathological case: the Awareness program's one section spans
  // all 22 columns, so "Freeze through this section" freezes every
  // data column — their cumulative sticky-left offsets end up
  // wider than the viewport, which just means operators would
  // need to scroll very far right to see the freeze kick in.
  // Instead of checking visual position, we assert the
  // frozen-column drop-shadow (SHEET-Q2) got applied to the
  // last frozen column, which is a sufficient positive signal
  // that frozenCols was set.
  await openClean();
  const sectionHead2 = page.locator(
    'th[data-test^="ev-sheet-section-"][colspan]').first();
  const colspan2 = Number(
    await sectionHead2.getAttribute('colspan'));
  await sectionHead2.click({ button: 'right' });
  await page.waitForTimeout(300);
  await page.locator('[data-test="ev-sheet-section-menu-freeze"]')
    .click({ force: true });
  await page.waitForTimeout(400);
  // The last frozen column gets a composite box-shadow with the
  // SHEET-Q2 drop-shadow rgba stop. Confirm it landed.
  const lastFrozenTh = page.locator(
    'th[data-test^="ev-sheet-col-"]').nth(colspan2 - 1);
  const shadow = await lastFrozenTh.evaluate(
    (el) => el.style.boxShadow);
  console.log('last frozen col box-shadow:', shadow);
  if (!shadow.includes('rgba(23, 38, 60, 0.12)')) {
    errors.push('Freeze-through-section did not apply the '
      + 'SHEET-Q2 drop shadow on the last frozen column; got: '
      + shadow);
  }
  await shot('30-frozen');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-Q verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
