import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtDate, fmtAgo, fmtBytes, humaniseState, SyncStatusBar, Status } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

const DECOMMISSION_WORD = 'DECOMMISSION';

export function Decommission(): JSX.Element {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<edgeApi.DecommissionResponse | null>(null);

  async function run(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      setReceipt(await edgeApi.decommissionEdge());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  const ready = typed.trim() === DECOMMISSION_WORD && !busy && !receipt;

  if (receipt) {
    return (
      <div className="ea-screen" data-test="decommission-receipt">
        <SyncStatusBar
          tone="danger"
          title="Edge decommissioned"
          statusLabel="Terminal"
          subtitle={
            <>
              <span>This edge has been retired. Download the final backup
              archive below before taking the host offline.</span>
            </>
          }
        />
        <Panel title="Decommission receipt">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Users disabled</dt>
              <dd className="ea-mono"
                  data-test="decommission-disabled-users">
                {receipt.disabledUsers}
              </dd></div>
            <div className="ea-def-row"><dt>Final backup requested</dt>
              <dd data-test="decommission-final-backup">
                {receipt.finalBackupRequested ? 'yes' : 'no'}
              </dd></div>
            <div className="ea-def-row"><dt>Acted by</dt>
              <dd className="ea-mono" style={{ fontSize: 12 }}>
                {receipt.actedBy}
              </dd></div>
          </dl>
        </Panel>
        <Panel title="Next steps">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              Wait for the final backup to reach <code>SUCCESS</code> on the{' '}
              <Link to="/backup" data-cross-module="Backup"
                     data-test="decommission-open-backup">Backup tools page</Link>.
            </li>
            <li>Download the archive from the row&apos;s actions menu.</li>
            <li>
              Capture a <Link to="/support-bundle"
                                data-cross-module="SupportBundle"
                                data-test="decommission-open-support">
                support bundle
              </Link> for the retention record.
            </li>
            <li>
              Shut the edge down from <Link to="/admin-tasks"
                                               data-cross-module="Lifecycle"
                                               data-test="decommission-open-lifecycle">
                Admin tasks
              </Link>.
            </li>
          </ol>
        </Panel>
      </div>
    );
  }

  return (
    <div className="ea-screen" data-test="decommission">
      <SyncStatusBar
        tone="danger"
        title="Decommission this edge"
        statusLabel="Irreversible"
        subtitle={
          <>
            <span>
              Disables every other user, requests a final FULL backup as
              an evidence export, and records a <code>DECOMMISSION</code>{' '}
              audit event. Your own account is intentionally kept active so
              you can download the final backup afterwards.
            </span>
          </>
        }
      />

      {err && <ErrorBlock title="Decommission failed"
                            testId="err-decommission">{err}</ErrorBlock>}

      <Panel title="What happens">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>All other DER users (ADMIN + OPERATOR + VIEWER) are disabled.
            They will not be able to sign in.</li>
          <li>A final <strong>FULL</strong> backup is queued for evidence
            export. The row appears in Backup tools once drained.</li>
          <li>A terminal <code>DECOMMISSION</code> audit event is written
            to the security log.</li>
          <li>The edge continues to accept inbound reads for the acting
            ADMIN account until the host is shut down manually.</li>
        </ul>
      </Panel>

      <Panel title="Confirm">
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
          Type <strong style={{ fontFamily: 'monospace' }}>
            {DECOMMISSION_WORD}
          </strong> in the box below and press <strong>Decommission</strong>{' '}
          to proceed.
        </p>
        <div style={{ marginTop: 10, display: 'flex', gap: 10,
                        alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="ea-input ea-mono" type="text"
                 placeholder={DECOMMISSION_WORD}
                 value={typed}
                 data-test="decommission-input"
                 onChange={(e) => setTyped(e.target.value)}
                 style={{ maxWidth: 240 }} />
          <button type="button"
                  className="ea-btn ea-btn--danger ea-btn--sm"
                  disabled={!ready}
                  data-test="decommission-run"
                  onClick={() => { run().catch(() => undefined); }}>
            {busy ? 'Decommissioning…' : 'Decommission'}
          </button>
        </div>
      </Panel>
    </div>
  );
}

const SITE_CONFIG_LABELS: Record<string, { label: string; hint?: string }> = {
  'site.displayName':
    { label: 'Display name',
      hint: 'Shown in the admin shell topbar + support-bundle manifest.' },
  'site.localBaseUrl':
    { label: 'Local base URL',
      hint: 'How connected devices reach this edge (e.g. https://der.local).' },
  'site.timeZone':
    { label: 'Time zone',
      hint: 'IANA zone — drives report windows + scheduler cron expansion.' },
  'site.connectivity.maxConcurrentSessions':
    { label: 'Max concurrent sessions',
      hint: 'Simultaneous logged-in operators the edge accepts.' },
  'site.connectivity.maxOfflineHours':
    { label: 'Max offline hours',
      hint: 'How long the edge can run without Central before flagging staleness.' },
  'site.connectivity.onlineWindowCron':
    { label: 'Online-window cron',
      hint: 'Optional cron for scheduled WAN windows. Blank = continuous.' },
  'site.connectivity.requireVpn':
    { label: 'Require VPN',
      hint: 'When true, central-sync fails unless the WireGuard tunnel is up.' },
};

export function SiteConfig(): JSX.Element {
  const [data, setData] = useState<edgeApi.SiteConfigResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.readSiteConfig();
      setData(r);
      setDraft(r.values);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function saveKey(key: string): Promise<void> {
    setSavingKey(key); setErr(null); setMsg(null);
    try {
      await edgeApi.writeSiteConfig({ [key]: draft[key] ?? '' });
      setMsg(`${key} saved.`);
      setTimeout(() => setMsg((m) => (m?.startsWith(key) ? null : m)), 2500);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingKey(null); }
  }

  if (err && !data) {
    return <ErrorBlock title="Site config load failed"
                        testId="err-site-config-load">{err}</ErrorBlock>;
  }
  if (!data) return <LoadingBlock testId="loading" />;

  const entries = Object.entries(data.values);
  const dirty = entries.filter(([k, v]) => draft[k] !== v);

  return (
    <div className="ea-screen" data-test="site-config">
      <SyncStatusBar
        tone={dirty.length > 0 ? 'warning' : 'info'}
        title="Site configuration"
        statusLabel={`${entries.length} settings`}
        subtitle={
          <>
            <span>Site-level connectivity policies, limits, local URL and time-zone.</span>
            {data.updatedAt && (<>
              <span>·</span>
              <span>Last changed <strong>
                {fmtAgo(data.updatedAt)}
              </strong></span>
            </>)}
            {dirty.length > 0 && (<>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--der-warning-ink)' }}>
                  {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
                </strong>
              </span>
            </>)}
          </>
        }
      />

      {err && <ErrorBlock title="Save failed"
                            testId="err-site-config-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="site-config-saved">{msg}</p>}

      <Panel title="Settings">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
            <thead><tr>
              <th>Setting</th><th>Value</th>
              <th style={{ width: 120 }}>
                <span className="ea-visually-hidden">Actions</span>
              </th>
            </tr></thead>
            <tbody>
              {entries.map(([k, current]) => {
                const next = draft[k] ?? '';
                const changed = next !== current;
                const saving = savingKey === k;
                const meta = SITE_CONFIG_LABELS[k] ?? { label: k };
                const isDefault = current === data.defaults[k];
                return (
                  <tr key={k} data-test={`site-row-${k}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{meta.label}</div>
                      <div className="ea-text-muted ea-mono"
                           style={{ fontSize: 11 }}>
                        {k}
                      </div>
                      {meta.hint && (
                        <div className="ea-text-muted"
                             style={{ fontSize: 12, marginTop: 2 }}>
                          {meta.hint}
                        </div>
                      )}
                    </td>
                    <td>
                      <input className="ea-input ea-mono" type="text"
                             style={{ width: '100%', fontSize: 12 }}
                             value={next}
                             aria-label={`Value for ${meta.label}`}
                             data-test={`site-input-${k}`}
                             onChange={(e) => setDraft(
                               (d) => ({ ...d, [k]: e.target.value }))} />
                      {isDefault && (
                        <span className="ea-text-muted" style={{ fontSize: 11 }}>
                          (default)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button"
                              className="ea-btn ea-btn--primary ea-btn--sm"
                              disabled={!changed || saving}
                              data-test={`site-save-${k}`}
                              onClick={() => { saveKey(k).catch(() => undefined); }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Audit"
             action={
               <Link to="/audit/events?eventType=SITE_CONFIG_CHANGED"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="site-config-open-audit">
                 View SITE_CONFIG_CHANGED events →
               </Link>
             }>
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every save is logged as <code>SITE_CONFIG_CHANGED</code> in the
          security audit log with the changed-key payload.
        </p>
      </Panel>
    </div>
  );
}

export function ConfigEditor(): JSX.Element {
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<edgeApi.SecurityAuditEvent[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await edgeApi.readOpsSettings();
      setSettings(r.settings);
      setDraft(r.settings);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    try {
      setHistory(await edgeApi.securityAuditEvents({
        eventType: 'SETTINGS_CHANGED', limit: 25,
      }));
    } catch { /* leave previous */ }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function saveKey(key: string): Promise<void> {
    setSavingKey(key); setErr(null); setMsg(null);
    try {
      await edgeApi.writeOpsSetting(key, draft[key] ?? '');
      setMsg(`${key} saved.`);
      setTimeout(() => setMsg((m) => (m?.startsWith(key) ? null : m)), 2500);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setSavingKey(null); }
  }

  if (err && !settings) {
    return <ErrorBlock title="Configuration load failed"
                        testId="err-config-load">{err}</ErrorBlock>;
  }
  if (!settings) return <LoadingBlock testId="loading" />;

  const entries = Object.entries(settings);
  const dirty = entries.filter(([k, v]) => draft[k] !== v);

  return (
    <div className="ea-screen" data-test="config-editor">
      <SyncStatusBar
        tone={dirty.length > 0 ? 'warning' : 'info'}
        title="Configuration"
        statusLabel={`${entries.length} keys`}
        subtitle={
          <>
            <span>Runtime-tunable DER settings with per-change audit trail.</span>
            {dirty.length > 0 && (<>
              <span>·</span>
              <span>
                <strong style={{ color: 'var(--der-warning-ink)' }}>
                  {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
                </strong>
              </span>
            </>)}
          </>
        }
      />

      {err && <ErrorBlock title="Save failed" testId="err-config-save">{err}</ErrorBlock>}
      {msg && <p className="ea-saved" data-test="config-saved">{msg}</p>}

      <Panel title="Settings">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" style={{ width: '100%' }}>
            <thead><tr>
              <th>Key</th><th>Value</th>
              <th style={{ width: 120 }}>
                <span className="ea-visually-hidden">Actions</span>
              </th>
            </tr></thead>
            <tbody>
              {entries.map(([k, current]) => {
                const next = draft[k] ?? '';
                const changed = next !== current;
                const saving = savingKey === k;
                return (
                  <tr key={k} data-test={`config-row-${k}`}>
                    <td className="ea-mono" style={{ fontSize: 12 }}>{k}</td>
                    <td>
                      <input className="ea-input ea-mono" type="text"
                             style={{ width: '100%', fontSize: 12 }}
                             value={next}
                             aria-label={`Value for ${k}`}
                             data-test={`config-input-${k}`}
                             onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button"
                              className="ea-btn ea-btn--primary ea-btn--sm"
                              disabled={!changed || saving}
                              data-test={`config-save-${k}`}
                              onClick={() => { saveKey(k).catch(() => undefined); }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent changes"
             action={
               <Link to="/audit/events?category=settings"
                      className="ea-link-btn"
                      data-cross-module="Security"
                      data-test="config-open-audit">
                 View full audit →
               </Link>
             }>
        {history.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}
             data-test="config-history-empty">
            No settings changes recorded on this edge yet.
          </p>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense"
                   data-test="config-history">
              <thead><tr>
                <th>When</th><th>Actor</th><th>Change</th><th>Outcome</th>
              </tr></thead>
              <tbody>
                {history.map((e, i) => (
                  <tr key={`${e.observedAt}-${i}`}>
                    <td className="ea-mono" style={{ fontSize: 12 }}
                        title={e.observedAt}>
                      {fmtAgo(e.observedAt)}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 12 }}>
                      {e.actorUserId?.slice(0, 8) ?? '—'}
                    </td>
                    <td className="ea-mono" style={{ fontSize: 12,
                                                      wordBreak: 'break-word' }}>
                      {e.detail ?? '—'}
                    </td>
                    <td>
                      <Status tone={
                        e.outcome === 'SUCCESS' ? 'success'
                        : e.outcome === 'FAILURE' ? 'danger' : 'info'}>
                        {e.outcome}
                      </Status>
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

export function OperationalReport(): JSX.Element {
  const [report, setReport] = useState<edgeApi.OperationalReport | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [worker, setWorker] = useState<edgeApi.WorkerHealth | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function reload(): Promise<void> {
    setRefreshing(true);
    try {
      const [a, b, c] = await Promise.allSettled([
        edgeApi.fetchOperationalReport(),
        edgeApi.listJobs(50),
        edgeApi.workerHealth(),
      ]);
      if (a.status === 'fulfilled') setReport(a.value);
      else { setErr(a.reason instanceof Error ? a.reason.message : String(a.reason)); return; }
      if (b.status === 'fulfilled') setJobs(b.value);
      if (c.status === 'fulfilled') setWorker(c.value);
    } finally { setRefreshing(false); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  if (err && !report) {
    return <ErrorBlock title="Operational report failed"
                        testId="err-ops-report">{err}</ErrorBlock>;
  }
  if (!report) return <LoadingBlock testId="loading" />;

  const syncedPct = report.centralConfirmed + report.localOnly > 0
    ? Math.round(100 * report.centralConfirmed
                 / (report.centralConfirmed + report.localOnly))
    : null;

  const jobsSucceeded = jobs?.filter((j) =>
    j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS').length ?? 0;
  const jobsFailed = jobs?.filter((j) =>
    j.outcome === 'FAILED' || j.outcome === 'FAILURE').length ?? 0;
  const workerEnabled = worker?.enabled ?? false;
  const backlogTotal = worker
    ? Object.values(worker.backlog).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="ea-screen" data-test="ops-report">
      <SyncStatusBar
        tone={report.localOnly > 0 ? 'warning' : 'success'}
        title="Operational report"
        statusLabel={
          syncedPct == null ? 'No records yet'
          : syncedPct === 100 ? 'Fully synchronised'
          : `${syncedPct}% synchronised`
        }
        subtitle={
          <>
            <span>Local-vs-central reconciliation across captured records.</span>
            <span>·</span>
            <span>Generated <strong>
              {fmtAgo(report.generatedAt)}
            </strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={refreshing}
                  data-test="ops-report-refresh"
                  onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        }
      />

      <Panel title="Local vs. central">
        <div className="ea-stat-strip">
          <div className="ea-stat ea-stat--success">
            <div className="ea-stat-value" data-test="ops-central-confirmed">
              {report.centralConfirmed.toLocaleString()}
            </div>
            <div className="ea-stat-label">Central-confirmed</div>
          </div>
          <div className="ea-stat ea-stat--warning">
            <div className="ea-stat-value" data-test="ops-local-only">
              {report.localOnly.toLocaleString()}
            </div>
            <div className="ea-stat-label">Local-only (PENDING + RETRYABLE)</div>
          </div>
          <div className="ea-stat ea-stat--info">
            <div className="ea-stat-value" data-test="ops-synced-pct">
              {syncedPct == null ? '—' : `${syncedPct}%`}
            </div>
            <div className="ea-stat-label">Central reach</div>
          </div>
        </div>
        <p className="ea-text-muted"
           style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5 }}
           data-test="ops-note">
          {report.note}
        </p>
      </Panel>

      <Panel title="Journal by state"
             action={
               <Link to="/data/queue" className="ea-link-btn"
                      data-cross-module="Data"
                      data-test="ops-open-queue">
                 Open queue →
               </Link>
             }>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" data-test="ops-by-state">
            <thead><tr><th>State</th><th>Count</th></tr></thead>
            <tbody>
              {Object.entries(report.byState).map(([state, count]) => (
                <tr key={state} data-test={`ops-state-${state}`}>
                  <td>
                    <Status tone={
                      state === 'CENTRAL_ACCEPTED' ? 'success'
                      : state === 'CENTRAL_REJECTED' || state === 'FAILED' ? 'danger'
                      : state === 'PENDING' || state === 'RETRYABLE' || state === 'CONFLICT_REVIEW' ? 'warning'
                      : 'info'}>
                      {humaniseState(state)}
                    </Status>
                  </td>
                  <td className="ea-mono">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sync job outcomes (last 50 runs)"
             action={
               <Link to="/sync/history" className="ea-link-btn"
                      data-cross-module="Sync"
                      data-test="ops-open-history">
                 Open sync history →
               </Link>
             }>
        {!jobs ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Loading…
          </p>
        ) : jobs.length === 0 ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}
             data-test="ops-jobs-empty">
            No scheduled jobs have run yet on this edge.
          </p>
        ) : (
          <div className="ea-stat-strip">
            <div className="ea-stat ea-stat--success">
              <div className="ea-stat-value" data-test="ops-jobs-succeeded">
                {jobsSucceeded}
              </div>
              <div className="ea-stat-label">Succeeded</div>
            </div>
            <div className="ea-stat ea-stat--danger">
              <div className="ea-stat-value" data-test="ops-jobs-failed">
                {jobsFailed}
              </div>
              <div className="ea-stat-label">Failed</div>
            </div>
            <div className="ea-stat ea-stat--muted">
              <div className="ea-stat-value" data-test="ops-jobs-total">
                {jobs.length}
              </div>
              <div className="ea-stat-label">Total runs captured</div>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Worker status"
             action={
               <Link to="/journal/worker" className="ea-link-btn"
                      data-cross-module="Worker"
                      data-test="ops-open-worker">
                 Open worker →
               </Link>
             }>
        {!worker ? (
          <p className="ea-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Loading…
          </p>
        ) : (
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>Worker</dt>
              <dd data-test="ops-worker-enabled">
                <Status tone={workerEnabled ? 'success' : 'warning'}>
                  {workerEnabled ? 'Enabled' : 'Paused'}
                </Status>
              </dd></div>
            <div className="ea-def-row"><dt>Backlog</dt>
              <dd className="ea-mono" data-test="ops-worker-backlog">
                {backlogTotal.toLocaleString()}
              </dd></div>
          </dl>
        )}
      </Panel>
    </div>
  );
}

export function SupportBundle(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{
    filename: string; sizeBytes: number; downloadedAt: string;
  } | null>(null);

  async function download(): Promise<void> {
    setBusy(true); setErr(null);
    try {
      const { blob, filename } = await edgeApi.fetchSupportBundle();
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setLastExport({
        filename, sizeBytes: blob.size,
        downloadedAt: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ea-screen" data-test="support-bundle">
      <SyncStatusBar
        tone="info"
        title="Support bundle"
        statusLabel={lastExport ? 'Ready' : 'Not yet exported'}
        subtitle={
          <>
            <span>
              Sanitised diagnostics bundle for sharing with DER support.
              Includes build metadata, a snapshot of pending journal
              operations, and the current users roster.
            </span>
            <span>·</span>
            <span>
              <strong>No PHI / operational
              data</strong> is included — only operator identities and
              per-operation metadata.
            </span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={busy}
                  data-test="support-bundle-download"
                  onClick={() => { download().catch(() => undefined); }}>
            <UiIcon icon="download" size={14} />
            <span>{busy ? 'Preparing…' : 'Export support bundle'}</span>
          </button>
        }
      />

      {err && <ErrorBlock title="Support bundle export failed"
                            testId="err-support-bundle">{err}</ErrorBlock>}

      <Panel title="What's in the bundle">
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li><strong>manifest.json</strong> — generated-at timestamp,
            generating user ID, hostname, Java + OS version</li>
          <li><strong>users.json</strong> — sanitised users roster
            (user IDs, display names, roles, origin, permission age).
            <em> No password hashes or session tokens.</em></li>
          <li><strong>journal-recent.json</strong> — the 50 most recent
            pending operations (ID, entity type, state, attempt count,
            created timestamp). <em>No payload content.</em></li>
        </ul>
      </Panel>

      {lastExport && (
        <Panel title="Last export">
          <dl className="ea-def-list">
            <div className="ea-def-row"><dt>File</dt>
              <dd className="ea-mono" data-test="support-bundle-filename">
                {lastExport.filename}
              </dd></div>
            <div className="ea-def-row"><dt>Size</dt>
              <dd className="ea-mono" data-test="support-bundle-size">
                {fmtBytes(lastExport.sizeBytes)}
              </dd></div>
            <div className="ea-def-row"><dt>Downloaded</dt>
              <dd className="ea-mono">{fmtDate(lastExport.downloadedAt)}</dd></div>
          </dl>
        </Panel>
      )}

      <Panel title="Audit trail">
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 13 }}>
          Every export is logged to the DER security audit as
          <code> SUPPORT_BUNDLE_EXPORTED</code>.{' '}
          <Link to="/audit/events" className="ea-link-btn"
                 data-cross-module="Security"
                 data-test="support-bundle-audit-link">
            View audit log →
          </Link>
        </p>
      </Panel>
    </div>
  );
}

