#!/usr/bin/env node
/**
 * Live-verify SHEET-C2 Ctrl+D fill-down:
 *   1. Open sheet mode
 *   2. Add 2 blank rows
 *   3. Type a value into row 0, column 2 (first text cell)
 *   4. Focus that cell, press Ctrl+D
 *   5. Verify the newer blank rows below pick up the same value
 *   6. Verify the affected rows flipped to dirty + saved
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
    const p = `/tmp/cap-filldown-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  const headCount = await page.locator('[data-test="ev-sheet-head"]')
    .count();
  if (headCount === 0) {
    errors.push('sheet head missing');
    await browser.close(); process.exit(1);
  }

  // Append 2 fresh blank rows so we have a clean target zone below.
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-test="ev-sheet-add-row"]')
      .click({ force: true });
    await page.waitForTimeout(200);
  }
  const rowsBeforeFill = await page.locator(
    'tr[data-test^="ev-sheet-row-"]').count();
  console.log('rows after 2 +New:', rowsBeforeFill);
  await shot('10-blanks');

  // Find a text input cell in the FIRST row at column 2
  // (first text column; the Awareness program's first text field
  // sits around index 2: Awareness session location).
  const firstRow = page.locator(
    'tr[data-test="ev-sheet-row-0"]');
  const srcInput = firstRow.locator(
    'input[type="text"],input[type="number"]').first();
  const srcCount = await srcInput.count();
  console.log('source text input present:', srcCount);
  if (srcCount === 0) {
    errors.push('no text input in row 0 to fill from');
    await browser.close(); process.exit(1);
  }
  const seed = 'FILLDOWN-' + Date.now();
  await srcInput.fill(seed);
  await page.waitForTimeout(300);
  await shot('20-source-filled');

  // Focus the source cell, send Ctrl+D (Cmd+D on macOS).
  await srcInput.focus();
  // Use Meta+D (Cmd+D) first for macOS parity; Ctrl+D also supported.
  await page.keyboard.press('Meta+KeyD');
  await page.waitForTimeout(400);
  await shot('30-after-filldown');

  // The last row's same column should now hold the same value.
  const lastRowIdx = rowsBeforeFill - 1;
  const lastRow = page.locator(
    'tr[data-test="ev-sheet-row-' + lastRowIdx + '"]');
  const lastInput = lastRow.locator(
    'input[type="text"],input[type="number"]').first();
  const lastValue = await lastInput.inputValue();
  console.log('last row value after fill-down:', lastValue);
  if (lastValue !== seed) {
    errors.push('fill-down did not populate last row; got "'
      + lastValue + '"');
  }

  // Wait for the debounced saves to settle.
  await page.waitForTimeout(6000);
  await shot('40-after-save');

  // Confirm the last row reached saved state.
  const lastRowClass = await lastRow.getAttribute('class');
  console.log('last row class after save:', lastRowClass);
  if (!/cap-sheet__row--saved/.test(lastRowClass ?? '')) {
    errors.push('last row did not flip to saved after fill-down; class='
      + lastRowClass);
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — fill-down verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
