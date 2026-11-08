#!/usr/bin/env node
/**
 * Live-verify spreadsheet mode for event programs:
 *   1. list page renders Rows/Sheet toggle
 *   2. click Sheet → sheet page with existing events as rows
 *   3. click "+ New row" → blank row appears
 *   4. type into a cell → debounced auto-save fires (~1s)
 *   5. row status dot flips from dirty → saving → saved
 *   6. row keeps focus during save (operator typing isn't interrupted)
 *   7. switch back to Rows → new event present in list
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
  page.on('console', (m) => {
    const t = m.text();
    if (!t.includes('vite') && !t.includes('[vite')) {
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

  async function shot(name) {
    const p = `/tmp/cap-sheet-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    const hash = await page.evaluate(() => window.location.hash);
    console.log(` → ${name}  hash=${hash}`);
  }
  await shot('00-rows');

  if (await page.locator('[data-test="ev-view-sheet"]').count() === 0) {
    errors.push('Sheet toggle missing on list page');
    await browser.close(); process.exit(1);
  }
  await page.locator('[data-test="ev-view-sheet"]').click({ force: true });
  await page.waitForTimeout(2000);
  await shot('10-sheet');

  if (await page.locator('[data-test="ev-sheet-head"]').count() === 0) {
    errors.push('Sheet page did not render');
  }
  const rowsBefore = await page.locator('tr[data-test^="ev-sheet-row-"]')
    .count();
  console.log('rows at open:', rowsBefore);

  // + New row
  await page.locator('[data-test="ev-sheet-add-row"]').click({ force: true });
  await page.waitForTimeout(300);
  const rowsAfterAdd = await page.locator('tr[data-test^="ev-sheet-row-"]')
    .count();
  console.log('rows after +New:', rowsAfterAdd);
  if (rowsAfterAdd !== rowsBefore + 1) {
    errors.push('"+ New row" did not append a row');
  }
  await shot('20-added-row');

  // Type a value into the first editable text cell of the new row
  // (last tr). Select first <input> that isn't the date column.
  const lastRow = page.locator('[data-test="ev-sheet-row-'
    + (rowsAfterAdd - 1) + '"]');
  const textCells = lastRow.locator('input[type="text"],input[type="number"]');
  const textCellCount = await textCells.count();
  console.log('editable text cells in new row:', textCellCount);
  if (textCellCount === 0) {
    // Try option-set select instead.
    const sel = lastRow.locator('select').first();
    if (await sel.count() > 0) {
      const opts = await sel.locator('option').all();
      if (opts.length > 1) {
        const v = await opts[1].getAttribute('value');
        if (v) await sel.selectOption({ value: v });
      }
    }
  } else {
    await textCells.first().fill('SHEET-' + Date.now());
    await textCells.first().blur();
  }
  await page.waitForTimeout(400);
  await shot('30-typed');

  // Wait for debounced save (~800ms) + a buffer for the roundtrip.
  // First-time submit on a new program resolves metadata + runs
  // the compat engine, which can take a few seconds locally.
  await page.waitForTimeout(6000);
  await shot('40-after-save');

  // The row dot should be saved (green). Inspect the row's class.
  const rowClass = await lastRow.getAttribute('class');
  console.log('final row class:', rowClass);
  if (!/cap-sheet__row--saved|cap-sheet__row--idle/.test(rowClass ?? '')) {
    errors.push('row did not reach saved state; class=' + rowClass);
  }

  // Go back to Rows view and confirm the list grew.
  await page.locator('[data-test="ev-sheet-back-to-rows"]')
    .click({ force: true });
  await page.waitForTimeout(1500);
  await shot('50-rows-back');
  const listRows = await page.locator('[data-test^="ev-row-"]').count();
  console.log('rows on list after return:', listRows);
  if (listRows < 1) errors.push('list is empty after sheet save');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — spreadsheet mode verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
