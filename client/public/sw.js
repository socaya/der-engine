/* eslint-disable no-restricted-globals */
/* global caches, Response, Headers, fetch, URL, self, indexedDB */
/**
 * DER device-client service worker.
 *
 * Scope: /. Three caching envelopes:
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
 *   3. /api/** GET responses (DBE.2a, ADR-0039 L2). Network-first
 *      with IndexedDB mirror fallback. On every successful network
 *      response, the body + status + content-type land in the
 *      der-dbe-v1.api_responses store keyed by URL. When the server
 *      is unreachable (network fail OR 5xx), the SW serves the last
 *      cached body and stamps X-DER-From-DBE: 1 so devtools + the
 *      future continuity banner can tell cached vs live apart.
 *
 * Writes (POST/PUT/PATCH/DELETE) always pass through. The offline
 * queue in src/offline/queue.ts handles buffering + replay; the SW
 * does NOT replay POSTs so retries have a single source of truth.
 */

const SW_VERSION = 'der-sw-v3';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const DHIS2_APP_CACHE = `${SW_VERSION}-dhis2-apps`;
const DHIS2_APP_CACHE_MAX_ENTRIES = 300;

// DBE.2a — IndexedDB mirror for /api/** GET responses.
const DBE_DB_NAME = 'der-dbe-v1';
const DBE_DB_VERSION = 1;
const API_RESPONSES_STORE = 'api_responses';
// Cap on cached /api responses. A clinic tablet exercising Dashboard
// + DV + Capture can accumulate hundreds of distinct URL shapes;
// FIFO trim when we pass this.
const API_RESPONSES_MAX_ENTRIES = 1000;

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
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ─── /api/** GETs — DBE.2a ────────────────────────────────────
  // Network-first with IDB fallback. Only GET: writes continue
  // through the existing offline queue so there's one source of
  // truth for replay.
  if (request.method === 'GET' && url.pathname.startsWith('/api/')) {
    event.respondWith(serveApi(event, request, url));
    return;
  }

  // Everything else below only cares about GET.
  if (request.method !== 'GET') return;

  // ─── DHIS2 app bundles — DBE.1 ────────────────────────────────
  if (isDhis2AppRequest(url)) {
    event.respondWith(serveDhis2App(event, request));
    return;
  }

  // ─── /edge-api traffic → network (today) ──────────────────────
  // A future DBE batch may intercept selective /edge-api reads
  // (e.g. GET /edge-api/v1/apps/installed for launcher). Today the
  // offline queue handles write buffering; reads need the server.
  if (url.pathname.startsWith('/edge-api/')) {
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

// ─── DHIS2 app helpers (DBE.1) ─────────────────────────────────

function isDhis2AppRequest(url) {
  return url.pathname.startsWith('/dhis-web-')
    || /^\/edge-api\/v1\/apps\/[^/]+\/[^/]+\//.test(url.pathname);
}

async function serveDhis2App(event, request) {
  const cache = await caches.open(DHIS2_APP_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    event.waitUntil(refreshDhis2App(request, cache));
    return taggedFromCache(cached, 'X-DER-From-Cache');
  }
  try {
    const network = await fetch(request);
    if (network.ok && network.type === 'basic') {
      await cache.put(request, network.clone());
      event.waitUntil(trimCache(DHIS2_APP_CACHE, DHIS2_APP_CACHE_MAX_ENTRIES));
    }
    return network;
  } catch {
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
    // Server down — silent.
  }
}

async function taggedFromCache(response, header) {
  const headers = new Headers(response.headers);
  headers.set(header ?? 'X-DER-From-Cache', '1');
  return new Response(await response.clone().blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

// ─── DBE.2a — /api/** interceptor + IndexedDB mirror ────────────

/** Network-first serve for /api/** GETs. On a 2xx response the body
 *  lands in the IDB mirror keyed by URL (path + query) so a later
 *  network failure can fall back to it. 5xx responses are NOT
 *  cached — they would poison the mirror with error pages. */
