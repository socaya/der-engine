/* eslint-disable no-restricted-globals */
/* global caches, Response, Headers, fetch, URL, self */
/**
 * DER device-client service worker.
 *
 * Scope: /. Covers two caching envelopes:
 *
 *   1. DER SPA shell (index.html + hashed assets) + manifest/icon —
 *      cached at install + opportunistically. Cold boot in the field
 *      opens the client without the edge being reachable.
 *
 *   2. DHIS2 app bundles served from /dhis-web-<key>/** and the
 *      signed /edge-api/v1/apps/<id>/<version>/** path (DBE.1,
 *      ADR-0039). Cache-first with background revalidate on every
 *      hit, so Dashboard / Data Visualizer / Maps / eRegisters /
 *      custom apps keep opening when the DER server is down —
 *      provided the operator opened them at least once while
 *      online.
 *
 * Live DER /edge-api and /api calls fall through to the network —
 * the offline queue in src/offline/queue.ts handles write buffering;
 * the SW does NOT replay POSTs so there is a single source of truth
 * for retries.
 *
 * DBE.2 will extend this file to intercept /api/** with an
 * IndexedDB-backed mirror. That layer sits ON TOP of the shell +
 * bundle caching here — DBE.1 lands app loadability; DBE.2 lands
 * API read continuity.
 */

const SW_VERSION = 'der-sw-v2';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const DHIS2_APP_CACHE = `${SW_VERSION}-dhis2-apps`;
// Cap per cache to keep storage from growing unbounded on an
// appliance with dozens of installed apps. Evicted FIFO when the
// cap is hit — see trimCache().
const DHIS2_APP_CACHE_MAX_ENTRIES = 300;

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
      // Keep this version's caches; evict everything older so a new
      // DER release doesn't leak a stale shell + assets.
      const keep = new Set([SHELL_CACHE, DHIS2_APP_CACHE]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
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

  // ─── DHIS2 app bundles — DBE.1 ────────────────────────────────
  // Two URL shapes:
  //   /dhis-web-<key>/**                              AppStaticHandler
  //   /edge-api/v1/apps/<id>/<version>/**             signed bundles
  // Both get cache-first with background revalidate so a tablet
  // that's opened the app once keeps working if the edge dies
  // afterwards. Icons + manifest files inside the bundle ride the
  // same cache since they live under the same path prefix.
  if (isDhis2AppRequest(url)) {
    event.respondWith(serveDhis2App(event, request));
    return;
  }

  // ─── API traffic → network (today) ─────────────────────────────
  // DBE.2 will add an IndexedDB mirror interceptor here for /api/*
  // reads. Today: pass through so the UI gets a real error instead
  // of a stale cached response; writes already go through the
  // offline queue in src/offline/queue.ts.
  if (url.pathname.startsWith('/api/')
      || url.pathname.startsWith('/edge-api/')) {
    return;
  }

  // ─── Navigation (DER SPA shell) ────────────────────────────────
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

  // ─── Static assets (hashed JS / CSS / fonts / SVG) ─────────────
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

/** True for the two URL shapes the SW treats as installed DHIS2 app
 *  content under DBE.1. Keeps the fetch-handler branch cheap. */
function isDhis2AppRequest(url) {
  return url.pathname.startsWith('/dhis-web-')
    || /^\/edge-api\/v1\/apps\/[^/]+\/[^/]+\//.test(url.pathname);
}

/** Cache-first serve for a DHIS2 app bundle request. Returns the
 *  cached Response immediately when present; kicks off a background
 *  update either way so hot-fixes propagate on the next open
 *  without the user having to clear the cache.
 *
 *  Cached responses get an X-DER-From-Cache: 1 header so dev-tools
 *  + the DBE.4 continuity banner (ADR-0039) can distinguish cached
 *  vs network-fresh content. */
async function serveDhis2App(event, request) {
  const cache = await caches.open(DHIS2_APP_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    // Fire-and-forget background refresh; swallow errors so a
    // failed refresh (server down) doesn't surface to the caller.
    event.waitUntil(refreshDhis2App(request, cache));
    return taggedFromCache(cached);
  }
  try {
    const network = await fetch(request);
    if (network.ok && network.type === 'basic') {
      await cache.put(request, network.clone());
      // Non-blocking trim so a huge bundle write doesn't stall
      // the response.
      event.waitUntil(trimCache(DHIS2_APP_CACHE, DHIS2_APP_CACHE_MAX_ENTRIES));
    }
    return network;
  } catch {
    // No cache + no network. Return 503 so the caller's error
    // handler kicks in — otherwise the browser surfaces an opaque
    // 'fetch failed' that masks the real problem (server down,
    // bundle never cached).
    return new Response(
      'DHIS2 app bundle not cached and DER server unreachable',
      { status: 503, statusText: 'DER Offline' });
  }
}

async function refreshDhis2App(request, cache) {
  try {
    const network = await fetch(request);
    if (network.ok && network.type === 'basic') {
      await cache.put(request, network);
      await trimCache(DHIS2_APP_CACHE, DHIS2_APP_CACHE_MAX_ENTRIES);
    }
  } catch {
    // Server down — silent, cached response already served.
  }
}

/** Wrap a cached Response with an X-DER-From-Cache: 1 header so
 *  consumers can tell it came from DBE. Response objects are
 *  immutable so we rebuild from the blob; cheap for app-bundle
 *  sizes (tens to hundreds of KB each). */
async function taggedFromCache(response) {
  const headers = new Headers(response.headers);
  headers.set('X-DER-From-Cache', '1');
  return new Response(await response.clone().blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** FIFO eviction when a cache passes maxEntries. Keeps the newest
 *  entries (most recently put). Called after cache.put via waitUntil
 *  so it never blocks the response path. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // keys() returns insertion order (oldest-first) — drop from the
  // front until we're under the cap.
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}
