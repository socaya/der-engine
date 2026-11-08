#!/usr/bin/env node
/**
 * Live-verify SHEET-K:
 *   K1 — click rownum selects whole row
 *     Click row 0's gutter cell, verify tr.cap-sheet__row--active
 *     count = 1 and selection spans every data column.
 *     Shift+click row 2's gutter, verify 3 rows now active.
 *   K2 — multi-column sort chain
 *     Non-Shift click on col A's sort → chain length 1, badge ↑
 *     Shift+click on col B's sort → chain length 2, badges ↑1, ↑2
 *     Click A again (no Shift) → chain resets to just A as desc
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
    const p = `/tmp/cap-k-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // ---- K1 — click rownum ------------------------------------
  const num0 = page.locator(
    'td[data-test="ev-sheet-row-0-num"]');
  await num0.click({ force: true });
  await page.waitForTimeout(200);
  const activeAfterClick = await page.locator(
    'tr.cap-sheet__row--active').count();
  console.log('active rows after rownum click:', activeAfterClick);
  if (activeAfterClick !== 1) {
    errors.push('rownum click did not select exactly 1 row; got '
      + activeAfterClick);
  }
  const selectedAfterClick = await page.locator(
    'td.cap-sheet__cell--selected').count();
  console.log('selected cells after rownum click:', selectedAfterClick);
  if (selectedAfterClick < 10) {
    errors.push('rownum click did not select the full row (<10 '
      + 'cells selected)');
  }
  await shot('10-rownum-click');

  // Shift+click row 2's gutter → rows 0..2 active.
  const num2 = page.locator(
    'td[data-test="ev-sheet-row-2-num"]');
  await num2.click({ modifiers: ['Shift'], force: true });
  await page.waitForTimeout(200);
  const activeAfterShift = await page.locator(
    'tr.cap-sheet__row--active').count();
  console.log('active rows after Shift+click:', activeAfterShift);
  if (activeAfterShift !== 3) {
    errors.push('Shift+rownum did not select 3 rows; got '
      + activeAfterShift);
  }
  await shot('20-rownum-shift');

  // ---- K2 — multi-column sort chain -------------------------
  // Click first sort button (no shift) → chain length 1, glyph ↑
  const sortButtons = page.locator(
    'button[data-test^="ev-sheet-col-sort-"]');
  const btnA = sortButtons.first();
  const btnB = sortButtons.nth(1);
  const idA = (await btnA.getAttribute('data-test')).replace(
    'ev-sheet-col-sort-', '');
  const idB = (await btnB.getAttribute('data-test')).replace(
    'ev-sheet-col-sort-', '');
  console.log('col A:', idA, 'col B:', idB);

  await btnA.click({ force: true });
  await page.waitForTimeout(300);
  const glyphA1 = (await btnA.innerText()).trim();
  console.log('col A glyph after single click:', glyphA1);
  if (glyphA1 !== '↑') {
    errors.push('col A glyph expected "↑", got "' + glyphA1 + '"');
  }
  await shot('30-sort-a');

  // Shift+click B → chain [A asc, B asc] → labels ↑1, ↑2
  await btnB.click({ modifiers: ['Shift'], force: true });
  await page.waitForTimeout(300);
  const glyphA2 = (await btnA.innerText()).trim();
  const glyphB2 = (await btnB.innerText()).trim();
  console.log('after shift+click B:', { A: glyphA2, B: glyphB2 });
  if (glyphA2 !== '↑1') {
    errors.push('col A glyph expected "↑1", got "' + glyphA2 + '"');
  }
  if (glyphB2 !== '↑2') {
    errors.push('col B glyph expected "↑2", got "' + glyphB2 + '"');
  }
  await shot('40-multi-sort');

  // Click A (no shift) — chain resets to [A desc] because A was asc.
  await btnA.click({ force: true });
  await page.waitForTimeout(300);
  const glyphA3 = (await btnA.innerText()).trim();
  const glyphB3 = (await btnB.innerText()).trim();
  console.log('after non-shift click A:', { A: glyphA3, B: glyphB3 });
  if (glyphA3 !== '↓') {
    errors.push('non-shift click reset expected col A to "↓", got "'
      + glyphA3 + '"');
  }
  if (glyphB3 !== '↕') {
    errors.push('non-shift click did not clear col B; got "'
      + glyphB3 + '"');
  }
  await shot('50-reset');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-K verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
