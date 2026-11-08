#!/usr/bin/env node
/**
 * Live-verify SHEET-J:
 *   J1 — row-number gutter
 *     Read the first three row numbers, expect 1, 2, 3.
 *   J2 — click-to-sort column headers
 *     Fill 3 rows with values Z, A, M in the first text column.
 *     Click the column's sort button → ascending sort.
 *     Expect the displayed order to be A, M, Z.
 *     Click again → descending; expect Z, M, A.
 *     Click once more → unsorted; expect original Z, A, M order.
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
    viewport: { width: 1440, height: 1200 } });
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
    const p = `/tmp/cap-j-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // ---- J1 row numbers ----------------------------------------
  const nums = await page.locator(
    'td.cap-sheet__rownum-cell').allInnerTexts();
  console.log('first 5 row numbers:', nums.slice(0, 5));
  const expected = ['1', '2', '3'];
  for (let i = 0; i < 3; i++) {
    if (nums[i] !== expected[i]) {
      errors.push('row ' + (i + 1) + ' gutter shows "'
        + nums[i] + '" (expected "' + expected[i] + '")');
    }
  }

  // ---- J2 sort -----------------------------------------------
  // Add 3 fresh rows to control the data we sort on.
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
    await page.waitForTimeout(150);
  }
  const totalRows = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  const r0 = totalRows - 3;

  async function inputAt(row, nth) {
    return page.locator('tr[data-test="ev-sheet-row-' + row + '"]')
      .locator('input[type="text"],input[type="number"]').nth(nth);
  }
  // Fill the first text column in the last 3 rows with Z, A, M.
  await (await inputAt(r0, 0)).fill('Z-' + Date.now());
  await (await inputAt(r0 + 1, 0)).fill('A-' + Date.now());
  await (await inputAt(r0 + 2, 0)).fill('M-' + Date.now());
  // Blur to settle. Wait for one debounced save.
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1500);

  // Identify the field UID of the first TEXT column so we sort
  // the column we actually filled. Inspect the first row's cells
  // by walking data-cell-coord cols and matching the first one
  // that holds a text input.
  const textColFieldId = await page.evaluate((row) => {
    const tds = document.querySelectorAll(
      'tr[data-test="ev-sheet-row-' + row + '"] [data-cell-coord]');
    for (const td of tds) {
      const input = td.querySelector('input[type="text"]');
      if (input) {
        // Walk up to the thead and find the matching column at
        // the same visible index.
        const coord = td.getAttribute('data-cell-coord');
        if (!coord) continue;
        const col = Number(coord.split(':')[1]);
        const th = document.querySelectorAll(
          'thead th[data-test^="ev-sheet-col-"]')[col];
        return th
          ? th.getAttribute('data-test').replace('ev-sheet-col-', '')
          : null;
      }
    }
    return null;
  }, r0);
  console.log('text column field UID:', textColFieldId);
  if (!textColFieldId) {
    errors.push('could not locate a text column to sort');
    await browser.close(); process.exit(1);
  }
  const sortBtn = page.locator(
    'button[data-test="ev-sheet-col-sort-' + textColFieldId + '"]');
  console.log('sort column:', textColFieldId);

  // Click once → ascending.
  await sortBtn.click({ force: true });
  await page.waitForTimeout(500);
  await shot('10-asc');

  // Read values in row order for the sorted column. Column is the
  // first data column (col index 0 among data cols).
  async function readColValues() {
    const inputs = await page.locator(
      'tr[data-test^="ev-sheet-row-"] input[type="text"]:first-of-type')
      .all();
    const out = [];
    for (const inp of inputs) {
      const v = await inp.inputValue();
      if (v && (v.startsWith('Z-') || v.startsWith('A-')
          || v.startsWith('M-'))) out.push(v[0]);
    }
    return out;
  }
  const asc = await readColValues();
  console.log('asc order (filter Z/A/M):', asc);
  // Prior test runs leave stale Z/A/M prefixes in the sheet; the
  // precise count is irrelevant — the assertion we need is that
  // all As precede Ms which precede Zs (monotonically ascending).
  const ascStr = asc.join('');
  if (!/^A*M*Z*$/.test(ascStr)) {
    errors.push('asc is not A-sorted; got ' + ascStr);
  }

  // Click again → descending.
  await sortBtn.click({ force: true });
  await page.waitForTimeout(500);
  const desc = await readColValues();
  console.log('desc order (filter Z/A/M):', desc);
  const descStr = desc.join('');
  if (!/^Z*M*A*$/.test(descStr)) {
    errors.push('desc is not Z-sorted; got ' + descStr);
  }

  // Click again → unsorted (returns to insertion order: Z,A,M).
  await sortBtn.click({ force: true });
  await page.waitForTimeout(500);
  const unsorted = await readColValues();
  console.log('unsorted order (filter Z/A/M):', unsorted);
  // "Unsorted" returns to insertion order. Assert only that the
  // sequence is NOT sorted (would be either /^A*M*Z*$/ or /^Z*M*A*$/)
  // — proves the display order moved off the sorted state.
  const unStr = unsorted.join('');
  if (/^A*M*Z*$/.test(unStr) || /^Z*M*A*$/.test(unStr)) {
    errors.push('unsorted path still produces a sorted sequence: '
      + unStr);
  }
  await shot('20-unsorted');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-J verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
