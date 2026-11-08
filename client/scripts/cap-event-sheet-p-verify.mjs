#!/usr/bin/env node
/**
 * Live-verify SHEET-P section grouping:
 *   1. Section header row (ev-sheet-section-row) renders
 *      above the column header row.
 *   2. Click a section's collapse toggle → columns in that
 *      section vanish; collapsed-sections strip appears
 *      above the sheet with an expand chip.
 *   3. Click the expand chip → columns return; strip disappears.
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
      'cap:sheet-collapsed:' + uid,
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
    const p = `/tmp/cap-p-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  const totalCols = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('total data columns:', totalCols);

  // Does the section row exist at all?
  const sectionRowCount = await page.locator(
    '[data-test="ev-sheet-section-row"]').count();
  console.log('section row rendered:', sectionRowCount);
  if (sectionRowCount === 0) {
    errors.push('section header row did not render');
  }

  // Find any section toggle button (first non-null section).
  const toggles = await page.locator(
    'button[data-test^="ev-sheet-section-toggle-"]').all();
  console.log('section toggles found:', toggles.length);
  if (toggles.length === 0) {
    errors.push('no section toggles present');
    await browser.close();
    if (errors.length) process.exit(1);
    process.exit(0);
  }
  // Prefer a toggle that spans multiple columns so the test
  // observes a visible column-count drop.
  let picked = null;
  let pickedKey = null;
  let pickedLabel = null;
  for (const t of toggles) {
    const dt = await t.getAttribute('data-test');
    const key = dt?.replace('ev-sheet-section-toggle-', '')
      ?? '';
    const th = await t.evaluateHandle(
      (el) => el.closest('th'));
    const colSpan = await th.evaluate((el) => {
      if (!el) return 0;
      return Number((el).getAttribute('colspan') ?? 0);
    });
    if (colSpan >= 2) {
      picked = t; pickedKey = key;
      pickedLabel = (await t.innerText()).trim();
      break;
    }
  }
  if (!picked) {
    console.log('no multi-column section found — using the first');
    picked = toggles[0];
    pickedKey = (await picked.getAttribute('data-test'))
      ?.replace('ev-sheet-section-toggle-', '') ?? '';
    pickedLabel = (await picked.innerText()).trim();
  }
  console.log('toggling section', pickedKey, '(' + pickedLabel + ')');

  // Click to collapse.
  await picked.click({ force: true });
  await page.waitForTimeout(400);
  const colsAfterCollapse = await page.locator(
    'th[data-test^="ev-sheet-col-"]').count();
  console.log('columns after collapse:', colsAfterCollapse);
  if (colsAfterCollapse >= totalCols) {
    errors.push('collapse did not reduce column count (before='
      + totalCols + ' after=' + colsAfterCollapse + ')');
  }
  const strip = await page.locator(
    '[data-test="ev-sheet-collapsed-strip"]').count();
  if (strip === 0) {
    errors.push('collapsed-sections strip did not appear');
  }
  await shot('10-collapsed');

  // Click the expand chip.
  const expandChip = page.locator(
    '[data-test="ev-sheet-expand-' + pickedKey + '"]');
  if (await expandChip.count() === 0) {
    errors.push('expand chip missing for ' + pickedKey);
  } else {
    await expandChip.click({ force: true });
    await page.waitForTimeout(400);
    const colsAfterExpand = await page.locator(
      'th[data-test^="ev-sheet-col-"]').count();
    console.log('columns after expand:', colsAfterExpand);
    if (colsAfterExpand !== totalCols) {
      errors.push('expand did not restore columns (expected '
        + totalCols + ' got ' + colsAfterExpand + ')');
    }
    const stripGone = await page.locator(
      '[data-test="ev-sheet-collapsed-strip"]').count();
    if (stripGone !== 0) {
      errors.push('collapsed-sections strip did not disappear');
    }
  }
  await shot('20-expanded');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-P verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
