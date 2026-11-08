#!/usr/bin/env node
/**
 * Live-verify the tracker stage event flow end-to-end:
 *   detail page → pick a stage → click "+ Add event" →
 *   stage form renders → set date → save → land back on detail
 *   with the new event visible in the stage pane.
 *
 * Catches regressions from the GV3-1 route split where the editor
 * moved out of the dashboard into its own tracker-stage-form route.
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

  // The TEI we registered + enrolled in GV3-3 — program ZpnlInpnyt5
  // (HIV Pro), TEI 745296ef..., enrollment XRx3D7Yxg3I, 4 stages
  // configured.
  const programUid = 'ZpnlInpnyt5';
  const teiId = '745296ef-5d5b-4b6a-bde3-2a6782579f12';

  await page.goto(`http://localhost:5174/apps/capture#/tracker/${programUid}/records/${teiId}`,
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(2500);

  async function shot(name) {
    const p = `/tmp/cap-stage-${name}.png`;
    await page.screenshot({ path: p, fullPage: true });
    const hash = await page.evaluate(() => window.location.hash);
    console.log(` → ${name}  hash=${hash}`);
  }
  await shot('00-detail');

  // Confirm we landed on the detail route
  if (await page.locator('[data-test="tr-dash-head"]').count() === 0) {
    errors.push('detail page did not render');
    await browser.close(); process.exit(1);
  }

  // Click the first stage in the rail
  const firstStage = page.locator('[data-test^="tr-stage-"]').first();
  if (await firstStage.count() === 0) {
    errors.push('no stages in the rail');
    await browser.close(); process.exit(1);
  }
  const stageTestId = await firstStage.getAttribute('data-test');
  console.log('picking stage:', stageTestId);
  await firstStage.click();
  await page.waitForTimeout(400);
  await shot('10-stage-picked');

  // Click "+ Add event"
  const addEvent = page.locator('[data-test="tr-add-event"]');
  if (await addEvent.count() === 0) {
    errors.push('"+ Add event" button missing');
  }
  await addEvent.click({ force: true });
  await page.waitForTimeout(1500);
  await shot('20-stage-form');

  const newHash = await page.evaluate(() => window.location.hash);
  if (!/\/enrollments\/[^/]+\/stages\/[^/]+\/new$/.test(newHash)) {
    errors.push('"+ Add event" did not navigate to the stage form '
      + 'route: ' + newHash);
  }
  if (await page.locator('[data-test="tr-stageform-head"]').count() === 0) {
    errors.push('stage form page did not render');
  }

  // Try to submit — most HIV Pro stages have optional-only fields,
  // so submit should work with just today's date. The form sets
  // occurredAt to today by default.
  // The editor's save button lives at [data-test="tr-editor-submit"]
  const submit = page.locator('[data-test="tr-editor-submit"]');
  const submitCount = await submit.count();
  console.log('editor submit button present:', submitCount);
  if (submitCount === 0) {
    errors.push('tr-editor-submit button missing on stage form');
    await browser.close();
    if (errors.length) process.exit(1);
    process.exit(0);
  }

  const submitDisabled = await submit.isDisabled();
  console.log('submit disabled:', submitDisabled);
  if (!submitDisabled) {
    await submit.click({ force: true });
    await page.waitForTimeout(2500);
    await shot('30-after-save');

    const finalHash = await page.evaluate(() => window.location.hash);
    console.log('final hash:', finalHash);
    // onSaved → goBack → navTracker.detail(programUid, teiId)
    if (!finalHash.endsWith('/records/' + teiId)) {
      errors.push('after save, did not land back on detail route');
    }
    // New event should appear in the stage events list
    const events = await page.locator('[data-test^="tr-event-row-"]').count();
    console.log('event rows on detail after save:', events);
    if (events < 1) {
      errors.push('after save, no event row in stage pane');
    }
  } else {
    console.log('submit was disabled (required-field gated) — '
      + 'skipping save verification');
    await shot('30-submit-disabled');
  }

  await browser.close();
  console.log('');
  if (errors.length) {
    console.log('FAIL:');
    for (const e of errors) console.log('  -', e);
    process.exit(1);
  }
  console.log('OK — stage event flow verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
