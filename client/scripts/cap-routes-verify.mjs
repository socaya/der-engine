#!/usr/bin/env node
/**
 * Live-verify the v3 NAV-001..008 route split: after picking a
 * program, the list page shows only a list. Clicking "Register
 * new" or a row navigates away. Only one page kind is on screen
 * at a time — no inline forms in a list route and no list in
 * the sibling of a form route.
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
      console.log('[console.error]', m.text());
      errors.push(m.text());
    }
  });

  const pass = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD
    ?? 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER';
  const signIn = await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin', password: pass },
      headers: { 'Content-Type': 'application/json' } });
  console.log('sign-in HTTP:', signIn.status());

  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-routes-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    const hash = await page.evaluate(() => window.location.hash);
    console.log(` → ${name}  hash=${hash}`);
  }

  await shot('00-landing');

  // Choose program via DER_PROGRAM_UID env var, else first
  // option. Caller passes an event-program UID to exercise the
  // event split, a tracker UID for the tracker split.
  const select = page.locator('[data-test="cap-program-select"]');
  const options = await select.locator('option').all();
  console.log('program options:', options.length);
  const wantUid = process.env.DER_PROGRAM_UID ?? null;
  if (wantUid) {
    await select.selectOption({ value: wantUid });
  } else {
    let chosen = null;
    for (let i = 1; i < options.length; i++) {
      const v = await options[i].getAttribute('value');
      if (v) { chosen = i; break; }
    }
    if (chosen == null) {
      console.log('no program available — abort');
      process.exit(2);
    }
    await select.selectOption({ index: chosen });
  }
  await page.waitForTimeout(2500);
  await shot('10-program-picked');

  // Detect mode
  const modeChip = await page.locator('[data-test="cap-mode-chip"]')
    .innerText().catch(() => '');
  console.log('mode:', modeChip);

  if (modeChip.includes('Tracker')) {
    // Should land on tracker list
    const listHead = await page.locator('[data-test="tr-list-head"]')
      .count();
    const regForm = await page.locator('[data-test="tr-reg-form"]')
      .count();
    console.log(`tracker list present: ${listHead}  reg form inline: ${regForm}`);
    if (listHead === 0) errors.push('tracker list route missing');
    if (regForm !== 0) errors.push('NAV violation: reg form inline on list');

    await shot('20-tracker-list');

    // Click "Register new" — should navigate to #/tracker/.../register
    await page.locator('[data-test="tr-register-open"]').click();
    await page.waitForTimeout(600);
    await shot('30-tracker-register');
    const regHead = await page.locator('[data-test="tr-register-head"]')
      .count();
    const listInReg = await page.locator('[data-test="tr-list-head"]')
      .count();
    if (regHead === 0) errors.push('tracker register page not shown');
    if (listInReg !== 0) errors.push('NAV violation: list still present on register page');

    // Back to list
    await page.locator('[data-test="tr-register-back"]').click();
    await page.waitForTimeout(500);
    await shot('40-tracker-list-back');

    // Click a row if any
    const firstRow = page.locator('[data-test^="tr-tei-row-"]').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      await shot('50-tracker-detail');
      const detailHead = await page.locator('[data-test="tr-dash-head"]')
        .count();
      const listOnDetail = await page.locator('[data-test="tr-list-head"]')
        .count();
      const regOnDetail = await page.locator('[data-test="tr-register-head"]')
        .count();
      if (detailHead === 0) errors.push('detail header missing on detail route');
      if (listOnDetail !== 0) errors.push('NAV violation: list on detail route');
      if (regOnDetail !== 0) errors.push('NAV violation: reg on detail route');
    } else {
      console.log('no TEI rows to click — skipping detail/edit checks');
    }
  } else if (modeChip.includes('Event')) {
    const listHead = await page.locator('[data-test="ev-list-head"]')
      .count();
    const inlineForm = await page.locator('[data-test="ce-form"]').count();
    console.log(`event list present: ${listHead}  inline form on list: ${inlineForm}`);
    if (listHead === 0) errors.push('event list route missing');
    if (inlineForm !== 0) errors.push('NAV violation: form inline on list');

    await shot('20-event-list');

    // New event → form route
    await page.locator('[data-test="ev-new"]').click();
    await page.waitForTimeout(800);
    await shot('30-event-form-new');
    const formHead = await page.locator('[data-test="ev-form-back"]')
      .count();
    const listOnForm = await page.locator('[data-test="ev-list-head"]')
      .count();
    if (formHead === 0) errors.push('event form back button missing on form route');
    if (listOnForm !== 0) errors.push('NAV violation: list still visible on form route');

    // Back to list, click first row for detail
    await page.locator('[data-test="ev-form-back"]').click();
    await page.waitForTimeout(500);
    const firstRow = page.locator('[data-test^="ev-row-"]').first();
    if (await firstRow.count() > 0) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      await shot('40-event-detail');
      const detailHead = await page.locator('[data-test="ev-detail-head"]')
        .count();
      const listOnDetail = await page.locator('[data-test="ev-list-head"]')
        .count();
      const formOnDetail = await page.locator('[data-test="ce-form"]').count();
      if (detailHead === 0) errors.push('detail head missing on detail route');
      if (listOnDetail !== 0) errors.push('NAV violation: list on detail route');
      if (formOnDetail !== 0) errors.push('NAV violation: form on detail route');
    } else {
      console.log('no event rows to click — skipping detail check');
    }
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — route split verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
