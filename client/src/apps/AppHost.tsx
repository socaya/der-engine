import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  | { kind: 'iframe'; src: string }
  /** The embedded DHIS2 app threw and DER swapped the iframe out
   *  for a branded error card. Carries the collected details so
   *  an operator can copy them for the ops channel. */
  | { kind: 'iframe-crashed';
      appKey: string;
      appName: string;
      src: string;
      message: string;
      stack: string | null;
      capturedAt: string; };

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
  if (status.kind === 'iframe-crashed') {
    return <IframeCrashCard status={status}
                             onReload={() => setStatus({ kind: 'iframe',
                                                         src: status.src })} />;
  }
  if (status.kind === 'iframe') {
    // DHIS2 apps render their own @dhis2/ui HeaderBar on mount
    // (apps-menu icon, logout, profile, etc.). When embedded inside
    // DER's shell that gives the operator two stacked chromes —
    // DER's header on top, DHIS2's below. Inject a stylesheet into
    // the iframe on first load that hides the DHIS2 header (and
    // its drawer backdrop), so only DER's navigation is visible.
    // Same-origin iframe → contentDocument is reachable without
    // CORS gymnastics. Idempotent: re-injection is a no-op because
    // the <style> id is checked first.
    const appName = apps.find((a) => a.appKey === appKey)?.displayName ?? appKey;
    const trapCrash = (message: string, stack: string | null): void => {
      // Snapshot once — subsequent errors during unmount add noise
      // without changing the operator's next step. React-StrictMode
      // double-invoke on dev doesn't break this either because the
      // state transition is idempotent for the same error payload.
      setStatus((prev) => prev.kind === 'iframe' ? {
        kind: 'iframe-crashed',
        appKey, appName,
        src: prev.src,
        message, stack,
        capturedAt: new Date().toISOString(),
      } : prev);
    };
    const onIframeLoad = (ev: React.SyntheticEvent<HTMLIFrameElement>): void => {
      const doc = ev.currentTarget.contentDocument;
      const win = ev.currentTarget.contentWindow;
      if (!doc) return;
      // Attach crash listeners on first paint. `error` catches
      // synchronous throws (React render errors bubble up here via
      // reportError); `unhandledrejection` catches the async
      // sync-machine failures we just saw in eregisters (xstate's
      // onError is propagated as an unhandled rejection when there's
      // no handler).
      if (win && !(win as unknown as { __derCrashHandled?: boolean })
              .__derCrashHandled) {
        (win as unknown as { __derCrashHandled: boolean })
            .__derCrashHandled = true;
        win.addEventListener('error', (e) => {
          trapCrash(e.message || 'Unknown error',
                  e.error instanceof Error ? e.error.stack ?? null : null);
        });
        win.addEventListener('unhandledrejection', (e) => {
          // d2 app-runtime throws Response-like objects as rejection
          // reasons for failed fetches — `e.reason` is a Response or
          // plain object with {status, url, message, body, ...}, not
          // an Error. Previously we fell to the generic "Unhandled
          // rejection" + null stack on these; now we serialise the
          // reason so operators and support get something actionable.
          const reason = e.reason;
          let msg: string;
          let stack: string | null;
          if (reason instanceof Error) {
            msg = reason.message;
            stack = reason.stack ?? null;
          } else if (typeof reason === 'string') {
            msg = reason;
            stack = null;
          } else if (reason && typeof reason === 'object') {
            // Prefer `.message` / `.statusText` / `.url` fields when
            // present — matches d2's RestAPILink error shape.
            const r = reason as Record<string, unknown>;
            const message = typeof r.message === 'string' ? r.message
                    : typeof r.statusText === 'string' ? r.statusText
                    : null;
            const status = typeof r.status === 'number' ? r.status : null;
            const url = typeof r.url === 'string' ? r.url : null;
            msg = message
                    ?? (status != null && url != null
                            ? `HTTP ${status} on ${url}` : null)
                    ?? safeJson(reason);
            stack = typeof r.stack === 'string' ? r.stack : null;
          } else {
            msg = 'Unhandled rejection';
            stack = null;
          }
          trapCrash(msg, stack);
        });
      }
      if (doc.getElementById('der-hide-dhis2-header')) return;
      const style = doc.createElement('style');
      style.id = 'der-hide-dhis2-header';
      // Targets every known DHIS2-shell header mount. The leading
      // comment is intentional — makes the rule trivially
      // discoverable in DevTools when an operator asks why.
      // DHIS2 2.4x's @dhis2/ui HeaderBar renders as:
      //   <header class="jsx-<hash>">
      //     <div class="main">
      //       [data-test="headerbar-logo" | "headerbar-title" | …]
      //     </div>
      //   </header>
      // The outer <header> gets a styled-jsx class with a build-
      // specific hash (no stable `.headerbar` class), so we target
      // the header by its descendant data-test hooks via :has().
      // All evergreen browsers support :has() since late 2023;
      // Chromium / Firefox / Safari are green for the appliance's
      // pinned client baseline.
      style.textContent = `/* DER: hide DHIS2 HeaderBar inside embedded apps */
        header:has([data-test^="headerbar-"]),
        header.headerbar, .headerbar,
        [data-test="headerbar"],
        [data-test^="headerbar-"],
        div[class*="HeaderBar_"],
        div[class*="headerBar"] {
          display: none !important;
        }
        /* Reclaim the vertical space DHIS2 reserved for its header. */
        body { padding-top: 0 !important; margin-top: 0 !important; }
        #app-shell-content, #app, #root {
          padding-top: 0 !important; margin-top: 0 !important; top: 0 !important;
        }`;
      doc.head.appendChild(style);
    };

    return (
      <div className="der-apphost der-apphost--iframe"
           data-test="der-apphost-iframe"
           style={{ width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column' }}>
        <iframe src={status.src}
                title={`DHIS2 app: ${appKey}`}
                data-test={`der-apphost-iframe-${appKey}`}
                onLoad={onIframeLoad}
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

/**
 * DER error envelope rendered in place of the DHIS2 iframe when the
 * embedded app has thrown a top-level error (sync.ts crash, React
 * boundary, unhandled promise rejection). Operators can't confuse
 * "eregisters bug" with "DER bug" — the card is DER-branded and
 * exposes the raw payload only via "Copy details" for ops escalation.
 */
function IframeCrashCard({ status, onReload }: {
  status: Extract<Status, { kind: 'iframe-crashed' }>;
  onReload: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const details = JSON.stringify({
    app: status.appKey,
    appName: status.appName,
    capturedAt: status.capturedAt,
    message: status.message,
    stack: status.stack,
  }, null, 2);
  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write can fail on some sandboxed contexts; the
      // details stay visible below so the operator can still grab
      // them manually.
    }
  };
  return (
    <div className="der-apphost der-apphost--app-crashed"
         data-test="der-apphost-iframe-crashed"
         data-app-key={status.appKey}
         style={{ padding: '2rem', maxWidth: 720, margin: '2rem auto' }}>
      <h2 style={{ marginTop: 0 }}>
        {status.appName} is not responding
      </h2>
      <p>
        The app crashed while loading. Nothing on DER itself is
        affected — other apps and your appliance remain available.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
        <button type="button" onClick={onCopy}
                data-test="der-apphost-iframe-crashed-copy">
          {copied ? 'Copied' : 'Copy details'}
        </button>
        <button type="button" onClick={onReload}
                data-test="der-apphost-iframe-crashed-reload">
          Reload app
        </button>
        <button type="button" onClick={() => navigate('/apps')}
                data-test="der-apphost-iframe-crashed-back">
          Back to launcher
        </button>
      </div>
      <details>
        <summary>Error details (for support)</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem',
                       overflow: 'auto', maxHeight: 240,
                       background: '#f4f5f7', padding: '0.5rem' }}>
          {details}
        </pre>
      </details>
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

/**
 * Serialise an arbitrary rejection reason to a short, operator-
 * readable string. Keeps the first 240 chars so a huge object
 * payload doesn't blow up the crash card. Falls back to
 * {@code [unserialisable: <typeof>]} when the value can't be
 * stringified (circular refs, DOM nodes, …).
 */
function safeJson(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s && s !== '{}' ? s.slice(0, 240)
            : `[non-Error rejection: ${typeof value}]`;
  } catch {
    return `[unserialisable: ${typeof value}]`;
  }
}
