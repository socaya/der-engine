import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { CatalogueApp } from './catalogue';
import * as signatures from './signatures';

const DB_NAME = 'der-apps';
const DB_VERSION = 1;

interface InstalledAppSchema extends DBSchema {
  installed: {
    key: string;              // `${appId}@${version}`
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

function key(appId: string, version: string): string {
  return `${appId}@${version}`;
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
  const cached = await d.get('installed', key(app.appId, app.version));
  if (cached) return cached.bundleText;

  const r = await fetch(app.bundleUrl, { credentials: 'include' });
  if (!r.ok) throw err('FETCH_FAILED', `bundle fetch failed (${r.status})`);
  const bundleBytes = new Uint8Array(await r.arrayBuffer());

  const sha = await signatures.sha256Hex(bundleBytes);
  if (sha !== app.bundleSha256) {
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
    }, key(app.appId, app.version));
  } catch (e) {
    throw err('IDB_FAILED', (e as Error).message);
  }
  return bundleText;
}

export async function listInstalled(): Promise<string[]> {
  const d = await db();
  return d.getAllKeys('installed') as Promise<string[]>;
}

export async function evictApp(appId: string, version: string): Promise<void> {
  const d = await db();
  await d.delete('installed', key(appId, version));
}
