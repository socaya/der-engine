import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { CatalogueApp } from './catalogue';
import * as signatures from './signatures';

const DB_NAME = 'der-apps';
const DB_VERSION = 1;

interface InstalledAppSchema extends DBSchema {
  installed: {
    key: string;              // `${appId}@${version}@${sha256}`
    value: {
      appId: string;
      appKey: string;
      version: string;
      bundleText: string;
      sha256: string;
      signatureB64: string;
      installedAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<InstalledAppSchema>> | null = null;

function db(): Promise<IDBPDatabase<InstalledAppSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<InstalledAppSchema>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('installed')) {
          d.createObjectStore('installed');
        }
      },
    });
  }
  return dbPromise;
}

/** Test-only: close + delete the IDB + forget the handle. */
export async function __resetForTests(): Promise<void> {
  if (dbPromise) {
    try {
      const d = await dbPromise;
      d.close();
    } catch { /* ignore */ }
  }
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/**
 * Cache key is `${appId}@${version}@${sha256}`. Including the
 * sha256 makes it impossible for a stale cached bundle to shadow a
 * freshly uploaded one — admins frequently iterate on apps without
 * bumping the semver string (DER dev workflow + DHIS2 2.44 apps
 * both tolerate same-version re-uploads server-side via upsert).
 */
function key(appId: string, version: string, sha256: string): string {
  return `${appId}@${version}@${sha256}`;
}

export interface InstallError extends Error {
  readonly code:
    | 'FETCH_FAILED' | 'SHA256_MISMATCH' | 'SIGNATURE_INVALID'
    | 'SIGNING_KEY_UNAVAILABLE' | 'IDB_FAILED';
}

function err(code: InstallError['code'], message: string): InstallError {
  const e = new Error(message) as InstallError & { code: InstallError['code'] };
  e.code = code;
  return e;
}

/**
 * Installer core: fetch the bundle for `app`, verify sha256 +
 * Ed25519 signature against DER's public key, then cache it in
 * IndexedDB keyed on `appId@version`. Idempotent — if the bundle
 * for this exact version is already cached, returns it without a
 * network hop (critical for offline-first).
 *
 * The in-browser cache lives in the `der-apps` IDB; the bundle
 * text is stored as a string so the AppHost can later wrap it in a
 * Blob + import() it as an ESM module. Bytes are kept out of
 * memory once the entry lands in IDB.
 */
export async function ensureInstalled(app: CatalogueApp): Promise<string> {
  const d = await db();
  const cached = await d.get('installed',
    key(app.appId, app.version, app.bundleSha256));
  if (cached) return cached.bundleText;

  // Capture any pre-existing cached version for this app BEFORE
  // we evict it, so a SHA256_MISMATCH at fetch time can roll back
  // to it rather than leaving the operator staring at a "Could
  // not load" screen. The eviction loop below still runs so IDB
  // doesn't accumulate stale rows once a successful install
  // overwrites the fallback.
  let fallback: InstalledAppSchema['installed']['value'] | null = null;
  for (const k of (await d.getAllKeys('installed')) as string[]) {
    if (!k.startsWith(`${app.appId}@`)) continue;
    if (k.endsWith(`@${app.bundleSha256}`)) continue;
    if (!fallback) {
      const row = await d.get('installed', k);
      if (row) fallback = row;
    }
    await d.delete('installed', k);
  }

  let r: Response;
  try {
    r = await fetch(app.bundleUrl, {
      credentials: 'include',
      cache: 'no-store',
    });
  } catch (fetchErr) {
    if (fallback) {
      console.warn('[installer] bundle fetch failed; falling back '
        + 'to previously installed version', fetchErr);
      await reinstateFallback(d, app, fallback);
      return fallback.bundleText;
    }
    throw err('FETCH_FAILED', `bundle fetch failed: ${String(fetchErr)}`);
  }
  if (!r.ok) {
    if (fallback) {
      console.warn(`[installer] bundle fetch returned ${r.status}; `
        + 'falling back to previously installed version');
      await reinstateFallback(d, app, fallback);
      return fallback.bundleText;
    }
    throw err('FETCH_FAILED', `bundle fetch failed (${r.status})`);
  }
  const bundleBytes = new Uint8Array(await r.arrayBuffer());

  const sha = await signatures.sha256Hex(bundleBytes);
  if (sha !== app.bundleSha256) {
    // Catalogue is stale (admin just re-uploaded; the client
    // cached the previous catalogue row). Prefer a working old
    // bundle over a hard failure — the next catalogue refresh
    // will pick up the new bundleSha256 and ensureInstalled will
    // fetch cleanly.
    if (fallback) {
      console.warn(`[installer] sha256 mismatch for ${app.appKey}; `
        + `catalogue=${app.bundleSha256.slice(0, 12)}… `
        + `actual=${sha.slice(0, 12)}…; `
        + 'falling back to previously installed version');
      await reinstateFallback(d, app, fallback);
      return fallback.bundleText;
    }
    throw err('SHA256_MISMATCH',
      `bundle sha256 differs: catalogue=${app.bundleSha256} actual=${sha}`);
  }

  let publicKeyB64: string;
  try {
    publicKeyB64 = (await signatures.fetchSigningKey()).publicKeyB64;
  } catch {
    throw err('SIGNING_KEY_UNAVAILABLE', 'DER signing key is unavailable');
  }
  const ok = await signatures.verifyBundle(bundleBytes, app.signatureB64, publicKeyB64);
  if (!ok) throw err('SIGNATURE_INVALID', 'bundle signature did not verify');

  const bundleText = new TextDecoder().decode(bundleBytes);
  try {
    await d.put('installed', {
      appId: app.appId,
      appKey: app.appKey,
      version: app.version,
      bundleText,
      sha256: sha,
      signatureB64: app.signatureB64,
      installedAt: new Date().toISOString(),
    }, key(app.appId, app.version, app.bundleSha256));
  } catch (e) {
    throw err('IDB_FAILED', (e as Error).message);
  }
  return bundleText;
}

/**
 * Re-insert a fallback row under its original key so subsequent
 * ensureInstalled calls (while the catalogue is still stale) can
 * hit the cached path and skip the eviction + fetch loop
 * entirely. The row is written back verbatim — we didn't touch
 * its sha256/signature, so it stays bit-identical to the version
 * the catalogue approved at install time.
 */
async function reinstateFallback(
  d: IDBPDatabase<InstalledAppSchema>,
  app: CatalogueApp,
  row: InstalledAppSchema['installed']['value'],
): Promise<void> {
  try {
    await d.put('installed', row, key(app.appId, row.version, row.sha256));
  } catch { /* IDB write failure is non-fatal — we still return the bytes. */ }
}

export async function listInstalled(): Promise<string[]> {
  const d = await db();
  return d.getAllKeys('installed') as Promise<string[]>;
}

export async function evictApp(appId: string, version?: string): Promise<void> {
  const d = await db();
  const keys = (await d.getAllKeys('installed')) as string[];
  const prefix = version ? `${appId}@${version}@` : `${appId}@`;
  for (const k of keys) {
    if (k.startsWith(prefix)) await d.delete('installed', k);
  }
}
