#!/usr/bin/env node
/**
 * Live-verify SHEET-F:
 *   F1 — Delete clears selection range
 *     Fill 4 cells in a 2x2 block, select the block, press Delete,
 *     verify all 4 cells empty.
 *   F2 — Ctrl+A selects the entire grid
 *     Fire Cmd+A outside an input, verify selection spans all
 *     (rows × cols) cells.
 *   F3 — column resize with persistence
 *     Measure the first data column's width, drag the resize
 *     handle right by 120px, verify the column grew, reload the
 *     page (same program), verify the width persisted.
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
  async function openSheet() {
    await page.goto('http://localhost:5174/apps/capture',
      { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.locator('[data-test="cap-program-select"]')
      .selectOption({ value: programUid });
    await page.waitForTimeout(2000);
    await page.locator('[data-test="ev-view-sheet"]').click({ force: true });
    await page.waitForTimeout(2500);
  }
  await openSheet();

  async function shot(name) {
    const p = `/tmp/cap-f-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // Add 2 blank rows.
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
    await page.waitForTimeout(200);
  }
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const r0 = totalRows - 2;
  const r1 = totalRows - 1;

  // ---- F1 ---------------------------------------------------
  // Fill a 2×2 block at (r0, c0..c1), (r1, c0..c1).
  async function inputAt(row, nth) {
    return page.locator('tr[data-test="ev-sheet-row-' + row + '"]')
      .locator('input[type="text"],input[type="number"]').nth(nth);
  }
  await (await inputAt(r0, 0)).fill('X1');
  await (await inputAt(r0, 1)).fill('X2');
  await (await inputAt(r1, 0)).fill('Y1');
  await (await inputAt(r1, 1)).fill('Y2');
  await page.waitForTimeout(300);

  async function cellTd(row, col) {
    return page.locator(
      '[data-cell-coord="' + row + ':' + col + '"]');
  }
  const c0 = 2, c1 = 3;
  await (await cellTd(r0, c0)).click({ force: true });
  await page.waitForTimeout(150);
  await (await cellTd(r1, c1)).click({ modifiers: ['Shift'],
    force: true });
  await page.waitForTimeout(150);
  await shot('10-selected');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  await shot('20-after-delete');
  const vals = await Promise.all([
    (await inputAt(r0, 0)).inputValue(),
    (await inputAt(r0, 1)).inputValue(),
    (await inputAt(r1, 0)).inputValue(),
    (await inputAt(r1, 1)).inputValue(),
  ]);
  console.log('cells after Delete:', vals);
  for (const v of vals) if (v !== '') {
    errors.push('Delete did not clear a cell; got "' + v + '"');
    break;
  }

  // ---- F2 ---------------------------------------------------
  // Focus a cell's td (not input) then Cmd+A.
  await (await cellTd(r0, c0)).click({ force: true });
  await page.waitForTimeout(150);
  await page.keyboard.press('Meta+KeyA');
  await page.waitForTimeout(400);
  const selectedCount = await page.locator(
    'td.cap-sheet__cell--selected').count();
  const totalRows2 = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const totalCols = await page.locator(
    'th .cap-sheet__col-resize').count();
  console.log('select-all: selected=', selectedCount,
    'rows=', totalRows2, 'cols=', totalCols);
  if (selectedCount !== totalRows2 * totalCols) {
    errors.push('Ctrl+A did not select every cell; got '
      + selectedCount + ', expected ' + (totalRows2 * totalCols));
  }
  await shot('30-select-all');

  // ---- F3 ---------------------------------------------------
  // Grab the first data column's header + its resize handle.
  const firstHeader = page.locator('th .cap-sheet__col-resize').first();
  const parentTh = page.locator(
    'th:has(.cap-sheet__col-resize)').first();
  const before = await parentTh.boundingBox();
  console.log('col width before resize:', before?.width);
  if (!before) {
    errors.push('could not measure col width');
    await browser.close(); process.exit(1);
  }
  const handleBox = await firstHeader.boundingBox();
  if (!handleBox) {
    errors.push('could not find resize handle');
    await browser.close(); process.exit(1);
  }
  // Drag the handle 120px to the right.
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 120, startY, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await parentTh.boundingBox();
  console.log('col width after resize:', after?.width);
  if (!after || after.width < before.width + 60) {
    errors.push('column did not grow; before=' + before.width
      + ' after=' + after?.width);
  }
  await shot('40-after-resize');

  // Reload: reopen the sheet and confirm the width stuck.
  await openSheet();
  await page.waitForTimeout(500);
  const persistedTh = page.locator(
    'th:has(.cap-sheet__col-resize)').first();
  const persisted = await persistedTh.boundingBox();
  console.log('col width after reopen:', persisted?.width);
  if (!persisted || Math.abs(persisted.width - (after?.width ?? 0))
      > 20) {
    errors.push('column width did not persist across reopen; '
      + 'got ' + persisted?.width + ' expected ~' + after?.width);
  }
  await shot('50-after-reopen');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-F verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
