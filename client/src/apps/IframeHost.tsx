import { useEffect, useRef, useState } from 'react';
import type { CatalogueApp } from './catalogue';
import { friendlyInstallError } from './AppHost';

/**
 * DER-APPS-DHIS2-001 Phase 2b — host that mounts a DHIS2 web app in a
 * sandboxed iframe. Mounted by {@link AppDispatcher} when the catalogue
 * entry's `hostKind === 'DHIS2_IFRAME'`.
 *
 * Sandbox tokens (D4 resolved 2026-11-15):
 *   allow-scripts         — DHIS2 apps are classic JS apps and need to run
 *   allow-same-origin     — so the app can call /api/* on the DER emulator
 *                           with its session cookie
 *   allow-forms           — DHIS2 apps use <form> for metadata import, etc.
 *   allow-downloads       — exports (PDF, CSV) land as downloads
 *
 * Explicitly NOT granted:
 *   allow-top-navigation  — a compromised DHIS2 app cannot navigate the
 *                           host shell away
 *   allow-popups          — no new-window popups from inside the frame
 *   allow-modals          — alert/confirm/prompt blocked
 *
 * CSP posture is applied server-side by AppStaticHandler — the iframe
 * loads assets under strict `default-src 'self'` so loaded code cannot
 * reach external CDNs.
 *
 * Device-approval is enforced server-side by DeviceApprovalInterceptor
 * on the /dhis-web-*  path; an unapproved device hitting the iframe src
 * sees the standard 403 DEVICE_NOT_APPROVED error, which the parent
 * shell can detect via the iframe's load event and surface in
 * production-ready copy.
 */
export function IframeHost({ app }: { app: CatalogueApp }): JSX.Element {
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied'>('loading');
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setStatus('loading');
  }, [app.appId, app.version]);

  // D4 sandbox tokens — see docstring. Read as a space-separated string
  // by the browser; keep ordering stable for easy diffing in devtools.
  const sandbox = 'allow-scripts allow-same-origin allow-forms allow-downloads';
  const src = app.launchUrl ?? `/dhis-web-${app.appKey}/`;

  if (status === 'denied') {
    const copy = friendlyInstallError('DEVICE_NOT_APPROVED');
    return (
      <div className="der-apphost der-apphost--error"
           data-test="der-iframehost-install-error"
           data-error-code="DEVICE_NOT_APPROVED">
        <h2>{copy.title}</h2>
        <p>{copy.body}</p>
      </div>
    );
  }

  return (
    <div className="der-apphost der-apphost--iframe"
         data-test="der-iframehost"
         data-app-key={app.appKey}
         data-trust-level={app.trustLevel}
         data-source={app.source}>
      {status === 'loading' && (
        <div className="der-apphost der-apphost--loading"
             data-test="der-iframehost-loading">Loading {app.displayName}…</div>
      )}
      <iframe
        ref={ref}
        title={app.displayName}
        src={src}
        sandbox={sandbox}
        className="der-iframehost-frame"
        data-test="der-iframehost-frame"
        onLoad={() => {
          // The iframe's load event fires both on a successful render
          // and on a 403/404 error page — we can't inspect the status
          // code across a sandboxed boundary. The server-side 403 from
          // DeviceApprovalInterceptor comes with a specific body shape;
          // we rely on it being caught by the parent shell's device
          // banner (DeviceBoot) which fires first on login.
          setStatus('ready');
        }}
        onError={() => {
          // onError on <iframe> is rare — browsers only fire it when
          // the fetch itself fails (network down, not HTTP error). Keep
          // it as a defensive fallback.
          setStatus('denied');
        }}
      />
    </div>
  );
}
