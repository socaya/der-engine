import { useEffect, useState } from 'react';

export interface CatalogueApp {
  readonly appId: string;
  readonly appKey: string;
  readonly displayName: string;
  readonly module: string | null;
  readonly version: string;
  readonly bundleUrl: string;
  readonly bundleSha256: string;
  readonly signatureB64: string;
  readonly requiresDerApi: string;
  /** From C-UI-5c zip packaging: `/edge-api/v1/apps/<id>/<v>/icon`
   *  when the app shipped an icon in its manifest, else `null`. */
  readonly iconUrl: string | null;
}

export interface CatalogueResult {
  readonly apps: readonly CatalogueApp[];
  readonly loading: boolean;
}

function sanitize(raw: unknown): CatalogueApp[] {
  if (raw == null || typeof raw !== 'object') return [];
  const list = (raw as { apps?: unknown }).apps;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r): CatalogueApp[] => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Record<string, unknown>;
    if (typeof o.appId !== 'string'
      || typeof o.appKey !== 'string'
      || typeof o.displayName !== 'string'
      || typeof o.version !== 'string'
      || typeof o.bundleUrl !== 'string'
      || typeof o.bundleSha256 !== 'string'
      || typeof o.signatureB64 !== 'string'
      || typeof o.requiresDerApi !== 'string'
    ) {
      return [];
    }
    return [{
      appId: o.appId, appKey: o.appKey, displayName: o.displayName,
      module: typeof o.module === 'string' ? o.module : null,
      version: o.version, bundleUrl: o.bundleUrl,
      bundleSha256: o.bundleSha256, signatureB64: o.signatureB64,
      requiresDerApi: o.requiresDerApi,
      iconUrl: typeof o.iconUrl === 'string' ? o.iconUrl : null,
    }];
  });
}

/**
 * Fetch the current server catalogue without consulting an HTTP cache.
 * Kept outside the hook so the bundle installer can revalidate metadata
 * after an administrator replaces an app without changing its version.
 */
export async function fetchAppCatalogue(): Promise<CatalogueApp[]> {
  try {
    const r = await fetch('/edge-api/v1/apps', {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    return sanitize(await r.json() as unknown);
  } catch {
    return [];
  }
}

/**
 * Fetches the DER app catalogue from
 * `/edge-api/v1/apps` once per `enabled` transition from false→true.
 * Returns an empty list while loading and on any error — the
 * launcher stays usable when no apps are installed or the server
 * isn't reachable. C-UI-5a only reads the catalogue; bundle fetch
 * + install + mount land in C-UI-5b.
 */
export function useAppCatalogue(enabled: boolean): CatalogueResult {
  const [apps, setApps] = useState<readonly CatalogueApp[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    (async (): Promise<void> => {
      try {
        // `cache: 'no-store'` — the catalogue is the client's
        // source of truth for app version + bundleSha256; a stale
        // browser-cached response can sustain a stale IDB bundle
        // for hours even after the operator uploaded a new build.
        const current = await fetchAppCatalogue();
        if (!cancelled) setApps(current);
      } catch {
        // offline / server down — stay empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);
  return { apps, loading };
}
