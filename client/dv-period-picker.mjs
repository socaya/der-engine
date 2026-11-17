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
    try { body = (await resp.text()); } catch {}
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

// clear boot traffic, we only care about period picker
apiCalls.length = 0;

current = 'click-period';
// DV runs in an iframe. Find it first.
const frames = page.frames();
console.log('frames:', frames.map(f => f.url()));
// The deep-link DHIS2 iframe is the one with the /dhis-web-… URL.
const dvFrame = frames.find(f => f.url().includes('/dhis-web-data-visualizer/'))
  ?? frames.find(f => f.url().includes('data-visualizer'));
if (!dvFrame) {
  console.log('no DV iframe found');
  await page.screenshot({ path: '/tmp/dv-no-iframe.png' });
} else {
  console.log('DV iframe found at:', dvFrame.url());
  await dvFrame.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);
  // Click the Period dimension in the sidebar
  await dvFrame.locator('text=Period').first()
    .click({ timeout: 5000 })
    .catch(e => console.log('click err:', e.message));
}
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/dv-period-dialog.png', fullPage: false });

// Now click the Period type dropdown inside the dialog
if (dvFrame) {
  await dvFrame.locator('text=Period type').first()
    .evaluate(el => el.parentElement?.click?.())
    .catch(() => {});
  // Try clicking the dropdown arrow directly
  await dvFrame.locator('[aria-label*="Period type" i], [aria-haspopup="listbox"]').first()
    .click({ timeout: 3000 })
    .catch(e => console.log('dropdown click err:', e.message));
  // Try direct arrow click
  await dvFrame.locator('button:has(svg)').nth(0).click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/dv-period-type-open.png' });

  const dropdownOptions = await dvFrame.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('[role="option"], option'));
    return opts.map(o => o.textContent?.trim()).filter(Boolean);
  });
  console.log('dropdown options:', dropdownOptions);
}

console.log(`\n=== API calls during picker open (${apiCalls.length}) ===`);
for (const c of apiCalls) {
  console.log(`${c.status} ${c.url}`);
  if (c.body) {
    console.log(`     ${c.body.slice(0, 400)}`);
  }
}

console.log(`\n=== page errors (${pageErrors.length}) ===`);
pageErrors.forEach(e => console.log(`[${e.phase}] ${e.msg}`));

await browser.close();
