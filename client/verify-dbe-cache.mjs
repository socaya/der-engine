/**
 * DBE.1 verification probe. Three-step smoke test that mirrors what
 * a clinic tablet experiences:
 *
 *   1. Load a DHIS2 app route (/dhis-web-dashboard/) over the network
 *      so the service worker caches the bundle.
 *   2. Verify the SW cache contains the expected entries + report
 *      total cache size.
 *   3. Simulate DER server down (abort every /dhis-web-** fetch) and
 *      re-navigate — the cached bundle must still serve, AND the
 *      X-DER-From-Cache: 1 header must be present.
 *
 * Not a unit test; needs the dev server + at least one approved
 * device session. Run: node verify-dbe-cache.mjs
 */

import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();

const notes = [];
page.on('console', (m) => {
  if (m.type() === 'error') notes.push(`console.error: ${m.text().slice(0, 200)}`);
});

// Sign in
await page.goto('http://localhost:5174/');
await page.waitForTimeout(500);
if (await page.locator('input[name="username"]').count()) {
  await page.fill('input[name="username"]', process.env.DER_BOOTSTRAP_ADMIN_USERNAME);
  await page.fill('input[name="password"]', process.env.DER_BOOTSTRAP_ADMIN_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
}
await page.waitForTimeout(2000);

// DBE.1 is production-only on the SW register in main.tsx.
// For this probe, register manually from the devtools console.
await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }));
await page.waitForFunction(() => navigator.serviceWorker.controller != null,
  { timeout: 10_000 }).catch(() => {});

// Step 1 — open Dashboard so the SW sees the bundle fetches.
console.log('Step 1: open Dashboard, let SW cache the bundle');
await page.goto('http://localhost:5174/apps/dashboard', {
  waitUntil: 'networkidle',
  timeout: 20_000,
}).catch(() => {});
await page.waitForTimeout(3500);

// Step 2 — inspect the cache
const cacheInfo = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = [];
  for (const name of names) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    out.push({
      name,
      count: keys.length,
      sample: keys.slice(0, 5).map((r) => new URL(r.url).pathname),
    });
  }
  return out;
});
console.log('Step 2: SW cache contents:');
for (const c of cacheInfo) {
  console.log(`  ${c.name} (${c.count} entries)`);
  for (const s of c.sample) console.log(`    ${s}`);
}

// Step 3 — simulate offline for /dhis-web-** + reload
console.log('\nStep 3: abort /dhis-web-**, reload — expect X-DER-From-Cache');
await page.route('**/dhis-web-**', (route) => route.abort());
const resps = [];
page.on('response', (r) => {
  if (r.url().includes('/dhis-web-')) {
    resps.push({
      url: r.url().replace('http://localhost:5174', ''),
      status: r.status(),
      fromCache: r.headers()['x-der-from-cache'] ?? '',
    });
  }
});
await page.goto('http://localhost:5174/apps/dashboard', {
  waitUntil: 'domcontentloaded',
  timeout: 10_000,
}).catch(() => {});
await page.waitForTimeout(3000);

console.log('/dhis-web-* responses after route.abort():');
for (const r of resps.slice(0, 20)) {
  const marker = r.fromCache === '1' ? '[CACHED]' : '[NET]';
  console.log(`  ${marker} ${r.status} ${r.url}`);
}

if (notes.length) {
  console.log('\nconsole errors:');
  notes.forEach((n) => console.log('  ' + n));
}

await browser.close();
