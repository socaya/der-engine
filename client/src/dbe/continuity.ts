import { useEffect, useState } from 'react';

import { count as queueCount } from '../offline/queue';
import { prefetchStatus } from './prefetch';
import { storageStatus, type StorageStatus } from './storage';

/**
 * DBE.4 — one-shot snapshot + hook over the full continuity surface.
 *
 * <p>Collects server reachability, SW cache stats, storage posture,
 * prefetch health, and queue state in one call so the topbar chip
 * and the Peers continuity card draw from the same source of truth
 * rather than probing the browser APIs independently.</p>
 *
 * <p>Snapshot is relatively cheap (~5ms) but polls at a sensible
 * cadence (2s active, 10s when hidden) to avoid thrashing
 * IndexedDB counters.</p>
 */

export type ContinuityLevel = 'healthy' | 'degraded' | 'offline';

export interface ContinuitySnapshot {
  readonly level: ContinuityLevel;
  readonly serverReachable: boolean;
  readonly lastServerOkAt: string | null;
  readonly queued: number;
  readonly storage: StorageStatus;
  readonly dbeShellCacheEntries: number;
  readonly dbeApiMirrorEntries: number;
  readonly prefetchLastRunAt: string | null;
  readonly prefetchLastCached: number;
  readonly collectedAt: string;
}

const ACTIVE_INTERVAL_MS = 2000;
const HIDDEN_INTERVAL_MS = 10_000;

let cachedLastOkAt: string | null = null;

/** Hook form — subscribes with a timer, returns the latest snapshot.
 *  Suspended when the tab is hidden to save battery. */
export function useContinuity(): ContinuitySnapshot | null {
  const [snap, setSnap] = useState<ContinuitySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const s = await collectContinuity();
        if (!cancelled) setSnap(s);
      } catch {
        // Browser storage can throw in private mode etc. — leave
        // the previous snapshot in place.
      }
      const delay = document.hidden ? HIDDEN_INTERVAL_MS : ACTIVE_INTERVAL_MS;
      timer = setTimeout(tick, delay);
    };
    void tick();

    const onVisibility = (): void => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return snap;
}

/** One-shot collector — used by the hook and by tests. Keep in sync
 *  with the fields in {@link ContinuitySnapshot}. */
export async function collectContinuity(): Promise<ContinuitySnapshot> {
  const [storage, queued, cacheStats] = await Promise.all([
    storageStatus(),
    safeQueueCount(),
    collectCacheStats(),
  ]);
  const serverReachable = await probeServer();
  if (serverReachable) {
    cachedLastOkAt = new Date().toISOString();
  }
  const prefetch = prefetchStatus();
  const level = computeLevel({
    serverReachable,
    storagePersistent: storage.persistent,
    queued,
    shellCached: cacheStats.shellEntries > 0,
    mirrorCached: cacheStats.apiMirrorEntries > 0,
  });
  return {
    level,
    serverReachable,
    lastServerOkAt: cachedLastOkAt,
    queued,
    storage,
    dbeShellCacheEntries: cacheStats.shellEntries,
    dbeApiMirrorEntries: cacheStats.apiMirrorEntries,
    prefetchLastRunAt: prefetch.lastRunAt,
    prefetchLastCached: prefetch.entriesCached,
    collectedAt: new Date().toISOString(),
  };
}

async function safeQueueCount(): Promise<number> {
  try {
    return (await queueCount('aggregate'))
      + (await queueCount('event'))
      + (await queueCount('tracker'));
  } catch {
    return 0;
  }
}

interface CacheStats {
  readonly shellEntries: number;
  readonly apiMirrorEntries: number;
}

async function collectCacheStats(): Promise<CacheStats> {
  let shellEntries = 0;
  let apiMirrorEntries = 0;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const name of keys) {
        const cache = await caches.open(name);
        const n = (await cache.keys()).length;
        if (name.endsWith('-shell') || name.endsWith('-dhis2-apps')) {
          shellEntries += n;
        }
      }
    }
  } catch { /* SW unavailable */ }
  try {
    apiMirrorEntries = await countApiMirror();
  } catch { /* IDB unavailable */ }
  return { shellEntries, apiMirrorEntries };
}

/** Count entries in the der-dbe-v1.api_responses store. Opens with
 *  the full upgrade hook so a page-side read that beats the SW to
 *  the DB doesn't create an empty v1 that blocks the SW's own store
 *  creation (observed race during verify-dbe-storage.mjs probe —
 *  SW would intercept /api/me, call cacheApiResponse → openDbe, find
 *  v1 already present with no stores, skip onupgradeneeded, and
 *  silently fail every write). Both the SW and this reader MUST
 *  create the store if missing. */
async function countApiMirror(): Promise<number> {
  return new Promise((resolve) => {
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
      const countReq = tx.objectStore('api_responses').count();
      countReq.onsuccess = () => {
        resolve(countReq.result);
        db.close();
      };
      countReq.onerror = () => { resolve(0); db.close(); };
    };
    req.onerror = () => resolve(0);
  });
}

async function probeServer(): Promise<boolean> {
  try {
    const r = await fetch('/edge-api/v1/system/health', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    return r.ok;
  } catch {
    return false;
  }
}

interface LevelInputs {
  serverReachable: boolean;
  storagePersistent: boolean;
  queued: number;
  shellCached: boolean;
  mirrorCached: boolean;
}

function computeLevel(i: LevelInputs): ContinuityLevel {
  if (i.serverReachable) return 'healthy';
  // Server down — DBE coverage saves us if we have at least the
  // shell cache and the API mirror has something in it. Persistent
  // storage is nice to have but not required (a short outage
  // doesn't need persistence to survive).
  if (i.shellCached && i.mirrorCached) return 'degraded';
  return 'offline';
}

/** Non-hook form of the server-reachability state. Used by the
 *  RecoveryBanner to detect the online → offline → online pattern
 *  that triggers the drain prompt. Returns the last snapshot's
 *  value synchronously. */
export function peekLastServerOk(): string | null {
  return cachedLastOkAt;
}
