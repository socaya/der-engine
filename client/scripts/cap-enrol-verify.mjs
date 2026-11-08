#!/usr/bin/env node
/**
 * Live-verify the tracker enrollment create flow:
 *   1. Register a TEI via the register form (end-to-end save).
 *   2. Land on the detail page (NAV-006 navigate-on-save).
 *   3. Click "Enrol in this program" → full-page enrol form.
 *   4. Submit the enrol form → land back on the detail page with
 *      the new enrolment visible.
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
    if (m.type() === 'error') {
      const t = m.text();
      // Noise from favicon/vendor can be ignored
      if (!/favicon|DevTools/.test(t)) {
        console.log('[console.error]', t);
        errors.push(t);
      }
    }
  });

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  const signIn = await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });
  console.log('sign-in HTTP:', signIn.status());

  const programUid = process.env.DER_PROGRAM_UID ?? 'ZpnlInpnyt5';
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const select = page.locator('[data-test="cap-program-select"]');
  await select.selectOption({ value: programUid });
  await page.waitForTimeout(2000);

  async function shot(name) {
    const p = `/tmp/cap-enrol-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    const hash = await page.evaluate(() => window.location.hash);
    console.log(` → ${name}  hash=${hash}`);
  }
  await shot('00-tracker-list');

  // Click "Register new"
  await page.locator('[data-test="tr-register-open"]').click();
  await page.waitForTimeout(600);
  await shot('10-register');

  // Fill required attributes. Pick the first required input per the
  // red asterisk marker.
  const reqLabels = await page.locator(
    '.cap-input__req').locator('xpath=ancestor::label').all();
  console.log('required attrs:', reqLabels.length);
  const seed = 'DER-E2E-' + Date.now();
  let filled = 0;
  for (const lab of reqLabels) {
    const input = lab.locator('input,select,textarea').first();
    const tag = await input.evaluate((el) => el.tagName);
    if (tag === 'SELECT') {
      const opts = await input.locator('option').all();
      if (opts.length > 1) {
        const v = await opts[1].getAttribute('value');
        if (v) await input.selectOption({ value: v });
      }
    } else {
      await input.fill(seed + '-' + filled);
    }
    filled++;
  }
  console.log('filled required fields:', filled);
  await page.waitForTimeout(300);
  await shot('20-register-filled');

  // Submit
  const submit = page.locator('[data-test="tr-reg-submit"]');
  await submit.click();
  await page.waitForTimeout(2000);
  await shot('30-after-register');

  // Should now be on the detail page. Grab TEI from hash.
  const hash = await page.evaluate(() => window.location.hash);
  const m = /\/tracker\/[^/]+\/records\/([^/]+)/.exec(hash);
  if (!m) {
    errors.push('after register, not on tracker-detail hash: ' + hash);
    console.log('FAIL — hash was', hash);
    await browser.close();
    process.exit(1);
  }
  const teiId = m[1];
  console.log('new TEI:', teiId);

  // Click the Enrol CTA
  const enrolBtn = page.locator('[data-test="tr-enrol-cta"]');
  const enrolAgainBtn = page.locator('[data-test="tr-enrol-add"]');
  if (await enrolBtn.count() > 0) {
    await enrolBtn.click();
  } else if (await enrolAgainBtn.count() > 0) {
    await enrolAgainBtn.click();
  } else {
    errors.push('no enrol button visible on detail page');
    await shot('40-detail-no-enrol-btn');
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(1000);
  await shot('40-enrol-form');

  // Verify we're on the enrol route
  const enrolHash = await page.evaluate(() => window.location.hash);
  if (!/\/records\/[^/]+\/enrol$/.test(enrolHash)) {
    errors.push('enrol button did not navigate to enrol route: '
      + enrolHash);
  }
  // Submit the enrol form (default enrolment date = today).
  await page.locator('[data-test="tr-enrol-submit"]').click();
  await page.waitForTimeout(2000);
  await shot('50-after-enrol');

  // Should be back on detail; a new enrolment row must be visible.
  const enrolRows = await page.locator(
    '[data-test="tr-enrolment-list"] li').count();
  console.log('enrolments after:', enrolRows);
  if (enrolRows < 1) {
    errors.push('after enrol, no enrolment rows on detail page');
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — enrolment flow verified (tei ' + teiId + ').');
}
run().catch((e) => { console.error(e); process.exit(1); });
