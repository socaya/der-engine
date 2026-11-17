import { chromium } from 'playwright';

const APPS = [
  { key: 'data-visualizer', title: 'Data Visualizer', waitMs: 5000 },
  { key: 'maps',             title: 'Maps',            waitMs: 5000 },
  { key: 'dashboard',        title: 'Dashboard',       waitMs: 5000 },
  { key: 'eregisters',       title: 'eRegisters',      waitMs: 4000 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = await ctx.newPage();

const errors = [];
const requestFails = [];
page.on('pageerror', e => errors.push({ app: current, msg: String(e) }));
page.on('console', m => {
  if (m.type() === 'error') errors.push({ app: current, msg: m.text() });
});
page.on('response', r => {
  if (r.status() >= 400 && /\/api\//.test(r.url())) {
    requestFails.push({ app: current, status: r.status(), url: r.url() });
  }
});

let current = 'login';
await page.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(600);
if (await page.locator('input[name="username"]').count()) {
  await page.fill('input[name="username"]', process.env.DER_BOOTSTRAP_ADMIN_USERNAME);
  await page.fill('input[name="password"]', process.env.DER_BOOTSTRAP_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}
await page.waitForTimeout(1500);

for (const app of APPS) {
  current = app.key;
  console.log(`\n=== ${app.title} ===`);
  await page.goto(`http://localhost:5174/apps/${app.key}`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  }).catch(e => console.log(`  nav err: ${e.message}`));
  await page.waitForTimeout(app.waitMs);
  await page.screenshot({
    path: `/tmp/verify-${app.key}.png`,
    fullPage: false,
  });
  // Report any error envelope visible in the viewport
  const errorBanner = await page.evaluate(() => {
    const selectors = ['[role="alert"]', '.error', '.MuiAlert-standardError'];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.textContent) return el.textContent.trim().slice(0, 200);
    }
    return null;
  });
  if (errorBanner) console.log(`  banner: ${errorBanner}`);
}

console.log(`\n--- console errors ---`);
errors.slice(0, 20).forEach(e => console.log(`  [${e.app}] ${e.msg.slice(0, 180)}`));

console.log(`\n--- /api/* 4xx/5xx ---`);
requestFails.slice(0, 20).forEach(r => console.log(`  [${r.app}] ${r.status}  ${r.url}`));

await browser.close();
