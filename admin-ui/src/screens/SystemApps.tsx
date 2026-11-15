import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { Panel, fmtAgo, SyncStatusBar } from './shared';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * DER-APPS-DHIS2-001 FR-DIAG-001 — admin diagnostic listing of every
 * installed app with Phase 2a provenance (hostKind, source, trustLevel)
 * and the last_opened_at telemetry so operators can see which apps are
 * actually in use and how each one got onto the appliance.
 *
 * Route: /system/apps. Admin only (server enforces via the ADMIN role
 * check in the catalogue controller's adminList endpoint).
 */
export function SystemApps(): JSX.Element {
  const [rows, setRows] = useState<edgeApi.AdminAppRow[] | null>(null);
  const [misses, setMisses] = useState<edgeApi.EmulatorMissRow[] | null>(null);
  const [missErr, setMissErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    edgeApi.listAdminApps()
      .then((r) => setRows(r.apps))
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : String(e)));
    edgeApi.listEmulatorMisses()
      .then((r) => setMisses(r.misses))
      .catch((e: unknown) =>
        setMissErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) {
    return (
      <ErrorBlock title="Could not load installed apps"
                   testId="err-system-apps">{err}</ErrorBlock>
    );
  }
  if (!rows) return <LoadingBlock testId="system-apps-loading" />;

  const enabled = rows.filter((r) => r.enabled).length;
  const dhis2 = rows.filter((r) => r.hostKind === 'DHIS2_IFRAME').length;
  const unsigned = rows.filter((r) => r.trustLevel === 'UNSIGNED').length;
  const centralSynced = rows.filter((r) => r.source === 'CENTRAL_SYNC').length;

  return (
    <div className="ea-screen" data-test="system-apps">
      <SyncStatusBar
        tone={unsigned > 0 ? 'warning' : 'success'}
        title="Installed apps"
        statusLabel={unsigned > 0
          ? `${unsigned} unsigned`
          : 'All signed'}
        subtitle={
          <>
            <span><strong>{rows.length}</strong> installed</span>
            <span>·</span>
            <span><strong>{enabled}</strong> enabled</span>
            <span>·</span>
            <span><strong>{dhis2}</strong> DHIS2 iframe</span>
            <span>·</span>
            <span><strong>{centralSynced}</strong> from central</span>
          </>
        }
      />

      <Panel title="Catalogue"
             action={
               <span className="ea-text-muted ea-text-xs"
                     data-test="system-apps-count">
                 {rows.length === 0
                   ? 'No apps installed'
                   : `${rows.length} app${rows.length === 1 ? '' : 's'}`}
               </span>
             }>
        {rows.length === 0 ? (
          <p className="ea-text-muted"
             data-test="system-apps-empty">
            No apps installed on this appliance.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="system-apps-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th className="ea-col-w-110">Host</th>
                  <th className="ea-col-w-110">Source</th>
                  <th className="ea-col-w-90">Trust</th>
                  <th className="ea-col-w-100">Status</th>
                  <th className="ea-col-w-140">Installed</th>
                  <th className="ea-col-w-120">Last opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.appId}
                      data-test={`system-apps-row-${r.appKey}`}>
                    <td>
                      <div className="ea-fw-medium">{r.displayName}</div>
                      <div className="ea-text-muted ea-mono ea-text-2xs">
                        {r.appKey} · v{r.version}
                      </div>
                    </td>
                    <td>
                      <code className="ea-text-xs">
                        {r.hostKind === 'DHIS2_IFRAME'
                          ? 'DHIS2 iframe'
                          : 'DER native'}
                      </code>
                    </td>
                    <td>
                      <span className="ea-text-xs">
                        {sourceLabel(r.source)}
                      </span>
                    </td>
                    <td>
                      <span className={r.trustLevel === 'UNSIGNED'
                        ? 'ea-text-xs ea-text-muted'
                        : 'ea-text-xs'}
                            data-test={`system-apps-trust-${r.appKey}`}>
                        {r.trustLevel === 'SIGNED' ? 'Signed' : 'Unsigned'}
                      </span>
                    </td>
                    <td>
                      <span className={r.enabled
                        ? 'ea-text-xs'
                        : 'ea-text-xs ea-text-muted'}>
                        {r.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="ea-text-muted ea-text-xs"
                        title={r.installedAt}>
                      {fmtAgo(r.installedAt)}
                    </td>
                    <td className="ea-text-muted ea-text-xs"
                        title={r.lastOpenedAt ?? undefined}>
                      {r.lastOpenedAt ? fmtAgo(r.lastOpenedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Unmirrored endpoints"
             action={
               <span className="ea-text-muted ea-text-xs"
                     data-test="system-apps-misses-count">
                 {misses === null
                   ? '…'
                   : misses.length === 0
                     ? 'No misses recorded'
                     : `${misses.length} endpoint${misses.length === 1 ? '' : 's'}`}
               </span>
             }>
        {missErr !== null ? (
          <p className="ea-text-muted"
             data-test="system-apps-misses-error">
            Could not load miss log: {missErr}
          </p>
        ) : misses === null ? (
          <p className="ea-text-muted"
             data-test="system-apps-misses-loading">Loading…</p>
        ) : misses.length === 0 ? (
          <p className="ea-text-muted"
             data-test="system-apps-misses-empty">
            Apps have not asked for any unmirrored endpoints.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="system-apps-misses-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th className="ea-col-w-110">App</th>
                  <th className="ea-col-w-80">Hits</th>
                  <th className="ea-col-w-120">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {misses.map((m) => (
                  <tr key={`${m.endpoint}|${m.appOrigin}`}
                      data-test={`system-apps-miss-row-${m.endpoint}`}>
                    <td>
                      <code className="ea-text-xs">{m.endpoint}</code>
                    </td>
                    <td className="ea-text-xs">
                      {m.appOrigin === '' ? '—' : m.appOrigin}
                    </td>
                    <td className="ea-text-xs">{m.hitCount}</td>
                    <td className="ea-text-muted ea-text-xs"
                        title={m.lastAt}>
                      {fmtAgo(m.lastAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function sourceLabel(s: edgeApi.AdminAppRow['source']): string {
  switch (s) {
    case 'DER_BUILTIN':    return 'DER built-in';
    case 'MANUAL_UPLOAD':  return 'Manual upload';
    case 'CENTRAL_SYNC':   return 'Central sync';
    default:               return s;
  }
}
