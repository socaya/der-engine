#!/usr/bin/env node
/**
 * Live-verify SHEET-E:
 *   1. Open sheet mode, add 2 blank rows
 *   2. Fill cells (row0,col2)=A, (row0,col3)=B, (row1,col2)=C,
 *      (row1,col3)=D
 *   3. Click cell (row0,col2), Shift+click (row1,col3) → 2×2 selection
 *   4. Ctrl+C — serialize to TSV, verify clipboard contents
 *   5. Ctrl+Z, Ctrl+Z, Ctrl+Z, Ctrl+Z (four cells reverted)
 *   6. Ctrl+Shift+Z — redo one; verify value re-applied
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
    viewport: { width: 1440, height: 900 },
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
  await page.waitForTimeout(2000);

  async function shot(name) {
    const p = `/tmp/cap-range-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // Add 2 clean rows at the bottom to work with.
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
    await page.waitForTimeout(200);
  }
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const r0 = totalRows - 2;
  const r1 = totalRows - 1;
  console.log('working rows:', r0, r1);

  // Fill 4 cells (two text inputs each on the last two rows)
  async function inputAt(row, nth) {
    return page.locator('tr[data-test="ev-sheet-row-' + row + '"]')
      .locator('input[type="text"],input[type="number"]').nth(nth);
  }
  await (await inputAt(r0, 0)).fill('A');
  await (await inputAt(r0, 1)).fill('B');
  await (await inputAt(r1, 0)).fill('C');
  await (await inputAt(r1, 1)).fill('D');
  await page.waitForTimeout(300);
  await shot('10-filled');

  // Shift-click range: find the TDs of (r0, col=2) (first text col)
  // and (r1, col=3). The TD at col=2 encloses the first text input
  // of the row.
  async function cellTd(row, col) {
    return page.locator(
      '[data-cell-coord="' + row + ':' + col + '"]');
  }
  const c0 = 2; // first metadata column; dates are col -1
  const c1 = 3;
  await (await cellTd(r0, c0)).click({ force: true });
  await page.waitForTimeout(200);
  await (await cellTd(r1, c1)).click({ modifiers: ['Shift'],
    force: true });
  await page.waitForTimeout(200);
  await shot('20-selection');

  // Count selected cells
  const selected = await page.locator(
    'td.cap-sheet__cell--selected').count();
  console.log('selected cells:', selected);
  if (selected !== 4) {
    errors.push('expected 4 selected cells, got ' + selected);
  }

  // Ctrl+C — write selection to clipboard
  await page.keyboard.press('Meta+KeyC');
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  console.log('clipboard after copy:', JSON.stringify(clip));
  if (clip !== 'A\tB\nC\tD') {
    errors.push('clipboard TSV wrong: ' + JSON.stringify(clip));
  }

  // Undo four times → cells revert to empty
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Meta+KeyZ');
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(200);
  const v00 = await (await inputAt(r0, 0)).inputValue();
  const v01 = await (await inputAt(r0, 1)).inputValue();
  console.log('after 4 undos:', v00, v01);
  if (v00 !== '' || v01 !== '') {
    errors.push('undo did not clear all 4 cells');
  }
  await shot('30-after-undo');

  // Redo once → first-cleared cell reappears (last-reverted first).
  await page.keyboard.press('Meta+Shift+KeyZ');
  await page.waitForTimeout(400);
  const vRedo = await (await inputAt(r0, 0)).inputValue();
  console.log('after 1 redo, row0.col0:', JSON.stringify(vRedo));
  if (vRedo !== 'A') {
    errors.push('redo did not restore the first cell; got '
      + JSON.stringify(vRedo));
  }
  await shot('40-after-redo');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-E verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
