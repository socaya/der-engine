#!/usr/bin/env node
/**
 * Live-verify SHEET-H:
 *   H1 — freeze status + date columns
 *     Measure the date cell's x position, scroll the sheet
 *     horizontally, verify the date cell's x stayed put
 *     (sticky).
 *   H2 — arrow-key cell navigation
 *     Click an input cell, press Esc (blur to td), press
 *     ArrowRight, verify the next cell is now the focused td.
 *     Press F2, verify the inner input receives focus.
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
    viewport: { width: 1200, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'] });
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
  await page.waitForTimeout(1500);
  await page.locator('[data-test="cap-program-select"]')
    .selectOption({ value: programUid });
  await page.waitForTimeout(2000);
  await page.locator('[data-test="ev-view-sheet"]').click({ force: true });
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-h-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // ---- H1 freeze ---------------------------------------------
  // Pick a visible date cell in the first row.
  const dateCell = page.locator('td.cap-sheet__date-cell').first();
  const beforeBox = await dateCell.boundingBox();
  console.log('date cell x before scroll:', beforeBox?.x);

  // Scroll the sheet wrap horizontally by 400px.
  const wrap = page.locator('.cap-sheet-wrap');
  await wrap.evaluate((el) => { el.scrollLeft = 400; });
  await page.waitForTimeout(400);
  await shot('10-scrolled');

  const afterBox = await dateCell.boundingBox();
  console.log('date cell x after scroll:', afterBox?.x);
  if (!beforeBox || !afterBox
      || Math.abs(beforeBox.x - afterBox.x) > 2) {
    errors.push('date cell did not stay frozen; moved from '
      + beforeBox?.x + ' to ' + afterBox?.x);
  }

  // ---- H2 arrow-key nav --------------------------------------
  // Reset scroll so we can interact with regular data cells.
  await wrap.evaluate((el) => { el.scrollLeft = 0; });
  await page.waitForTimeout(200);

  // Add a blank row to work with.
  await page.locator('[data-test="ev-sheet-add-row"]')
    .click({ force: true });
  await page.waitForTimeout(300);
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const rowIdx = totalRows - 1;

  const startCellTd = page.locator(
    '[data-cell-coord="' + rowIdx + ':2"]');
  await startCellTd.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  // Click into the cell's input (default behaviour — input focused).
  const startInput = startCellTd.locator(
    'input[type="text"],input[type="number"]').first();
  await startInput.click({ force: true });
  await page.waitForTimeout(200);
  // Esc → blur input back up to the td. Our handler then focuses
  // the parent td so arrow keys work.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const afterEsc = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    return { tag: el.tagName,
      coord: el.getAttribute('data-cell-coord') };
  });
  console.log('activeElement after Esc:', afterEsc);
  if (afterEsc?.tag !== 'TD') {
    errors.push('Esc did not blur back to td; got ' + afterEsc?.tag);
  }

  // Arrow right → next cell td is now focused.
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const afterArrow = await page.evaluate(() => {
    const el = document.activeElement;
    return el ? el.getAttribute('data-cell-coord') : null;
  });
  console.log('activeElement coord after ArrowRight:', afterArrow);
  if (afterArrow !== rowIdx + ':3') {
    errors.push('ArrowRight did not focus the next cell; got '
      + afterArrow);
  }

  // F2 → enter edit mode (input focused).
  await page.keyboard.press('F2');
  await page.waitForTimeout(200);
  const afterF2 = await page.evaluate(() => document.activeElement?.tagName);
  console.log('activeElement tag after F2:', afterF2);
  if (afterF2 !== 'INPUT' && afterF2 !== 'SELECT'
      && afterF2 !== 'TEXTAREA') {
    errors.push('F2 did not enter edit mode; activeElement was '
      + afterF2);
  }
  await shot('20-arrow-nav');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-H verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
