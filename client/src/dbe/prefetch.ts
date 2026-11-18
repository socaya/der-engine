import { broadcast } from './storage';

/**
 * DBE.2b — proactive prefetch of high-value /api endpoints into the
 * DBE IndexedDB mirror.
 *
 * <p>Context: DBE.2a's SW interceptor auto-caches any /api GET that
 * happens to go over the wire. That's reactive — the mirror fills
 * up based on what operators naturally browse. Proactive prefetch
 * closes the gap by hitting the handful of endpoints EVERY DHIS2
 * app shell probes at boot (me, systemSettings, periodTypes,
 * organisationUnits, configuration) on a schedule, so the mirror
 * has fresh content even for apps the operator hasn't opened in
 * hours.</p>
 *
 * <p>Design: this module just runs native {@code fetch()} calls.
 * The SW interceptor at {@code public/sw.js} transparently writes
 * the response bodies into {@code der-dbe-v1.api_responses} on
 * every 2xx — no direct IDB access from this module needed. If the
 * server is unreachable the fetch rejects and we skip until the
 * next tick.</p>
 *
 * <p>Schedule:
 * <ul>
 *   <li>Once at app boot, after a short delay so initial SPA-render
 *       fetches get priority.</li>
 *   <li>Every {@link REFRESH_INTERVAL_MS} while online + the page
 *       is visible. Suspended when offline or the tab is hidden so
 *       we don't drain background power.</li>
 *   <li>Once on {@code online}/{@code visibilitychange} transitions
 *       that bring the tab back from offline/hidden.</li>
 * </ul></p>
 */

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** The canonical set of endpoints that every DHIS2 app shell + the
 *  DER-native screens probe during boot. Keeping these fresh in the
 *  mirror means first-paint after a server drop stays snappy + the
 *  apps don't 502 on boot probes. */
const PREFETCH_URLS: readonly string[] = [
  // Identity + session
  '/api/me',
  '/api/me?fields=id',
  '/api/me?fields=authorities,avatar,email,name,settings',
  '/api/me/dashboard',
  '/api/userSettings',
  '/api/system/info',

  // System configuration
  '/api/systemSettings',
  '/api/systemSettings/applicationTitle',
  '/api/systemSettings/keyAnalysisRelativePeriod',
  '/api/systemSettings/analyticsFinancialYearStart',
  '/api/systemSettings/analyticsWeeklyStart',
  '/api/systemSettings/keyCustomTranslationsEnabled',
  '/api/systemSettings/helpPageLink',

  // Analytics bootstrap
  '/api/configuration/dataOutputPeriodTypes',
  '/api/periodTypes',
  '/api/periodTypes/relativePeriodTypes',
  '/api/dimensions?fields=id,displayName~rename(name),dimensionType,dataDimensionType&order=displayName:asc&paging=false',

  // Org units
  '/api/organisationUnits?fields=id,displayName,name&userDataViewFallback=true&paging=false',
  '/api/organisationUnitLevels?fields=id,level,displayName,name&paging=false',

  // Data stores DV / Dashboard read
  '/api/dataStore/analytics/settings',
  '/api/dataStore/analytics/savedObjects',
  '/api/userDataStore/analytics/settings',
  '/api/userDataStore/analytics/savedObjects',

  // Configuration aggregate (DBE.2 reads the full map on boot)
  '/api/configuration',
];

interface PrefetchStatus {
  readonly lastRunAt: string | null;
  readonly lastDuration: number;
  readonly lastError: string | null;
  readonly entriesAttempted: number;
  readonly entriesCached: number;
  readonly entriesFailed: number;
}

let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let status: PrefetchStatus = {
  lastRunAt: null,
  lastDuration: 0,
  lastError: null,
  entriesAttempted: 0,
  entriesCached: 0,
  entriesFailed: 0,
};

/**
 * Fire once at app boot. Schedules the recurring refresh + binds
 * online/visibility listeners. Call exactly once (from main.tsx).
 * Subsequent calls are no-ops so a hot-reload during dev doesn't
 * spawn duplicate timers.
 */
export function startPrefetchLoop(): void {
  if (timer) return;

  // Delay the first run slightly so initial SPA-render fetches
  // don't contend with us for network. 2s is enough for DerHome to
  // land its first paint.
  setTimeout(() => void runOnce('boot'), 2000);

  timer = setInterval(() => {
    if (shouldSkipTick()) return;
    void runOnce('interval');
  }, REFRESH_INTERVAL_MS);

  // Resume promptly when the tab regains online or visibility —
  // don't wait a full interval to re-fill.
  window.addEventListener('online', () => void runOnce('online'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) {
      void runOnce('visibilitychange');
    }
  });
}

export function stopPrefetchLoop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Snapshot of the last run. Used by the future Peers continuity
 *  card (DBE.4) to show operators that prefetch is alive. */
export function prefetchStatus(): PrefetchStatus {
  return status;
}

function shouldSkipTick(): boolean {
  return running
    || !navigator.onLine
    || document.hidden;
}

async function runOnce(reason: string): Promise<void> {
  if (running) return;
  if (!navigator.onLine) return;
  running = true;
  const started = Date.now();
  let cached = 0;
  let failed = 0;
  try {
    // Fire in parallel bounded to 4 concurrent — more would hammer
    // the dev server + risk per-origin connection caps on the
    // browser side.
    await runWithConcurrency(PREFETCH_URLS, 4, async (url) => {
      try {
        const r = await fetch(url, {
          credentials: 'include',
          headers: { Accept: 'application/json' },
          // cache: 'no-store' bypasses the browser's HTTP cache so
          // the SW interceptor always sees a fresh network fetch
          // and writes the latest body into the mirror.
          cache: 'no-store',
        });
        if (r.ok) {
          cached += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    });
    status = {
      lastRunAt: new Date().toISOString(),
      lastDuration: Date.now() - started,
      lastError: null,
      entriesAttempted: PREFETCH_URLS.length,
      entriesCached: cached,
      entriesFailed: failed,
    };
    broadcast({
      kind: 'metadata.synced',
      fingerprint: `prefetch-${reason}`,
      at: status.lastRunAt!,
    });
  } catch (ex) {
    status = {
      ...status,
      lastRunAt: new Date().toISOString(),
      lastDuration: Date.now() - started,
      lastError: (ex as Error).message,
    };
  } finally {
    running = false;
  }
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i += 1) {
    runners.push((async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (next === undefined) break;
        await worker(next);
      }
    })());
  }
  await Promise.all(runners);
}
