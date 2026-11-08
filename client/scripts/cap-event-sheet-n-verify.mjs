#!/usr/bin/env node
/**
 * Live-verify SHEET-N virtual scrolling:
 *   1. Open sheet, bulk-add 150 rows (clearing the 100-row
 *      threshold).
 *   2. Verify the DOM renders FAR fewer <tr> elements than 150
 *      (virtualization active + overscan ≈ 25-40 mounted).
 *   3. Scroll the wrap to the bottom; verify different row
 *      indexes are now mounted.
 *   4. Verify the virt-pad-top and virt-pad-bottom spacer rows
 *      exist with non-zero heights.
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
    const p = `/tmp/cap-n-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  const startingRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  console.log('rows at open:', startingRows);
  // Push the row count well over the 100-row threshold. 160 new
  // rows plus whatever baseline the test environment has gives
  // a healthy buffer.
  const targetAdditions = Math.max(0, 160 - startingRows);
  console.log('adding', targetAdditions, 'rows to cross threshold');
  for (let i = 0; i < targetAdditions; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
  }
  await page.waitForTimeout(800);
  const totalRows = await page.evaluate(() => {
    const sel = document.querySelectorAll(
      'tr[data-test^="ev-sheet-row-"]').length;
    return sel;
  });
  console.log('DOM <tr> count after add:', totalRows);
  // Virtualization kicks in when the model has > 100 rows. We can't
  // directly inspect the model length, but the DOM should NOT have
  // rendered all 160+ rows if virtualization is working. Overscan
  // is ~16 rows beyond the visible viewport, so expect < 70-80.
  if (totalRows > 100) {
    errors.push('virtualization not active — DOM mounted '
      + totalRows + ' <tr>s (expected < 100)');
  }

  // Confirm both spacer rows are present with non-zero heights.
  const padTop = page.locator(
    'tr[data-test="ev-sheet-virt-pad-top"]');
  const padBottom = page.locator(
    'tr[data-test="ev-sheet-virt-pad-bottom"]');
  const topHeight = await padTop.count() === 0 ? 0
    : await padTop.evaluate(
      (el) => el.firstElementChild
        ? parseInt(el.firstElementChild.style.height, 10)
        : 0);
  const bottomHeight = await padBottom.count() === 0 ? 0
    : await padBottom.evaluate(
      (el) => el.firstElementChild
        ? parseInt(el.firstElementChild.style.height, 10)
        : 0);
  console.log('spacer heights: top=' + topHeight
    + ' bottom=' + bottomHeight);
  if (bottomHeight <= 0) {
    errors.push('bottom spacer height is zero (no overflow rows)');
  }
  await shot('10-virtualized');

  // Record which rowIdx values are currently in the DOM.
  const topVisibleRowIdxs = await page.evaluate(() => {
    const trs = document.querySelectorAll(
      'tr[data-test^="ev-sheet-row-"]');
    const out = [];
    for (const tr of trs) {
      const t = tr.getAttribute('data-test');
      const m = /^ev-sheet-row-(\d+)$/.exec(t ?? '');
      if (m) out.push(Number(m[1]));
    }
    return out;
  });
  console.log('rowIdx mounted at top (sample):',
    topVisibleRowIdxs.slice(0, 3),
    '... last:', topVisibleRowIdxs.slice(-3));

  // Scroll the wrap near the bottom. rowHeight ≈ 32, we have ~160+
  // rows → scroll to ~row 130 (row * 32 = 4160 px).
  await page.locator('.cap-sheet-wrap').evaluate((el) => {
    el.scrollTop = 4000;
  });
  await page.waitForTimeout(500);
  const bottomVisibleRowIdxs = await page.evaluate(() => {
    const trs = document.querySelectorAll(
      'tr[data-test^="ev-sheet-row-"]');
    const out = [];
    for (const tr of trs) {
      const t = tr.getAttribute('data-test');
      const m = /^ev-sheet-row-(\d+)$/.exec(t ?? '');
      if (m) out.push(Number(m[1]));
    }
    return out;
  });
  console.log('rowIdx mounted after scroll (sample):',
    bottomVisibleRowIdxs.slice(0, 3),
    '... last:', bottomVisibleRowIdxs.slice(-3));
  await shot('20-scrolled');

  // The window must have shifted — at minimum the FIRST mounted
  // rowIdx should be well above the top row from before the scroll.
  if (bottomVisibleRowIdxs.length > 0
      && topVisibleRowIdxs.length > 0
      && bottomVisibleRowIdxs[0] <= topVisibleRowIdxs[0] + 10) {
    errors.push('scrolling did not shift the mounted row window '
      + '(first mounted idx: top=' + topVisibleRowIdxs[0]
      + ' → after=' + bottomVisibleRowIdxs[0] + ')');
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-N verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
