#!/usr/bin/env node
/**
 * Live-verify SHEET-I:
 *   I1 — compact shortcuts popover
 *     Click "? Shortcuts" button → popover appears with headings
 *     Navigation + Edit. Esc closes it.
 *   I2 — column reorder
 *     Record the first two data column labels, drag the first
 *     column's header onto the second (HTML5 drag API via
 *     dispatchEvent), verify the order swapped. Reopen the
 *     sheet and verify the new order persisted.
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
    await page.locator('[data-test="ev-view-sheet"]')
      .click({ force: true });
    await page.waitForTimeout(2500);
  }
  await openSheet();

  async function shot(name) {
    const p = `/tmp/cap-i-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}`);
  }
  await shot('00-open');

  // ---- I1 shortcuts popover ----------------------------------
  if (await page.locator('[data-test="ev-sheet-shortcuts-btn"]')
      .count() === 0) {
    errors.push('shortcuts button missing');
  } else {
    await page.locator('[data-test="ev-sheet-shortcuts-btn"]')
      .click({ force: true });
    await page.waitForTimeout(300);
    const popover = await page.locator(
      '[data-test="ev-sheet-shortcuts-popover"]').count();
    console.log('popover visible:', popover);
    if (popover === 0) {
      errors.push('shortcuts popover did not render on click');
    }
    await shot('10-shortcuts-open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const after = await page.locator(
      '[data-test="ev-sheet-shortcuts-popover"]').count();
    if (after !== 0) {
      errors.push('Esc did not close the popover');
    }
  }

  // ---- I2 column reorder -------------------------------------
  // Read the first two data column labels.
  const headers = await page.locator(
    'th[data-test^="ev-sheet-col-"]').all();
  if (headers.length < 2) {
    errors.push('not enough columns to test reorder');
    await browser.close(); process.exit(1);
  }
  const labelA = (await headers[0].innerText()).trim();
  const labelB = (await headers[1].innerText()).trim();
  const idA = (await headers[0].getAttribute('data-test'))
    .replace('ev-sheet-col-', '');
  const idB = (await headers[1].getAttribute('data-test'))
    .replace('ev-sheet-col-', '');
  console.log('before:', labelA, '|', labelB);
  console.log('idA:', idA, 'idB:', idB);

  // Programmatically simulate the HTML5 drag — Playwright's
  // native dragTo often fails against the browser's drag-and-drop
  // layer in headless mode; synthesising the drag events directly
  // bypasses that.
  await page.evaluate(({ srcSel, tgtSel, fieldId }) => {
    const src = document.querySelector(srcSel);
    const tgt = document.querySelector(tgtSel);
    if (!src || !tgt) return;
    const dt = new DataTransfer();
    dt.setData('text/x-cap-col', fieldId);
    const opts = { bubbles: true, cancelable: true,
      dataTransfer: dt };
    src.dispatchEvent(new DragEvent('dragstart', opts));
    tgt.dispatchEvent(new DragEvent('dragover', opts));
    tgt.dispatchEvent(new DragEvent('drop', opts));
    src.dispatchEvent(new DragEvent('dragend', opts));
  }, { srcSel: 'th[data-test="ev-sheet-col-' + idA + '"]',
       tgtSel: 'th[data-test="ev-sheet-col-' + idB + '"]',
       fieldId: idA });
  await page.waitForTimeout(400);

  const headersAfter = await page.locator(
    'th[data-test^="ev-sheet-col-"]').all();
  const labelAfter0 = (await headersAfter[0].innerText()).trim();
  const labelAfter1 = (await headersAfter[1].innerText()).trim();
  console.log('after:', labelAfter0, '|', labelAfter1);
  if (labelAfter0 === labelA) {
    errors.push('columns did not reorder (first still ' + labelA + ')');
  }
  await shot('20-reordered');

  // ---- Row highlight — click a DATA cell (col >= 0; the date
  //      column is col -1 and excluded from selection).
  const dataCell = page.locator('[data-cell-coord="0:0"]');
  await dataCell.click({ force: true });
  await page.waitForTimeout(200);
  const activeRowCount = await page.locator(
    'tr.cap-sheet__row--active').count();
  console.log('active rows after cell click:', activeRowCount);
  if (activeRowCount === 0) {
    errors.push('clicking a cell did not light the active row');
  }
  await shot('25-row-highlight');

  // Reload and check persistence.
  await openSheet();
  await page.waitForTimeout(500);
  const headersReload = await page.locator(
    'th[data-test^="ev-sheet-col-"]').all();
  const labelReload0 = (await headersReload[0].innerText()).trim();
  console.log('after reload:', labelReload0);
  if (labelReload0 === labelA) {
    errors.push('reorder did not persist; first column is still '
      + labelA);
  }
  await shot('30-reload');

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — SHEET-I verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
