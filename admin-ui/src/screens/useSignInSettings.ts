import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';

const EMPTY: edgeApi.SignInSettings = {
  layout: null, appTitle: null, appIntro: null, submitLabel: null,
  footerHtml: null, hasBackground: false, backgroundUrl: null,
  backgroundEtag: null,
};

/**
 * Admin-ui copy of the device-client hook (per the "admin-ui and
 * client are kept independent, duplicated on purpose" rule).
 *
 * Fetches `/edge-api/v1/public/signin-settings` once on mount and
 * returns an all-nulls default while loading and on any error — the
 * sign-in screen must stay usable even when the server is down.
 */
export function useSignInSettings(): edgeApi.SignInSettings {
  const [s, setS] = useState<edgeApi.SignInSettings>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const r = await edgeApi.readSignInSettings();
        if (!cancelled) setS(r);
      } catch {
        // offline / server down — keep EMPTY, defaults apply.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return s;
}
