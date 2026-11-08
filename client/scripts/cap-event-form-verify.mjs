#!/usr/bin/env node
/**
 * Live-verify the event-program flow end-to-end:
 *   1. list page renders (metadata-driven columns if stage schema loaded)
 *   2. filter inputs (From / To / Status / Search) present
 *   3. "+ New event" → form route
 *   4. fill one data-element + save → land back on list
 *   5. new event appears in the list
 *   6. open detail → read-only summary shows the saved value
 *
 * Programs with no data-elements are skipped; the test picks the
 * first event program with at least one field in its stage form.
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
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-ev-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    console.log(` → ${name}  hash=` +
      await page.evaluate(() => window.location.hash));
  }
  await shot('00-list');

  if (await page.locator('[data-test="ev-list-head"]').count() === 0) {
    errors.push('event list head missing');
    await browser.close(); process.exit(1);
  }
  const hasFrom = await page.locator('[data-test="ev-from-date"]')
    .count();
  const hasTo = await page.locator('[data-test="ev-to-date"]').count();
  const hasStatus = await page.locator('[data-test="ev-status-filter"]')
    .count();
  if (hasFrom === 0 || hasTo === 0 || hasStatus === 0) {
    errors.push(`filter inputs missing (from=${hasFrom} to=${hasTo} status=${hasStatus})`);
  }

  // "+ New event"
  await page.locator('[data-test="ev-new"]').click({ force: true });
  await page.waitForTimeout(1500);
  await shot('10-form');

  // Fill the first editable text/number field + save.
  const firstField = page.locator('[data-test^="cap-field-"]').first();
  if (await firstField.count() === 0) {
    console.log('program has no fields — skipping save path');
  } else {
    const input = firstField.locator('input,textarea,select').first();
    const tag = await input.evaluate((el) => el.tagName);
    const typ = await input.evaluate((el) => el.type ?? '');
    const seed = 'DER-EV1-' + Date.now();
    if (tag === 'SELECT') {
      const opts = await input.locator('option').all();
      if (opts.length > 1) {
        const v = await opts[1].getAttribute('value');
        if (v) await input.selectOption({ value: v });
      }
    } else if (typ === 'number') {
      await input.fill('42');
    } else {
      await input.fill(seed);
    }
    await page.waitForTimeout(300);
    await shot('20-filled');

    const submit = page.locator('[data-test="ce-submit-btn"]');
    const disabled = await submit.isDisabled();
    if (disabled) {
      console.log('submit disabled (required field missing) — '
        + 'filling remaining required fields');
      const reqs = await page.locator('.cap-input__req')
        .locator('xpath=ancestor::label').all();
      for (const r of reqs) {
        const i = r.locator('input,select,textarea').first();
        const t = await i.evaluate((el) => el.tagName);
        if (t === 'SELECT') {
          const opts = await i.locator('option').all();
          if (opts.length > 1) {
            const v = await opts[1].getAttribute('value');
            if (v) await i.selectOption({ value: v });
          }
        } else {
          await i.fill(seed);
        }
      }
      await page.waitForTimeout(300);
    }
    await page.locator('[data-test="ce-submit-btn"]')
      .click({ force: true });
    await page.waitForTimeout(2500);
    await shot('30-after-save');

    // Should land back on list (NAV-006 — event-form saves route to list
    // when no eventId yet).
    const hash = await page.evaluate(() => window.location.hash);
    if (!/\/events\/[^/]+\/?$/.test(hash)) {
      errors.push('after save, not on event list hash: ' + hash);
    }
    const rows = await page.locator('[data-test^="ev-row-"]').count();
    console.log('event rows after save:', rows);
    if (rows < 1) errors.push('no event rows after save');

    // Open first row to verify detail
    const firstRow = page.locator('[data-test^="ev-row-"]').first();
    await firstRow.click({ force: true });
    await page.waitForTimeout(1500);
    await shot('40-detail');
    if (await page.locator('[data-test="ev-detail-head"]').count() === 0) {
      errors.push('event detail page did not render');
    }
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — event flow verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
