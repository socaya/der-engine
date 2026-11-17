import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const apiCalls = [];
page.on('response', async resp => {
  if (!/\/api\//.test(resp.url())) return;
  const url = resp.url().replace('http://localhost:5174', '');
  let body = null;
  if (resp.headers()['content-type']?.includes('json')) {
    try { body = (await resp.text()).slice(0, 2000); } catch {}
  }
  apiCalls.push({ phase: current, status: resp.status(), url, body });
});

const pageErrors = [];
page.on('pageerror', e => pageErrors.push({ phase: current, msg: String(e).slice(0, 400) }));
page.on('console', m => {
  if (m.type() === 'error') pageErrors.push({ phase: current, msg: m.text().slice(0, 400) });
});

let current = 'login';
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

current = 'dv-boot';
await page.goto('http://localhost:5174/apps/data-visualizer', {
  waitUntil: 'networkidle',
  timeout: 20000,
}).catch(() => {});
await page.waitForTimeout(4000);

current = 'dv-period-click';
// Click the Period dimension chip. DV docs: it's labeled "Period"
// in the left dimension panel.
await page.locator('text=Period').first().click({ timeout: 4000 }).catch(e => console.log(`click err: ${e.message}`));
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/dv-period-click.png' });

current = 'dv-relative-period-select';
// Try clicking a relative period in the picker
await page.locator('text=Last 12 months').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(2000);

current = 'dv-update-click';
// Click Update
await page.locator('button:has-text("Update")').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/dv-after-update.png' });

console.log(`\n=== all API responses (${apiCalls.length}) ===`);
for (const c of apiCalls) {
  console.log(`[${c.phase}] ${c.status} ${c.url}`);
  if (c.body && c.status === 200) {
    // Flag items that look like items without id
    try {
      const parsed = JSON.parse(c.body);
      const check = JSON.stringify(parsed).slice(0, 220);
      console.log(`     ${check}`);
    } catch { console.log(`     ${c.body.slice(0, 220)}`); }
  }
}

console.log(`\n=== page errors (${pageErrors.length}) ===`);
pageErrors.forEach(e => console.log(`[${e.phase}] ${e.msg}`));

await browser.close();
