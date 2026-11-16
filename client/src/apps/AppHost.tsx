import { useEffect, useState, type ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { useAppCatalogue, type CatalogueApp } from './catalogue';
import { ensureInstalled, type InstallError } from './installer';

type Status =
  | { kind: 'loading' }
  | { kind: 'unknown-app' }
  | { kind: 'install-error'; code: InstallError['code']; message: string }
  | { kind: 'import-error'; message: string }
  | { kind: 'ready'; Mod: ComponentType }
  /** DHIS2 custom apps (ADR-0005) are standard DHIS2 bundles that
   *  can't be imported as ES modules. They're served at
   *  /dhis-web-<appKey>/ and must be mounted inside an iframe so
   *  they load their own HTML entry. Rendering inside the DER
   *  shell keeps nav, sign-in and session chrome consistent. */
  | { kind: 'iframe'; src: string };

/**
 * ADR-0037 C-UI-5b — host that runs a DER-dispatched app.
 *
 * Route: `/apps/:appKey`.
 *
 * Flow on mount:
 *   1. Pull the catalogue (same hook used by the launcher) and find
 *      the entry matching `:appKey`.
 *   2. Call `ensureInstalled` — fetch + verify sha256 + verify
 *      Ed25519 signature + cache in IndexedDB. Idempotent.
 *   3. Wrap the bundle text in a Blob + `import()` the Blob URL.
 *      The ESM bundle must `export default` a React component.
 *   4. Render the component inside the shell's content slot.
 *
 * On any failure (unknown app, fetch error, signature mismatch,
 * import error) a status card explains what happened; nothing is
 * mounted.
 */
export function AppHost(): JSX.Element {
  const { appKey = '' } = useParams();
  const { apps } = useAppCatalogue(true);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    const entry = apps.find((a) => a.appKey === appKey);
    if (apps.length === 0) {
      // Catalogue still loading — keep showing the spinner.
      return;
    }
    if (!entry) {
      setStatus({ kind: 'unknown-app' });
      return;
    }
    // DHIS2 custom apps (ADR-0005) can't be ESM-imported — they're
    // standalone bundles with their own HTML entry served at
    // /dhis-web-<key>/. Mount them in an iframe inside the DER
    // shell so launcher → in-shell render stays uniform across
    // DER_ESM and DHIS2 apps.
    if (entry.hostKind === 'DHIS2_IFRAME') {
      const src = entry.launchUrl ?? `/dhis-web-${entry.appKey}/`;
      setStatus({ kind: 'iframe', src });
      return;
    }
    let revoked = false;
    let url: string | null = null;
    (async () => {
      let bundleText: string;
      try {
        bundleText = await ensureInstalled(entry);
      } catch (e) {
        const err = e as InstallError;
        setStatus({ kind: 'install-error',
          code: err.code ?? ('FETCH_FAILED' as InstallError['code']),
          message: err.message });
        return;
      }
      /* v8 ignore start — Blob-URL dynamic ESM import can't be
       * executed in jsdom; this path is covered by the C-UI-5b live
       * smoke flow. The install-error branches above are unit-tested. */
      try {
        const blob = new Blob([bundleText], { type: 'application/javascript' });
        url = URL.createObjectURL(blob);
        const mod = await import(/* @vite-ignore */ url) as {
          default?: ComponentType;
        };
        if (!mod.default) {
          setStatus({ kind: 'import-error',
            message: 'bundle has no default export' });
          return;
        }
        if (!revoked) setStatus({ kind: 'ready', Mod: mod.default });
      } catch (e) {
        setStatus({ kind: 'import-error', message: (e as Error).message });
      }
      /* v8 ignore stop */
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [appKey, apps]);

  if (status.kind === 'loading') {
    return <div className="der-apphost der-apphost--loading"
                data-test="der-apphost-loading">Loading {appKey}…</div>;
  }
  if (status.kind === 'unknown-app') {
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-apphost-unknown">
        <h2>Unknown app</h2>
        <p>No installed app matches <code>{appKey}</code>. Ask your
          administrator to install it from the admin console.</p>
      </div>
    );
  }
  if (status.kind === 'install-error') {
    const friendly = friendlyInstallError(status.code);
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-apphost-install-error"
           data-error-code={status.code}>
        <h2>{friendly.title}</h2>
        <p>{friendly.body}</p>
      </div>
    );
  }
  if (status.kind === 'import-error') {
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-apphost-import-error">
        <h2>App bundle failed to load</h2>
        <p>{status.message}</p>
      </div>
    );
  }
  if (status.kind === 'iframe') {
    return (
      <div className="der-apphost der-apphost--iframe"
           data-test="der-apphost-iframe"
           style={{ width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column' }}>
        <iframe src={status.src}
                title={`DHIS2 app: ${appKey}`}
                data-test={`der-apphost-iframe-${appKey}`}
                style={{ flex: 1, width: '100%',
                         height: '100%', border: 0,
                         minHeight: 'calc(100vh - 60px)' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                allow="clipboard-read; clipboard-write" />
      </div>
    );
  }
  const Mod = status.Mod;
  return (
    <div className="der-apphost" data-test="der-apphost-ready">
      <Mod />
    </div>
  );
}

/** Test seam — surfaces the catalogue entry match logic. */
export function findAppByKey(
  apps: readonly CatalogueApp[], appKey: string,
): CatalogueApp | null {
  return apps.find((a) => a.appKey === appKey) ?? null;
}

/** Production-ready copy for installer error codes. The raw code is
 *  still exposed via data-error-code for operator diagnostics. */
export function friendlyInstallError(
  code: string | undefined,
): { readonly title: string; readonly body: string } {
  switch (code) {
    case 'DEVICE_NOT_APPROVED':
      return {
        title: 'This device is not approved',
        body:
          'Client apps can only run on devices an administrator has approved. '
          + 'Ask an admin to open the Devices screen and approve this device.',
      };
    case 'SIGNATURE_INVALID':
    case 'SHA256_MISMATCH':
      return {
        title: 'App could not be verified',
        body:
          'The server returned a bundle that failed its signature or '
          + 'checksum check. This device will not run it. Contact support.',
      };
    case 'SIGNING_KEY_UNAVAILABLE':
      return {
        title: 'App signing key unavailable',
        body:
          'This device cannot verify the app bundle because the server '
          + 'signing key is unreachable. Try again once connectivity is '
          + 'restored.',
      };
    case 'IDB_FAILED':
      return {
        title: 'Could not open local app cache',
        body:
          'This browser session is unable to read or write the local app '
          + 'cache. Try reloading the page or clearing site storage.',
      };
    case 'FETCH_FAILED':
    default:
      return {
        title: 'App could not be loaded',
        body:
          'The server did not return the app bundle. Check your connection '
          + 'and try again, or ask an administrator to check the server.',
      };
  }
}
