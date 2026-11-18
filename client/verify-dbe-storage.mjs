/**
 * DBE storage verification probe. Signs in, lets the prefetch loop
 * run, then inspects every storage surface DBE touches:
 *
 *   - navigator.storage.estimate() + persisted()
 *   - IndexedDB der-dbe-v1.api_responses (DBE.2a mirror)
 *   - Cache Storage (DBE.1 shell + DHIS2 app bundles)
 *
 * Also registers the SW manually (dev build gates it to PROD) so
 * the DBE.2a interceptor actually fires + populates the mirror.
 */

import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();

const notes = [];
page.on('console', (m) => {
  const t = m.type();
  if (t === 'error' || t === 'warn' || (t === 'info' && m.text().includes('der'))) {
    notes.push(`[${t}] ${m.text().slice(0, 200)}`);
  }
});
page.on('response', (r) => {
  const u = r.url();
  if (/\/api\/(me|periodTypes|configuration|organisationUnits)/.test(u)) {
    notes.push(`[fetch] ${r.status()} ${u.replace('http://localhost:5174', '')}`);
  }
});

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

// Dev build doesn't auto-register the SW. Register manually then
// RELOAD so the page boots with the SW already in control + the
// prefetch loop fires its fetches through the DBE.2a interceptor.
// Also wipe any prior der-dbe-v1 so the SW has a clean slate
// to populate via onupgradeneeded (eliminates races from a prior
// probe run that left an empty v1 behind).
await page.evaluate(async () => {
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('der-dbe-v1');
    req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve;
  });
});
await page.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }));
await page.waitForFunction(() => navigator.serviceWorker.controller != null,
  { timeout: 10_000 }).catch(() => {});
await page.reload({ waitUntil: 'domcontentloaded' });

console.log('--- waiting for prefetch to run + settle ---');
await page.waitForTimeout(8000);

const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return {
    controllerUrl: navigator.serviceWorker.controller?.scriptURL ?? null,
    regActive: reg?.active?.state ?? null,
    regScope: reg?.scope ?? null,
  };
});
console.log('SW state:', JSON.stringify(swState));

// Fire a direct /api call with no-store and inspect the response header
const header = await page.evaluate(async () => {
  const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
  return {
    status: r.status,
    fromDbe: r.headers.get('x-der-from-dbe'),
    fromCache: r.headers.get('x-der-from-cache'),
    swSeen: r.headers.get('x-der-sw-seen'),
  };
});
console.log('Probe /api/me headers:', header);

// List ALL indexedDB databases visible to this origin — includes
// stores list so we can see exactly what the SW created.
const allDbs = await page.evaluate(async () => {
  if (typeof indexedDB.databases !== 'function') return 'not-supported';
  const dbs = await indexedDB.databases();
  const out = [];
  for (const d of dbs) {
    const stores = await new Promise((resolve) => {
      const req = indexedDB.open(d.name);
      req.onsuccess = () => {
        const list = Array.from(req.result.objectStoreNames);
        req.result.close();
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
    out.push({ name: d.name, version: d.version, stores });
  }
  return out;
});
console.log('All IndexedDB databases:');
for (const d of allDbs) {
  console.log(`  ${d.name} v${d.version} stores=[${d.stores.join(', ')}]`);
}

const stats = await page.evaluate(async () => {
  // Storage estimate + persistence posture
  let persistent = false;
  let usage = 0;
  let quota = 0;
  if (navigator.storage) {
    if (typeof navigator.storage.persisted === 'function') {
      persistent = await navigator.storage.persisted();
    }
    if (typeof navigator.storage.estimate === 'function') {
      const e = await navigator.storage.estimate();
      usage = e.usage ?? 0;
      quota = e.quota ?? 0;
    }
  }

  // Cache Storage — per-cache entry count
  const cacheRows = [];
  if ('caches' in self) {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      cacheRows.push({ name, entries: keys.length });
    }
  }

  // IDB der-dbe-v1.api_responses count + sample. Explicitly open
  // at version 1 WITH the upgrade hook so we don't accidentally
  // create an empty DB that masks the SW's own copy.
  const idbRow = await new Promise((resolve) => {
    const req = indexedDB.open('der-dbe-v1', 1);
    req.onupgradeneeded = () => {
      // Match the SW's schema so an auto-create from this probe
      // has the right stores.
      const db = req.result;
      if (!db.objectStoreNames.contains('api_responses')) {
        db.createObjectStore('api_responses', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('api_responses')) {
        db.close(); resolve({ present: false }); return;
      }
      const tx = db.transaction('api_responses', 'readonly');
      const store = tx.objectStore('api_responses');
      const countReq = store.count();
      countReq.onsuccess = () => {
        const count = countReq.result;
        const sample = [];
        store.openCursor().onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor && sample.length < 8) {
            sample.push({ key: cursor.key, status: cursor.value.status,
                          cachedAt: new Date(cursor.value.cachedAt).toISOString() });
            cursor.continue();
            return;
          }
          resolve({ present: true, count, sample });
          db.close();
        };
      };
    };
    req.onerror = () => resolve({ present: false });
  });

  return { persistent, usage, quota, cacheRows, idbRow };
});

console.log('\n=== Storage snapshot ===');
console.log(`persistent grant: ${stats.persistent ? '✓' : '✗ (install PWA to grant)'}`);
console.log(`usage: ${(stats.usage / 1024).toFixed(1)} KB / quota: ${(stats.quota / 1_048_576).toFixed(0)} MB`);

console.log('\n=== Cache Storage ===');
for (const c of stats.cacheRows) {
  console.log(`  ${c.name}: ${c.entries} entries`);
}

console.log('\n=== IndexedDB der-dbe-v1.api_responses ===');
if (!stats.idbRow.present) {
  console.log('  NOT PRESENT (no /api/** GET has fired yet through the SW)');
} else {
  console.log(`  ${stats.idbRow.count} cached responses`);
  for (const row of stats.idbRow.sample) {
    console.log(`    [${row.status}] ${row.key}  cached ${row.cachedAt}`);
  }
}

console.log('\n=== Notes ===');
for (const n of notes.slice(0, 30)) console.log('  ' + n);

await browser.close();