async function serveApi(event, request, url) {
  try {
    const network = await fetch(request);
    if (network.ok && network.type === 'basic') {
      // Clone + cache before returning so a slow IDB write doesn't
      // delay the caller. Fire-and-forget via waitUntil.
      event.waitUntil(cacheApiResponse(url.pathname + url.search, network.clone()));
    }
    return network;
  } catch {
    // Network failed — try the IDB mirror.
    const cached = await readApiResponse(url.pathname + url.search);
    if (cached) {
      return rehydrateApiResponse(cached);
    }
    // Nothing cached either — surface a 503 so the caller's error
    // handler kicks in instead of an opaque 'fetch failed'.
    return new Response(
      JSON.stringify({
        httpStatus: 'ServiceUnavailable',
        httpStatusCode: 503,
        status: 'ERROR',
        code: 'DBE_OFFLINE',
        message: 'DER server unreachable and no cached response for '
          + (url.pathname + url.search),
      }),
      { status: 503, statusText: 'DER Offline',
        headers: { 'Content-Type': 'application/json' } });
  }
}

/** Cache one /api response's body + status + content-type in IDB.
 *  Keyed by the URL path+query; content-type is preserved so the
 *  rehydrated Response's Blob has the right MIME. */
async function cacheApiResponse(key, response) {
  try {
    const body = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/json';
    await idbPut(API_RESPONSES_STORE, {
      key,
      status: response.status,
      statusText: response.statusText,
      contentType,
      body,
      cachedAt: Date.now(),
    });
    await trimIdbStore(API_RESPONSES_STORE, API_RESPONSES_MAX_ENTRIES);
  } catch {
    // IDB unavailable / quota exceeded — silent. Degraded-storage
    // banner already surfaces the persistence posture; one missed
    // cache write doesn't need its own alert.
  }
}

/** Read a cached response by URL key. Returns null on miss or on
 *  IDB failure (treated as a miss). */
async function readApiResponse(key) {
  try {
    return await idbGet(API_RESPONSES_STORE, key);
  } catch {
    return null;
  }
}

/** Rebuild a Response from a mirror row. Stamps X-DER-From-DBE: 1 so
 *  the caller + future continuity UI can tell this came from the
 *  mirror rather than the network. */
function rehydrateApiResponse(row) {
  const headers = new Headers({
    'Content-Type': row.contentType,
    'X-DER-From-DBE': '1',
    'X-DER-Cached-At': new Date(row.cachedAt).toISOString(),
  });
  return new Response(row.body, {
    status: row.status,
    statusText: row.statusText,
    headers,
  });
}

// ─── Vanilla IndexedDB wrapper — no external deps ──────────────

function openDbe() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DBE_DB_NAME, DBE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(API_RESPONSES_STORE)) {
        db.createObjectStore(API_RESPONSES_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, value) {
  const db = await openDbe();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).put(value);
  });
}

async function idbGet(storeName, key) {
  const db = await openDbe();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function trimIdbStore(storeName, maxEntries) {
  const db = await openDbe();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const countReq = store.count();
    countReq.onsuccess = () => {
      const excess = countReq.result - maxEntries;
      if (excess <= 0) {
        resolve();
        return;
      }
      // Delete oldest by cachedAt via a cursor. Open an index-less
      // cursor + sort ad-hoc since we don't have an index on
      // cachedAt (would double the write cost). N rows is small
      // enough for in-memory sort.
      const rows = [];
      store.openCursor().onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor) {
          rows.push({ key: cursor.key, cachedAt: cursor.value.cachedAt ?? 0 });
          cursor.continue();
          return;
        }
        rows.sort((a, b) => a.cachedAt - b.cachedAt);
        for (let i = 0; i < excess; i++) {
          store.delete(rows[i].key);
        }
        resolve();
      };
    };
    countReq.onerror = () => reject(countReq.error);
  });
}
