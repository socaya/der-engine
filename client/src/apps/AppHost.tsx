import { useEffect, useState, type ComponentType } from 'react';
import { useParams } from 'react-router-dom';
import { useAppCatalogue, type CatalogueApp } from './catalogue';
import { ensureInstalled, type InstallError } from './installer';

type Status =
  | { kind: 'loading' }
  | { kind: 'unknown-app' }
  | { kind: 'install-error'; code: InstallError['code']; message: string }
  | { kind: 'import-error'; message: string }
  | { kind: 'ready'; Mod: ComponentType };

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
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-apphost-install-error">
        <h2>Could not load {appKey}</h2>
        <p><code>{status.code}</code>: {status.message}</p>
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
