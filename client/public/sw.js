/* eslint-disable no-restricted-globals */
/**
 * DER device-client service worker.
 *
 * Scope: /. Precaches the built shell on install; serves the app
 * (index.html) from cache on navigation requests so the device
 * client opens without the edge being reachable. Live DER /edge-api
 * and /api calls fall through to the network — the offline queue in
 * src/offline/queue.ts handles write buffering; the SW does NOT
 * replay POSTs so there is a single source of truth for retries.
 *
 * Minimum PWA so iOS/Chrome will accept the "Add to Home screen"
 * install prompt, backed by a tiny precache pattern (no workbox).
 */

const SW_VERSION = 'der-sw-v1';
const SHELL_CACHE = `${SW_VERSION}-shell`;

// Routes that must land cached so a cold reboot in the field can
// open the client offline. The manifest + icon are referenced by
// the browser install flow and must be served on first paint too.
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/pwa/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API traffic is always network. Writes go through the IndexedDB
  // offline queue in src/offline/queue.ts; GETs rely on the edge so
  // the UI shows a real error instead of a stale cached response.
  if (url.pathname.startsWith('/api/')
      || url.pathname.startsWith('/edge-api/')) {
    return;
  }

  // Navigation requests → serve the SPA shell. Vite's build hashes
  // asset filenames so routing-based fetches like /capture/runs
  // never land as real files; we always want index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put('/', network.clone());
          return network;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match('/');
          if (cached) return cached;
          return new Response(
            '<!doctype html><title>DER offline</title>'
            + '<p style="font-family:sans-serif;padding:24px">'
            + 'DER is offline and the shell is not cached yet. '
            + 'Open while the edge is reachable at least once.</p>',
            { headers: { 'Content-Type': 'text/html' }, status: 503 },
          );
        }
      })(),
    );
    return;
  }

  // Static assets (hashed JS / CSS / fonts / SVG) → cache-first.
  // The hash guarantees a new URL on upgrade, so stale assets are
  // harmless. Non-hashed HTML paths fall out through the navigate
  // branch above.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const network = await fetch(request);
      if (network.ok && network.type === 'basic') {
        cache.put(request, network.clone());
      }
      return network;
    })(),
  );
});
