import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = [];
const reqs = [];
page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0, 400)}`));
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warn') {
    errors.push(`${m.type()}: ${m.text().slice(0, 400)}`);
  }
});
page.on('response', r => {
  if (/\/dhis-web-mu-hiv-tracker\//.test(r.url())) {
    reqs.push({
      status: r.status(),
      url: r.url().replace('http://localhost:5174', ''),
      coop: r.headers()['cross-origin-opener-policy'] ?? '-',
      coep: r.headers()['cross-origin-embedder-policy'] ?? '-',
      ct: r.headers()['content-type']?.split(';')[0] ?? '-',
    });
  }
});

await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
if (await page.locator('input[name="username"]').count()) {
  await page.fill('input[name="username"]', process.env.DER_BOOTSTRAP_ADMIN_USERNAME);
  await page.fill('input[name="password"]', process.env.DER_BOOTSTRAP_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}
await page.waitForTimeout(1500);

// Launcher-click path — /apps/<key> should now redirect to
// /dhis-web-<key>/ for COI apps so the browser navigates top-level
// and gets the isolation headers directly.
await page.goto('http://localhost:5174/apps/mu-hiv-tracker', {
  waitUntil: 'networkidle', timeout: 20000,
}).catch(() => {});
await page.waitForTimeout(5000);

const isolated = await page.evaluate(() => window.crossOriginIsolated);
const opfsReady = await page.evaluate(() =>
  typeof navigator.storage?.getDirectory === 'function');

console.log(`crossOriginIsolated: ${isolated}`);
console.log(`navigator.storage.getDirectory: ${opfsReady}`);

console.log('\n=== /dhis-web-mu-hiv-tracker/ responses ===');
for (const r of reqs.slice(0, 20)) {
  console.log(`  [${r.status}] COOP=${r.coop} COEP=${r.coep} ${r.ct} ${r.url}`);
}

console.log('\n=== errors ===');
errors.slice(0, 10).forEach(e => console.log('  ' + e));

await page.screenshot({ path: '/tmp/mu-hiv.png', fullPage: false });
await browser.close();
