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
  page.on('console', (m) => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: '/tmp/cap-01-login.png' });
  // Try to sign in
  const user = page.locator('input[name="username"], input[type="text"]').first();
  const pass = page.locator('input[type="password"]').first();
  if (await user.isVisible().catch(() => false)) {
    await user.fill('der-admin');
    await pass.fill('OY2/uIass26KcwqwMIc+UjqlBDNDU4ER');
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 10000 }),
      page.locator('button[type="submit"], button:has-text("Sign in")').first().click(),
    ]).catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/cap-02-home.png' });
  }
  // Navigate to the Capture app
  await page.goto('http://localhost:5174/apps/capture',
    { waitUntil: 'networkidle', timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/cap-03-capture.png', fullPage: true });
  console.log('final url:', page.url());
  console.log('title:', await page.title());
  const text = await page.textContent('body').catch(() => '');
  console.log('body preview:', (text ?? '').slice(0, 500));
  await browser.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
