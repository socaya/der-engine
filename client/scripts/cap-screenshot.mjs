import { chromium } from 'playwright-core';

async function run() {
  const chromePath =
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--ignore-certificate-errors', '--disable-dev-shm-usage',
      '--no-sandbox'],
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') {
      console.log('[console]', m.type(), m.text());
    }
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) {
      console.log('[http]', r.status(), r.url());
    }
  });

  // Prefer direct API sign-in via fetch so cookies are set
  // before we navigate — more robust than form-click races.
  const apiReq = await page.request.post(
    'http://localhost:5174/edge-api/v1/auth/sign-in',
    { data: { username: 'der-admin',
      password: 'OY2/uIass26KcwqwMIc+UjqlBDNDU4ER' },
      headers: { 'Content-Type': 'application/json' } });
  console.log('sign-in HTTP:', apiReq.status());

  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/tmp/cap-10-initial.png',
    fullPage: true });

  // Pick the first available program
  const select = page.locator('[data-test="cap-program-select"]');
  const options = await select.locator('option').allTextContents();
  console.log('program options:', options.slice(0, 5));
  if (options.length > 1) {
    await select.selectOption({ index: 1 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/cap-11-selected.png',
      fullPage: true });
  }

  await browser.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
