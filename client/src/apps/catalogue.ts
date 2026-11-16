import { useEffect, useState } from 'react';

/** DER-APPS-DHIS2-001 FR-APP-001 — which host mounts this app. */
export type HostKind = 'DER_ESM' | 'DHIS2_IFRAME';

/** Provenance (D1). */
export type AppSource = 'DER_BUILTIN' | 'MANUAL_UPLOAD' | 'CENTRAL_SYNC';

/** Signing posture (D2). */
export type TrustLevel = 'SIGNED' | 'UNSIGNED';

/** Phase 5d — how the client should actually mount a DHIS2_IFRAME app.
 *  Default is `'DEEPLINK'` (open /dhis-web-<key>/ in a new tab, which
 *  matches the Phase 03 pattern for DHIS2-adjacent apps); `'IFRAME'`
 *  keeps the Phase 2b in-shell sandbox mount for admins who want it. */
export type LaunchMode = 'DEEPLINK' | 'IFRAME';

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
  /** Phase 2 hybrid dispatcher — picks which client-side host mounts
   *  the app. Defaults to DER_ESM when the server response lacks the
   *  field (for forward-compat with pre-Phase-2a servers). */
  readonly hostKind: HostKind;
  /** Where the app bundle came from. */
  readonly source: AppSource;
  /** Whether the server verified an Ed25519 signature on this bundle. */
  readonly trustLevel: TrustLevel;
  /** DHIS2_IFRAME only — the URL the iframe loads as its src. Null for
   *  DER_ESM apps, which use `bundleUrl` via dynamic import. */
  readonly launchUrl: string | null;
  /** DHIS2_IFRAME only — `'DEEPLINK'` (new-tab default) or `'IFRAME'`
   *  (in-shell sandbox). Null for DER_ESM apps. */
  readonly launchMode: LaunchMode | null;
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
      hostKind: parseHostKind(o.hostKind),
      source: parseSource(o.source),
      trustLevel: parseTrustLevel(o.trustLevel),
      launchUrl: typeof o.launchUrl === 'string' ? o.launchUrl : null,
      launchMode: parseLaunchMode(o.hostKind, o.launchMode),
    }];
  });
}

function parseLaunchMode(hostKind: unknown, raw: unknown): LaunchMode | null {
  if (hostKind !== 'DHIS2_IFRAME') return null;
  return raw === 'IFRAME' ? 'IFRAME' : 'DEEPLINK';
}

function parseHostKind(raw: unknown): HostKind {
  return raw === 'DHIS2_IFRAME' ? 'DHIS2_IFRAME' : 'DER_ESM';
}
function parseSource(raw: unknown): AppSource {
  if (raw === 'DER_BUILTIN' || raw === 'CENTRAL_SYNC') return raw;
  return 'MANUAL_UPLOAD';
}
function parseTrustLevel(raw: unknown): TrustLevel {
  return raw === 'UNSIGNED' ? 'UNSIGNED' : 'SIGNED';
}

/**
 * Fetch the full launcher catalogue — unions the ADR-0037 signed
 * bundle catalogue (`/edge-api/v1/apps`) with the ADR-0005 DHIS2
 * custom apps (`/edge-api/v1/apps/installed`). Without the merge,
 * DHIS2 apps installed by an admin on the server are invisible to
 * the device launcher; operators see the app under /admin/apps
 * but can't open it from the client. Kept outside the hook so the
 * bundle installer can revalidate metadata after an administrator
 * replaces an app without changing its version.
 */
export async function fetchAppCatalogue(): Promise<CatalogueApp[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const device = readDeviceHeader();
  if (device) headers['X-DER-Device-Id'] = device;
  const init: RequestInit = {
    credentials: 'include', cache: 'no-store', headers,
  };
  const [signedRaw, dhis2Raw] = await Promise.all([
    fetchJson('/edge-api/v1/apps', init),
    fetchJson('/edge-api/v1/apps/installed', init),
  ]);
  const signed = sanitize(signedRaw);
  const dhis2 = sanitizeDhis2(dhis2Raw);
  // Dedupe on appKey — the signed catalogue is authoritative when
  // both lists carry the same key (a DER-built app installed both
  // via the signed path and the legacy ADR-0005 path).
  const seen = new Set<string>(signed.map((a) => a.appKey));
  const merged = [...signed, ...dhis2.filter((a) => !seen.has(a.appKey))];
  return merged;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  try {
    const r = await fetch(url, init);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Normalise a `/edge-api/v1/apps/installed` row (DHIS2 custom app,
 * ADR-0005) into the launcher's {@link CatalogueApp} shape. These
 * apps are always `DHIS2_IFRAME` + `DEEPLINK` since they serve raw
 * HTML out of `/dhis-web-<appKey>/`.
 */
function sanitizeDhis2(raw: unknown): CatalogueApp[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): CatalogueApp[] => {
    if (!r || typeof r !== 'object') return [];
    const o = r as Record<string, unknown>;
    if (typeof o.appId !== 'string'
      || typeof o.appKey !== 'string'
      || typeof o.version !== 'string') {
      return [];
    }
    const displayName = typeof o.displayName === 'string'
      ? o.displayName : o.appKey;
    const deepLink = `/dhis-web-${o.appKey}/`;
    return [{
      appId: o.appId,
      appKey: o.appKey,
      displayName,
      module: null,
      version: o.version,
      bundleUrl: deepLink,
      bundleSha256: '',
      signatureB64: '',
      requiresDerApi: '',
      iconUrl: null,
      hostKind: 'DHIS2_IFRAME',
      source: 'MANUAL_UPLOAD',
      trustLevel: 'UNSIGNED',
      launchUrl: deepLink,
      launchMode: 'DEEPLINK',
    }];
  });
}

function readDeviceHeader(): string | null {
  try {
    return window.localStorage.getItem('der_device_id');
  } catch {
    return null;
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
