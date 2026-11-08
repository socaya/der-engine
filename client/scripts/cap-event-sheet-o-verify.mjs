#!/usr/bin/env node
/**
 * Live-verify SHEET-O:
 *   O1 — right-click rownum menu opens with Freeze/Delete items.
 *   O2 — Freeze through row 1 → rownum TD stays visible after
 *        scrolling the wrap vertically.
 *   O3 — right-click column header, click "Move column right",
 *        verify order changed.
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
      'cap:sheet-frozen-rows:' + uid,
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
    const p = `/tmp/cap-o-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // ---- O1 + O2 — row menu + freeze ----------------------------
  const row0Num = page.locator(
    'td[data-test="ev-sheet-row-0-num"]');
  await row0Num.click({ button: 'right' });
  await page.waitForTimeout(300);
  const rowMenu = await page.locator(
    '[data-test="ev-sheet-row-menu"]').count();
  if (rowMenu === 0) {
    errors.push('row-number right-click menu did not open');
    await browser.close(); process.exit(1);
  }
  await shot('10-row-menu');

  // Measure the row's y before freeze.
  const row0YBefore = (await row0Num.boundingBox())?.y;
  console.log('row 0 y before freeze:', row0YBefore);

  // Click Freeze through this row → row 0 becomes frozen.
  await page.locator('[data-test="ev-sheet-row-menu-freeze"]')
    .click({ force: true });
  await page.waitForTimeout(400);
  await shot('20-after-freeze');

  // Scroll wrap down 400px — frozen row's y should stay near its
  // original (headerHeight) position.
  await page.locator('.cap-sheet-wrap').evaluate((el) => {
    el.scrollTop = 400;
  });
  await page.waitForTimeout(400);
  const row0YAfter = (await row0Num.boundingBox())?.y;
  console.log('row 0 y after scroll:', row0YAfter);
  if (!row0YBefore || !row0YAfter
      || Math.abs(row0YBefore - row0YAfter) > 20) {
    errors.push('frozen row moved out of view on scroll ('
      + row0YBefore + ' → ' + row0YAfter + ')');
  }
  await shot('30-scrolled');

  // ---- O3 — Move column right --------------------------------
  // Reset scroll so columns are reachable.
  await page.locator('.cap-sheet-wrap').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(200);

  // Read the first two data column labels, right-click the first,
  // click Move column right, assert the order swapped.
  const headers = await page.locator(
    'th[data-test^="ev-sheet-col-"]').all();
  const labelA = (await headers[0].innerText()).trim();
  const labelB = (await headers[1].innerText()).trim();
  console.log('before:', labelA, '|', labelB);

  await headers[0].click({ button: 'right' });
  await page.waitForTimeout(300);
  const moveRight = await page.locator(
    '[data-test="ev-sheet-col-menu-move-right"]').count();
  if (moveRight === 0) {
    errors.push('Move column right item missing');
  } else {
    await page.locator('[data-test="ev-sheet-col-menu-move-right"]')
      .click({ force: true });
    await page.waitForTimeout(400);
    const headersAfter = await page.locator(
      'th[data-test^="ev-sheet-col-"]').all();
    const after0 = (await headersAfter[0].innerText()).trim();
    const after1 = (await headersAfter[1].innerText()).trim();
    console.log('after:', after0, '|', after1);
    if (after0 === labelA) {
      errors.push('Move column right did not swap; first still '
        + labelA);
    }
  }
  await shot('40-moved');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-O verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
