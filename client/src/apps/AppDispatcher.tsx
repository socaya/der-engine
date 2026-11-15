import { useParams } from 'react-router-dom';
import { useAppCatalogue, type CatalogueApp } from './catalogue';
import { AppHost } from './AppHost';
import { IframeHost } from './IframeHost';

/**
 * DER-APPS-DHIS2-001 Phase 2b — the single URL route at
 * {@code /apps/:appKey} picks the right host based on the catalogue
 * entry's `hostKind`. D8 resolved 2026-11-15 locked in this unified
 * namespace so DHIS2-native URL muscle memory (`/dhis-web-*`) and the
 * shell-wrapped DER path converge on one shape.
 *
 * DER_ESM entries render through {@link AppHost} (dynamic import()
 * of the signed bundle). DHIS2_IFRAME entries render through
 * {@link IframeHost} (sandboxed iframe serving `/dhis-web-<appKey>/`).
 */
export function AppDispatcher(): JSX.Element {
  const { appKey = '' } = useParams();
  const { apps, loading } = useAppCatalogue(true);

  if (apps.length === 0 && loading) {
    return (
      <div className="der-apphost der-apphost--loading"
           data-test="der-dispatcher-loading">Loading catalogue…</div>
    );
  }

  const entry: CatalogueApp | undefined = apps.find((a) => a.appKey === appKey);

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

  if (entry.hostKind === 'DHIS2_IFRAME') {
    return <IframeHost app={entry} />;
  }

  // DER_ESM — default host. AppHost reads useParams itself, so it
  // re-fetches the entry by appKey from the catalogue.
  return <AppHost />;
}
