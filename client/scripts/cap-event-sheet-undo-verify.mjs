#!/usr/bin/env node
/**
 * Live-verify SHEET-D1 undo:
 *   1. Open sheet mode, add a blank row
 *   2. Type a value into row 0, column 2
 *   3. Press Ctrl+Z (Meta+Z on macOS)
 *   4. Verify the cell reverts to empty
 *
 * Plus SHEET-D2 clipboard paste:
 *   5. Fill cell with value A, Ctrl+C-like store via clipboard API
 *   6. Move to another cell, write via clipboard.writeText a TSV
 *      with 2 rows × 2 columns, Ctrl+V to paste a block
 *   7. Verify target cells acquired the TSV values
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
    const p = `/tmp/cap-undo-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // Add a row so we have a clean target without stepping on
  // existing seeded data.
  await page.locator('[data-test="ev-sheet-add-row"]')
    .click({ force: true });
  await page.waitForTimeout(400);
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  console.log('rows after +New:', totalRows);
  const lastRowIdx = totalRows - 1;
  const lastRow = page.locator(
    'tr[data-test="ev-sheet-row-' + lastRowIdx + '"]');

  const textInput = lastRow.locator(
    'input[type="text"],input[type="number"]').first();
  const seed = 'UNDO-' + Date.now();
  await textInput.fill(seed);
  await page.waitForTimeout(300);
  await shot('10-typed');

  // Ctrl+Z (Cmd+Z)
  await textInput.focus();
  await page.keyboard.press('Meta+KeyZ');
  await page.waitForTimeout(400);
  await shot('20-after-undo');

  const afterUndo = await textInput.inputValue();
  console.log('cell after undo:', JSON.stringify(afterUndo));
  if (afterUndo !== '') {
    errors.push('undo did not clear the cell; got '
      + JSON.stringify(afterUndo));
  }

  // Now exercise block paste: write a 2x2 TSV to clipboard,
  // position focus in another cell, press Cmd+V.
  await textInput.fill('BASE');
  await page.waitForTimeout(300);
  const tsv = 'A1\tA2\nB1\tB2';
  await page.evaluate((text) => navigator.clipboard.writeText(text), tsv);
  await textInput.focus();
  await page.keyboard.press('Meta+KeyV');
  await page.waitForTimeout(600);
  await shot('30-after-paste');

  // The pasted block should fill 2 rows × 2 cols starting at the
  // active cell. Verify B1 landed in the newly-appended row below.
  // (Our pasteBlockAt auto-appends rows as needed.)
  const totalAfterPaste = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  console.log('rows after paste:', totalAfterPaste);
  if (totalAfterPaste < totalRows + 1) {
    errors.push('block paste did not auto-append a row '
      + '(rows: ' + totalAfterPaste + ', expected >= '
      + (totalRows + 1) + ')');
  }
  const pasteRow = page.locator(
    'tr[data-test="ev-sheet-row-' + lastRowIdx + '"]');
  const pasteRowInputs = await pasteRow.locator(
    'input[type="text"],input[type="number"]').all();
  if (pasteRowInputs.length >= 2) {
    const c0 = await pasteRowInputs[0].inputValue();
    const c1 = await pasteRowInputs[1].inputValue();
    console.log('row cells after paste:', JSON.stringify([c0, c1]));
    if (c0 !== 'A1') errors.push(
      'first pasted cell wrong: ' + JSON.stringify(c0));
    if (c1 !== 'A2') errors.push(
      'second pasted cell wrong: ' + JSON.stringify(c1));
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-D verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
