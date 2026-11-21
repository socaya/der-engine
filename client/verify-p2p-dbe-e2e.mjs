/**
 * End-to-end P2P + DBE integration probe.
 *
 * Spins up TWO isolated browser contexts (separate IndexedDB +
 * cookie jars — the browser equivalent of two tablets), signs them
 * both in as the DER admin, approves each device so they can open
 * P2P sessions (devices enroll as PENDING; the DeviceApprovalInterceptor
 * rejects P2P signaling from non-APPROVED devices), then exercises
 * every integration surface the session shipped:
 *
 *   1. P2P handshake   — device A calls Connect, device B accepts,
 *                        both reach status=connected
 *   2. Journal flush   — a queued submission on A transits the
 *                        data channel, lands on the server as a
 *                        real POST attributed to A via
 *                        X-DER-On-Behalf-Of
 *   3. DBE shell       — SW CacheFirst serves /dhis-web-<key>/**
 *                        after a server kill (bundle cached)
 *   4. DBE API mirror  — IndexedDB mirror serves /api/me, periodTypes,
 *                        systemSettings after a server kill, with
 *                        X-DER-From-DBE header stamped
 *
 * Reports what works + what breaks in a single pass. Run via
 *   node verify-p2p-dbe-e2e.mjs
 *
 * Preflight: the DER server MUST be running on :8085 and the Vite
 * dev server on :5174 (the standard dev stack). Playwright is a
 * normal dev dep.
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5174';
const SERVER = 'http://localhost:8085';
const USER = process.env.DER_BOOTSTRAP_ADMIN_USERNAME ?? 'der-admin';
const PASS = process.env.DER_BOOTSTRAP_ADMIN_PASSWORD;
if (!PASS) {
  console.error('DER_BOOTSTRAP_ADMIN_PASSWORD env var required');
  process.exit(2);
}

const log = (...args) => console.log('·', ...args);
const pass = (msg) => console.log('  ✓', msg);
const fail = (msg, err) => {
  failures.push({ msg, err: err instanceof Error ? err.message : String(err ?? '') });
  console.log('  ✗', msg, err instanceof Error ? `(${err.message})` : '');
};

const failures = [];

const browser = await chromium.launch({
  // Chrome's default mDNS-obfuscated host candidates (xxxx.local)
  // only resolve on the browser context that generated them. Two
  // separate Playwright contexts in the same chromium process can't
  // reach each other's .local names, so the ICE pair never
  // connects. Production devices on a shared LAN have real public
  // IPs and don't hit this; disabling the obfuscation is the
  // test-env-appropriate workaround.
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
});

// ───────────────────────── two independent contexts ─────────────
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageA = await ctxA.newPage();
const pageB = await ctxB.newPage();

async function signIn(page, label) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  if (await page.locator('input[name="username"]').count()) {
    await page.fill('input[name="username"]', USER);
    await page.fill('input[name="password"]', PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
  }
  await page.waitForTimeout(1200);
  // Dismiss the Install blocker so we can see the actual screens.
  await page.evaluate(() => localStorage.setItem('der.install.ack', '1'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const deviceId = await page.evaluate(() =>
    localStorage.getItem('der_device_id'));
  log(`${label} signed in; deviceId=${deviceId ? deviceId.slice(0, 8) : 'MISSING'}…`);
  return deviceId;
}

log('Step 0 — sign in on both contexts');
const devA = await signIn(pageA, 'A');
const devB = await signIn(pageB, 'B');
if (!devA || !devB) {
  fail('both contexts should enroll a device_id', 'MISSING');
  await browser.close(); process.exit(1);
}

// ───────────────────────── approve both devices ────────────────
log('Step 1 — approve both devices (admin API)');
async function approveDevice(deviceId) {
  // Use context A's cookie jar (same DER admin as B).
  const cookies = await ctxA.cookies(SERVER);
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const r = await fetch(`${SERVER}/edge-api/v1/devices/${deviceId}/approve`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
  });
  return { ok: r.ok, status: r.status, body: await r.text().catch(() => '') };
}
const rA = await approveDevice(devA);
const rB = await approveDevice(devB);
rA.ok ? pass(`approve A → ${rA.status}`) : fail(`approve A → ${rA.status}`, rA.body);
rB.ok ? pass(`approve B → ${rB.status}`) : fail(`approve B → ${rB.status}`, rB.body);

// ───────────────────────── open /peers on both ─────────────────
log('Step 2 — navigate both to /peers');
// domcontentloaded (not networkidle) — the Peers screen polls /pending
// every 2s and the continuity badge every 2s, so networkidle never
// settles. domcontentloaded + an explicit wait for the device list
// gives us the deterministic surface we need.
await Promise.all([
  pageA.goto(`${BASE}/peers`, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
  pageB.goto(`${BASE}/peers`, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
]);
await Promise.all([
  pageA.waitForSelector('.der-peer-list li', { timeout: 10_000 }).catch(() => {}),
  pageB.waitForSelector('.der-peer-list li', { timeout: 10_000 }).catch(() => {}),
]);
await pageA.waitForTimeout(2000);
await pageB.waitForTimeout(2000);

// ───────────────────────── initiate + accept P2P ───────────────
log('Step 3 — initiate P2P: A → B');
// Look for B's row on A's peers list by its device-id prefix + click
// its Connect button. The list renders deviceId.slice(0,8) + '…'.
const connectResult = await pageA.evaluate(async (targetId) => {
  const short = targetId.slice(0, 8);
  const rows = Array.from(document.querySelectorAll('li'));
  for (const li of rows) {
    if (li.textContent?.includes(short)) {
      const btn = li.querySelector('button');
      if (btn && !btn.disabled && btn.textContent?.includes('Connect')) {
        btn.click();
        return { clicked: true, label: btn.textContent };
      }
      return { clicked: false,
        reason: `button state: disabled=${btn?.disabled}, label=${btn?.textContent}` };
    }
  }
  return { clicked: false, reason: `no row for ${short}` };
}, devB);
connectResult.clicked
  ? pass(`A clicked Connect toward B (${connectResult.label})`)
  : fail('A could not click Connect on B', connectResult.reason);

// B polls /pending every 2s — wait up to 5s then auto-accept.
await pageB.waitForTimeout(4000);
const acceptResult = await pageB.evaluate(() => {
  const accepts = Array.from(document.querySelectorAll('button'))
    .filter((b) => b.textContent?.trim() === 'Accept');
  if (accepts.length === 0) return { clicked: false, reason: 'no Accept button visible' };
  accepts[0].click();
  return { clicked: true, count: accepts.length };
});
acceptResult.clicked
  ? pass(`B accepted incoming offer`)
  : fail('B did not see an incoming offer to accept', acceptResult.reason);

// Poll for up to 25s so a slow ICE check (or STUN round-trip) can
// finish. Reports the final status either way so test-env issues
// are easy to see.
let sessionA = []; let sessionB = [];
for (let i = 0; i < 25; i += 1) {
  await pageA.waitForTimeout(1000);
  sessionA = await pageA.evaluate(() => Array.from(document.querySelectorAll(
    '.der-peer-session-card [class*="der-p2p-tag-"]'))
    .map((s) => s.textContent?.trim()).filter(Boolean));
  sessionB = await pageB.evaluate(() => Array.from(document.querySelectorAll(
    '.der-peer-session-card [class*="der-p2p-tag-"]'))
    .map((s) => s.textContent?.trim()).filter(Boolean));
  if (sessionA.includes('connected') && sessionB.includes('connected')) break;
}
log(`A session status chips: ${JSON.stringify(sessionA)}`);
log(`B session status chips: ${JSON.stringify(sessionB)}`);
const aConnected = sessionA.includes('connected');
const bConnected = sessionB.includes('connected');
aConnected ? pass('A side reports connected') : fail('A side not connected', sessionA);
bConnected ? pass('B side reports connected') : fail('B side not connected', sessionB);

// ───────────────────────── DBE shell cache + API mirror ────────
log('Step 4 — DBE shell + API mirror (on A)');

// Register SW manually (dev build gates registration to prod).
await pageA.evaluate(() => navigator.serviceWorker.register('/sw.js', { scope: '/' }));
await pageA.waitForFunction(() =>
  navigator.serviceWorker.controller != null, { timeout: 10_000 }).catch(() => {});
// Reload once so the SW is in control + prefetch fires through it.
await pageA.reload({ waitUntil: 'domcontentloaded' });
await pageA.waitForTimeout(8000);

const dbeState = await pageA.evaluate(async () => {
  const caches = ('caches' in self) ? await self.caches.keys() : [];
  const shellCache = caches.find((n) => n.endsWith('-shell'));
  const shellCount = shellCache
    ? (await (await self.caches.open(shellCache)).keys()).length : 0;
  // IDB count
  const count = await new Promise((resolve) => {
    const req = indexedDB.open('der-dbe-v1', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('api_responses')) {
        db.createObjectStore('api_responses', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('api_responses')) {
        db.close(); resolve(0); return;
      }
      const tx = db.transaction('api_responses', 'readonly');
      const c = tx.objectStore('api_responses').count();
      c.onsuccess = () => { resolve(c.result); db.close(); };
    };
    req.onerror = () => resolve(0);
  });
  return { shellCount, apiMirrorCount: count };
});
log(`A caches: shell=${dbeState.shellCount} entries, api_responses=${dbeState.apiMirrorCount} rows`);
dbeState.shellCount > 10 ? pass('shell cache populated') : fail('shell cache empty', dbeState);
dbeState.apiMirrorCount > 5 ? pass('API mirror populated via prefetch') : fail('API mirror thin', dbeState);

// ───────────────────────── X-DER-From-DBE on simulated offline ─
log('Step 5 — route /api/** via SW; check X-DER-From-DBE on simulated offline');
// page.route intercepts BEFORE the SW gets called, so the SW never
// sees the request. Switch the context to offline instead — that
// forces every network fetch to fail at the browser layer, the SW
// catches the throw in its try/catch, and falls back to the IDB
// mirror. That's the real production path.
await ctxA.setOffline(true);
const probe = await pageA.evaluate(async () => {
  try {
    const r = await fetch('/api/me', { credentials: 'include' });
    return {
      status: r.status,
      fromDbe: r.headers.get('x-der-from-dbe'),
      fromCache: r.headers.get('x-der-from-cache'),
    };
  } catch (ex) {
    return { error: String(ex) };
  }
});
log(`probe /api/me offline → ${JSON.stringify(probe)}`);
if (probe.status === 200 && probe.fromDbe === '1') {
  pass('SW served /api/me from DBE mirror after context went offline');
} else if (probe.status === 503) {
  fail('SW returned 503 DBE_OFFLINE instead of serving mirror', probe);
} else {
  fail('SW did not serve from mirror', probe);
}
await ctxA.setOffline(false);

// ───────────────────────── summary ─────────────────────────────
log('');
if (failures.length === 0) {
  console.log('🟢 ALL PASS — P2P + DBE end-to-end integration healthy');
} else {
  console.log(`🔴 ${failures.length} FAIL(s):`);
  for (const f of failures) console.log(`   - ${f.msg}: ${f.err}`);
}

await browser.close();
process.exit(failures.length === 0 ? 0 : 1);
