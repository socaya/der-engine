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
  const [syncStatus, setSyncStatus]
    = useState<{ latest: edgeApi.CentralSyncRun | null } | null>(null);
  const [syncReport, setSyncReport]
    = useState<edgeApi.CentralSyncReport | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);
  const [policy, setPolicy] = useState<edgeApi.CentralSyncPolicy | null>(null);
  const [policyDraft, setPolicyDraft]
    = useState<{
      mode: edgeApi.CentralSyncPolicyMode;
      keysText: string;
      source: edgeApi.CentralSyncSource;
    }>({ mode: 'ALLOW_ALL', keysText: '', source: 'CENTRAL' });
  const [policyErr, setPolicyErr] = useState<string | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);

  const loadSyncStatus = (): void => {
    edgeApi.centralSyncStatus()
      .then((r) => setSyncStatus(r))
      .catch((e: unknown) =>
        setSyncErr(e instanceof Error ? e.message : String(e)));
  };
  const loadPolicy = (): void => {
    edgeApi.getCentralSyncPolicy()
      .then((p) => {
        setPolicy(p);
        setPolicyDraft({
          mode: p.mode,
          keysText: p.keys.join(', '),
          source: p.source ?? 'CENTRAL',
        });
      })
      .catch((e: unknown) =>
        setPolicyErr(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    edgeApi.listAdminApps()
      .then((r) => setRows(r.apps))
      .catch((e: unknown) =>
        setErr(e instanceof Error ? e.message : String(e)));
    edgeApi.listEmulatorMisses()
      .then((r) => setMisses(r.misses))
      .catch((e: unknown) =>
        setMissErr(e instanceof Error ? e.message : String(e)));
    loadSyncStatus();
    loadPolicy();
  }, []);

  const onSavePolicy = async (): Promise<void> => {
    setPolicyBusy(true); setPolicyErr(null);
    try {
      const keys = policyDraft.keysText.split(',')
        .map((s) => s.trim()).filter((s) => s.length > 0);
      const saved = await edgeApi.putCentralSyncPolicy({
        mode: policyDraft.mode, keys, source: policyDraft.source,
      });
      setPolicy(saved);
      setPolicyDraft({
        mode: saved.mode,
        keysText: saved.keys.join(', '),
        source: saved.source ?? 'CENTRAL',
      });
    } catch (e) {
      setPolicyErr(e instanceof Error ? e.message : String(e));
    } finally { setPolicyBusy(false); }
  };
  const policyDirty = policy !== null
    && (policy.mode !== policyDraft.mode
      || policy.keys.join(', ') !== policyDraft.keysText.trim()
      || (policy.source ?? 'CENTRAL') !== policyDraft.source);

  const onRollback = async (row: edgeApi.AdminAppRow): Promise<void> => {
    let versions: edgeApi.AppVersionRow[];
    try {
      const r = await edgeApi.listAppVersions(row.appId);
      versions = r.versions;
    } catch (e) {
      alert(`Could not load versions: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const superseded = versions.filter((v) => !v.active);
    if (superseded.length === 0) {
      alert(`No prior versions retained for ${row.displayName}.`);
      return;
    }
    const choices = superseded
      .map((v) => `${v.version} (superseded ${v.supersededAt})`).join('\n');
    const pick = window.prompt(
      `Rollback "${row.displayName}" to which prior version?\n\n${choices}`,
      superseded[0]!.version);
    if (pick === null || pick.trim() === '') return;
    try {
      await edgeApi.rollbackApp(row.appId, pick.trim());
      const r = await edgeApi.listAdminApps();
      setRows(r.apps);
    } catch (e) {
      alert(`Rollback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onPreview = async (): Promise<void> => {
    setSyncBusy(true); setSyncErr(null);
    try {
      setSyncReport(await edgeApi.centralSyncPreview());
      loadSyncStatus();
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : String(e));
    } finally { setSyncBusy(false); }
  };
  const onRunNow = async (): Promise<void> => {
    setSyncBusy(true); setSyncErr(null);
    try {
      setSyncReport(await edgeApi.centralSyncRun());
      loadSyncStatus();
      const r = await edgeApi.listAdminApps();
      setRows(r.apps);
    } catch (e) {
      setSyncErr(e instanceof Error ? e.message : String(e));
    } finally { setSyncBusy(false); }
  };

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
            <table className="ea-table ea-table--dense ea-table--nowrap"
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
                  <th className="ea-col-w-90">Actions</th>
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
                    <td>
                      <button className="ea-btn ea-btn--secondary ea-btn--xs"
                              type="button"
                              onClick={() => { void onRollback(r); }}
                              data-test={`system-apps-rollback-${r.appKey}`}>
                        Rollback
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Central sync"
             action={
               <span className="ea-text-muted ea-text-xs"
                     data-test="system-apps-sync-status">
                 {syncStatus?.latest === null || syncStatus?.latest === undefined
                   ? 'Never run'
                   : `${syncStatus.latest.outcome} · ${fmtAgo(syncStatus.latest.startedAt ?? '')}`}
               </span>
             }>
        <div className="ea-mb-md" data-test="system-apps-policy">
          <label className="ea-label" htmlFor="sync-policy-source">Source</label>
          <select id="sync-policy-source"
                  className="ea-input ea-mr-md"
                  value={policyDraft.source}
                  disabled={policyBusy}
                  onChange={(e) => setPolicyDraft({
                    ...policyDraft,
                    source: e.target.value as edgeApi.CentralSyncSource,
                  })}
                  data-test="system-apps-policy-source">
            <option value="CENTRAL">Paired DHIS2 instance (/api/apps)</option>
            <option value="APP_HUB">DHIS2 App Hub (apps.dhis2.org)</option>
          </select>
          <label className="ea-label" htmlFor="sync-policy-mode">Policy</label>
          <select id="sync-policy-mode"
                  className="ea-input ea-mr-md"
                  value={policyDraft.mode}
                  disabled={policyBusy}
                  onChange={(e) => setPolicyDraft({
                    ...policyDraft,
                    mode: e.target.value as edgeApi.CentralSyncPolicyMode,
                  })}
                  data-test="system-apps-policy-mode">
            <option value="ALLOW_ALL">Allow all discovered apps</option>
            <option value="ALLOW_LIST">Allow-list (only these keys)</option>
            <option value="DENY_LIST">Deny-list (everything except these keys)</option>
          </select>
          <input id="sync-policy-keys"
                 className="ea-input"
                 placeholder="comma-separated central_app_id keys"
                 value={policyDraft.keysText}
                 disabled={policyBusy || policyDraft.mode === 'ALLOW_ALL'}
                 onChange={(e) => setPolicyDraft({
                   ...policyDraft, keysText: e.target.value,
                 })}
                 data-test="system-apps-policy-keys" />
          <button className="ea-btn ea-btn--secondary ea-ml-md"
                  type="button"
                  disabled={policyBusy || !policyDirty}
                  onClick={() => { void onSavePolicy(); }}
                  data-test="system-apps-policy-save">
            Save policy
          </button>
          {policyErr !== null && (
            <p className="ea-text-muted ea-text-xs"
               data-test="system-apps-policy-error">{policyErr}</p>
          )}
        </div>
        <div className="ea-flex ea-gap-md ea-mb-md">
          <button className="ea-btn ea-btn--secondary"
                  type="button"
                  disabled={syncBusy}
                  onClick={() => { void onPreview(); }}
                  data-test="system-apps-sync-preview-btn">
            Preview (dry-run)
          </button>
          <button className="ea-btn"
                  type="button"
                  disabled={syncBusy}
                  onClick={() => { void onRunNow(); }}
                  data-test="system-apps-sync-run-btn">
            Run sync now
          </button>
        </div>
        {syncErr !== null && (
          <p className="ea-text-muted"
             data-test="system-apps-sync-error">{syncErr}</p>
        )}
        {syncReport !== null && (
          <div className="ea-table-wrap" data-test="system-apps-sync-report">
            <p className="ea-text-xs ea-text-muted">
              <strong>{syncReport.outcome}</strong>
              {' · '}{syncReport.message ?? ''}
            </p>
            {syncReport.details.length > 0 && (
              <table className="ea-table ea-table--dense ea-table--nowrap">
                <thead>
                  <tr>
                    <th>App</th>
                    <th className="ea-col-w-90">Action</th>
                    <th className="ea-col-w-110">Central</th>
                    <th className="ea-col-w-110">Local</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {syncReport.details.map((d) => (
                    <tr key={`${d.key}|${d.action}`}>
                      <td><code className="ea-text-xs">{d.key}</code></td>
                      <td className="ea-text-xs">{d.action}</td>
                      <td className="ea-text-xs">{d.centralVersion ?? '—'}</td>
                      <td className="ea-text-xs">{d.localVersion ?? '—'}</td>
                      <td className="ea-text-xs ea-text-muted">
                        {d.reason ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
            <table className="ea-table ea-table--dense ea-table--nowrap"
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
