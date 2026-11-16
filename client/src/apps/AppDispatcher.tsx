import { useParams } from 'react-router-dom';
import { useAppCatalogue, type CatalogueApp } from './catalogue';
import { AppHost } from './AppHost';
import { IframeHost } from './IframeHost';

/**
 * DER-APPS-DHIS2-001 Phase 2b — the single URL route at
 * {@code /apps/:appKey} picks the right host based on the
 * catalogue entry's `hostKind`:
 *
 *   - DER_ESM        → {@link AppHost} (dynamic import() of the
 *                      signed bundle, shell-wrapped).
 *   - DHIS2_IFRAME   → {@link AppHost} with its iframe branch —
 *                      mounts {@code /dhis-web-<appKey>/} inside
 *                      the DER shell and injects a stylesheet into
 *                      the iframe that hides DHIS2's own HeaderBar
 *                      (so only DER's navigation chrome shows).
 *
 * The earlier Phase 5d "deep-link new tab" variant loaded the DHIS2
 * app directly at {@code /dhis-web-<key>/}, which stripped DER
 * chrome out of the launch tab. Operators reported losing access
 * to DER navigation (sign-out, device state, OU scope) once a
 * DHIS2 app was open, so the default is now the in-shell mount.
 * Admins who still need a direct-tab launch can set
 * {@code launchMode === 'IFRAME'} to force {@link IframeHost} —
 * the stricter sandbox mount — for a specific entry.
 */
export function AppDispatcher(): JSX.Element {
  const { appKey = '' } = useParams();
  const { apps, loading } = useAppCatalogue(true);

  const entry: CatalogueApp | undefined = apps.find((a) => a.appKey === appKey);

  if (apps.length === 0 && loading) {
    return (
      <div className="der-apphost der-apphost--loading"
           data-test="der-dispatcher-loading">Loading catalogue…</div>
    );
  }

  if (!entry) {
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-dispatcher-unknown">
        <h2>Unknown app</h2>
        <p>No installed app matches <code>{appKey}</code>. Ask your
          administrator to install it from the admin console.</p>
      </div>
    );
  }

  if (entry.hostKind === 'DHIS2_IFRAME' && entry.launchMode === 'IFRAME') {
    return <IframeHost app={entry} />;
  }

  // Default — DER_ESM and DHIS2_IFRAME both render through AppHost.
  // AppHost reads useParams itself and picks ESM-vs-iframe based on
  // the catalogue entry's hostKind.
  return <AppHost />;
}
