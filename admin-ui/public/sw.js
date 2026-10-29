/*
 * DER admin-UI service worker — §8 offline-first.
 *
 * Strategy:
 *   • Shell (HTML, hashed JS, hashed CSS, SVG icons) → cache-first.
 *   • /edge-api/v1/* GETs that return JSON → stale-while-revalidate
 *     for Overview + Network sub-pages so an operator sees last-known
 *     data when DER is briefly unreachable.
 *   • POST/PUT/DELETE → always network; never cached.
 *   • SSE stream → always network.
 *
 * Cache keys are versioned by SW_VERSION so a new deploy evicts the
 * old cache on first activation.
 */

const SW_VERSION = 'der-admin-v2.2.4';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const DATA_CACHE  = `${SW_VERSION}-data`;

const SHELL_PATHS = [
  '/admin/',
  '/admin/index.html',
];

const DATA_PATHS = [
  /^\/edge-api\/v1\/system\/health$/,
  /^\/edge-api\/v1\/network\/status$/,
  /^\/edge-api\/v1\/network\/access-point$/,
  /^\/edge-api\/v1\/network\/interfaces$/,
  /^\/edge-api\/v1\/network\/events/,
  /^\/edge-api\/v1\/activity\/recent/,
  /^\/edge-api\/v1\/fleet\/summary$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_PATHS).catch(() => undefined),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((n) => !n.startsWith(SW_VERSION))
        .map((n) => caches.delete(n)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache SSE
  if (req.headers.get('accept')?.includes('text/event-stream')) return;

  // Shell: cache-first for the admin app shell + hashed assets
  if (url.pathname.startsWith('/admin/')) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // Stale-while-revalidate for whitelisted API GETs
  if (DATA_PATHS.some((re) => re.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp.ok) {
      cache.put(req, resp.clone()).catch(() => undefined);
    }
    return resp;
  } catch (ex) {
    // Fall back to the shell root so SPA routing works offline
    const shellFallback = await cache.match('/admin/');
    if (shellFallback) return shellFallback;
    return new Response('offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((resp) => {
    if (resp.ok) {
      cache.put(req, resp.clone()).catch(() => undefined);
    }
    return resp;
  }).catch(() => cached || new Response(JSON.stringify({ offline: true }), {
    status: 503, headers: { 'content-type': 'application/json' },
  }));
  return cached || networkPromise;
}
