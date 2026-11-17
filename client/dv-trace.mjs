import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const apiCalls = [];
page.on('request', req => {
  if (/\/api\//.test(req.url())) {
    apiCalls.push({ method: req.method(), url: req.url(), status: null, body: null });
  }
});
page.on('response', async resp => {
  if (!/\/api\//.test(resp.url())) return;
  const idx = apiCalls.findLastIndex(c => c.url === resp.url() && c.status === null);
  if (idx < 0) return;
  apiCalls[idx].status = resp.status();
  if (resp.headers()['content-type']?.includes('json')) {
    try { apiCalls[idx].body = (await resp.text()).slice(0, 1200); }
    catch { /* stream closed */ }
  }
});

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 300)); });

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

// clear pre-DV traffic
apiCalls.length = 0;
pageErrors.length = 0;

await page.goto('http://localhost:5174/apps/data-visualizer', {
  waitUntil: 'networkidle',
  timeout: 20000,
}).catch(() => {});
await page.waitForTimeout(5000);

console.log(`\n=== /api/* calls DV makes at boot (${apiCalls.length}) ===`);
for (const c of apiCalls) {
  const u = c.url.replace('http://localhost:5174', '');
  console.log(`${c.status} ${c.method} ${u}`);
  if (c.status === 200 && c.body) {
    // Show first 300 chars of JSON response — useful for shape checks
    console.log(`   body: ${c.body.slice(0, 250)}`);
  }
}

console.log(`\n=== page errors (${pageErrors.length}) ===`);
pageErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));

await page.screenshot({ path: '/tmp/dv-boot.png', fullPage: false });
await browser.close();
