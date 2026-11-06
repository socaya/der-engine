import { useEffect, useState } from 'react';
import type { SignInLayoutKind } from './resolve';

/** Server-sourced signin settings, matching the public endpoint. */
export interface SignInSettings {
  readonly layout: SignInLayoutKind | null;
  readonly appTitle: string | null;
  readonly appIntro: string | null;
  readonly submitLabel: string | null;
  readonly footerHtml: string | null;
  readonly hasBackground: boolean;
  readonly backgroundUrl: string | null;
  readonly backgroundEtag: string | null;
}

const EMPTY: SignInSettings = {
  layout: null, appTitle: null, appIntro: null, submitLabel: null,
  footerHtml: null, hasBackground: false, backgroundUrl: null,
  backgroundEtag: null,
};

function sanitize(raw: unknown): SignInSettings {
  if (raw == null || typeof raw !== 'object') return EMPTY;
  const r = raw as Record<string, unknown>;
  const layout = typeof r.layout === 'string'
    && ['standard', 'sidebar', 'hero', 'marketing'].includes(r.layout)
    ? (r.layout as SignInLayoutKind) : null;
  return {
    layout,
    appTitle: typeof r.appTitle === 'string' ? r.appTitle : null,
    appIntro: typeof r.appIntro === 'string' ? r.appIntro : null,
    submitLabel: typeof r.submitLabel === 'string' ? r.submitLabel : null,
    footerHtml: typeof r.footerHtml === 'string' ? r.footerHtml : null,
    hasBackground: r.hasBackground === true,
    backgroundUrl: typeof r.backgroundUrl === 'string' ? r.backgroundUrl : null,
    backgroundEtag: typeof r.backgroundEtag === 'string' ? r.backgroundEtag : null,
  };
}

/**
 * Fetches the server-configured signin appearance from
 * `/edge-api/v1/public/signin-settings` once on mount. Returns
 * `EMPTY` while loading and on any error — the signin screen
 * stays usable even if the server is unreachable (which is
 * exactly the moment the user needs to sign in and fix it).
 *
 * This is the "server level" config layer; a device-level
 * override via localStorage still wins where applicable.
 */
export function useSignInSettings(): SignInSettings {
  const [s, setS] = useState<SignInSettings>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const r = await fetch('/edge-api/v1/public/signin-settings', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (!r.ok) return;
        const json: unknown = await r.json();
        if (!cancelled) setS(sanitize(json));
      } catch {
        // offline / server down / parse error — keep EMPTY so defaults apply.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return s;
}
