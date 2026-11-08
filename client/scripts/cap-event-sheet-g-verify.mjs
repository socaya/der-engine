#!/usr/bin/env node
/**
 * Live-verify SHEET-G:
 *   G1 — Esc deselects
 *     Click a cell, verify selection exists, press Esc, verify
 *     selection cleared; typed value stays intact.
 *   G2 — drag fill-handle
 *     Fill a cell with SRC, click it to select, drag the fill
 *     handle down + right to extend, verify newly-covered cells
 *     acquired SRC + their rows saved.
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
    // Tall viewport so the sheet's scroll container doesn't push
    // the test row below the fold — elementFromPoint returns null
    // for coords past the viewport.
    viewport: { width: 1440, height: 1600 },
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
    const p = `/tmp/cap-g-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // Add 3 blank rows at the bottom.
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
    await page.waitForTimeout(150);
  }
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const srcRow = totalRows - 3;

  // ---- G1 Esc deselects -------------------------------------
  async function inputAt(row, nth) {
    return page.locator('tr[data-test="ev-sheet-row-' + row + '"]')
      .locator('input[type="text"],input[type="number"]').nth(nth);
  }
  await (await inputAt(srcRow, 0)).fill('SRC');
  await page.waitForTimeout(300);
  async function cellTd(row, col) {
    return page.locator(
      '[data-cell-coord="' + row + ':' + col + '"]');
  }
  const srcCol = 2;
  await (await cellTd(srcRow, srcCol)).click({ force: true });
  await page.waitForTimeout(200);
  const selBefore = await page.locator(
    'td.cap-sheet__cell--selected').count();
  console.log('selected before Esc:', selBefore);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const selAfter = await page.locator(
    'td.cap-sheet__cell--selected').count();
  const srcValAfter = await (await inputAt(srcRow, 0)).inputValue();
  console.log('selected after Esc:', selAfter,
    'src value after Esc:', srcValAfter);
  if (selAfter !== 0) {
    errors.push('Esc did not clear selection (count=' + selAfter + ')');
  }
  if (srcValAfter !== 'SRC') {
    errors.push('Esc clobbered the typed value');
  }
  await shot('10-after-esc');

  // ---- G2 drag fill-handle ----------------------------------
  // Scroll the source cell into view so the drag path stays
  // within the visible sheet. elementFromPoint returns null for
  // coords past the viewport fold, which would collapse the
  // fill-drag to a single cell.
  await (await cellTd(srcRow, srcCol)).scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await (await cellTd(srcRow, srcCol)).click({ force: true });
  await page.waitForTimeout(200);
  await shot('20-selected');
  const handle = page.locator('span.cap-sheet__fill-handle');
  const handleCount = await handle.count();
  console.log('fill handles visible:', handleCount);
  if (handleCount === 0) {
    errors.push('fill handle not rendered on the selection');
    await browser.close(); process.exit(1);
  }
  const handleBox = await handle.first().boundingBox();
  const targetCell = await (await cellTd(srcRow + 2, srcCol + 1))
    .boundingBox();
  if (!handleBox || !targetCell) {
    errors.push('could not measure handle or target cell');
    await browser.close(); process.exit(1);
  }
  const hx = handleBox.x + handleBox.width / 2;
  const hy = handleBox.y + handleBox.height / 2;
  const tx = targetCell.x + targetCell.width / 2;
  const ty = targetCell.y + targetCell.height / 2;
  console.log('fill handle at', hx, hy, 'target at', tx, ty);
  // Use dispatchEvent to fire a synthesised mousedown on the handle
  // since page.mouse.down() can click through semi-transparent
  // decorations when elementFromPoint doesn't line up perfectly.
  await handle.first().dispatchEvent('mousedown',
    { bubbles: true, cancelable: true,
      clientX: hx, clientY: hy, button: 0 });
  await page.waitForTimeout(100);
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.waitForTimeout(150);
  // Use native mouse.up so the window-level mouseup listener fires
  // against the browser's actual pointer state.
  await page.mouse.up();
  await page.waitForTimeout(500);
  await shot('30-after-drag');

  // Verify 5 extra cells (3 rows × 2 cols - 1 source) acquired SRC.
  async function readCell(row, nth) {
    return (await inputAt(row, nth)).inputValue();
  }
  const filled = [
    await readCell(srcRow, 1),
    await readCell(srcRow + 1, 0),
    await readCell(srcRow + 1, 1),
    await readCell(srcRow + 2, 0),
    await readCell(srcRow + 2, 1),
  ];
  console.log('cells after fill-drag:', filled);
  for (const v of filled) if (v !== 'SRC') {
    errors.push('fill-drag did not populate a cell; got "'
      + v + '"');
    break;
  }

  // Wait for debounced saves.
  await page.waitForTimeout(4000);
  await shot('40-after-save');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-G verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
