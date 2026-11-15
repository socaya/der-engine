import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppCatalogue, type CatalogueApp } from './catalogue';
import { AppHost } from './AppHost';
import { IframeHost } from './IframeHost';

/**
 * DER-APPS-DHIS2-001 Phase 2b (updated Phase 5d) — the single URL
 * route at {@code /apps/:appKey} picks the right host based on the
 * catalogue entry's `hostKind`:
 *
 *   - DER_ESM        → {@link AppHost} (dynamic import() of the
 *                      signed bundle, shell-wrapped).
 *   - DHIS2_IFRAME   → open {@code /dhis-web-<appKey>/} in a new
 *                      tab (deep-link launch) and send the current
 *                      tab back to the catalogue. Matches the Phase
 *                      03 UI pattern for DHIS2-adjacent apps (see
 *                      project memory `project_phase03_ui.md`).
 *
 * The in-shell {@link IframeHost} is still exported for admins who
 * want to pin a specific DHIS2 app to the iframe mount — the client
 * only takes that path when the catalogue entry sets
 * `launchMode === 'IFRAME'`, otherwise deep-link wins.
 */
export function AppDispatcher(): JSX.Element {
  const { appKey = '' } = useParams();
  const navigate = useNavigate();
  const { apps, loading } = useAppCatalogue(true);
  const dispatched = useRef(false);

  const entry: CatalogueApp | undefined = apps.find((a) => a.appKey === appKey);

  useEffect(() => {
    if (dispatched.current) return;
    if (!entry) return;
    if (entry.hostKind !== 'DHIS2_IFRAME') return;
    if (entry.launchMode === 'IFRAME') return;
    dispatched.current = true;
    // Deep-link: hand the app the whole viewport in a new tab, then
    // kick the current tab back to the catalogue so the operator
    // keeps the DER shell under their hands.
    window.open(`/dhis-web-${encodeURIComponent(appKey)}/`,
      '_blank', 'noopener,noreferrer');
    navigate('/apps', { replace: true });
  }, [entry, appKey, navigate]);

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

  if (entry.hostKind === 'DHIS2_IFRAME') {
    // Transient — the effect above has already fired the new-tab open
    // and is replacing the route. Render a holding message so no
    // broken-looking state shows up mid-navigation.
    return (
      <div className="der-apphost"
           data-test="der-dispatcher-deeplink">
        <p>Opening <strong>{entry.displayName}</strong> in a new tab…</p>
      </div>
    );
  }

  // DER_ESM — default host. AppHost reads useParams itself, so it
  // re-fetches the entry by appKey from the catalogue.
  return <AppHost />;
}
