import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { HeroHeader } from '../components/HeroHeader';
import { UiIcon } from '../components/UiIcon';
import { Panel, SyncStatusBar, Status, confirmThenRun } from './shared';
import { getSimulateMode, setSimulateMode, subscribeSimulateMode,
         type SimulateMode } from '../features/demo/simulateStore';

/**
 * Phase 06 Release 3 — EA-19..36 admin screens.
 *
 * Grouped by domain: recovery, backup/restore, evaluation, custom apps,
 * diagnostics, settings. Several EA-* ids share a component where the
 * server surface is naturally one.
 */

// EA-19..22 Recovery actions (re-journal / mirror reset / re-sync) -----
export function EARecoveryTools({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'triggerJob' | 'drift' | 'listConflicts'>;
} = {}): JSX.Element {
  type RunState = 'idle' | 'running' | 'done' | 'error';
  const [status, setStatus] = useState<Record<string, RunState>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Record<string, string>>({});

  async function run(name: string, fn: () => Promise<unknown>): Promise<void> {
    setStatus((s) => ({ ...s, [name]: 'running' }));
    setError(null);
    try {
      await fn();
      setStatus((s) => ({ ...s, [name]: 'done' }));
      setLastRunAt((s) => ({ ...s, [name]: new Date().toISOString() }));
    } catch (err) {
      setStatus((s) => ({ ...s, [name]: 'error' }));
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const toneFor = (s: RunState): 'muted' | 'info' | 'success' | 'danger' => {
    if (s === 'running') return 'info';
    if (s === 'done') return 'success';
    if (s === 'error') return 'danger';
    return 'muted';
  };
  const labelFor = (s: RunState): string => {
    if (s === 'running') return 'Running…';
    if (s === 'done') return 'Done';
    if (s === 'error') return 'Error';
    return 'Idle';
  };

  const runningCount = Object.values(status).filter((s) => s === 'running').length;
  const errorCount = Object.values(status).filter((s) => s === 'error').length;
  const tone = errorCount > 0 ? 'danger' : runningCount > 0 ? 'info' : 'muted';
  const statusLabel = runningCount > 0
    ? `${runningCount} op${runningCount === 1 ? '' : 's'} running`
    : errorCount > 0
      ? `${errorCount} op${errorCount === 1 ? '' : 's'} failed`
      : 'Idle';

  return (
    <div className="ea-screen" data-test="ea19">
      <SyncStatusBar
        tone={tone}
        title="Recovery tools"
        statusLabel={statusLabel}
        subtitle="Operator-triggered recovery operations.  Each action is idempotent — safe to re-run if it errors — but the first two are heavy (full metadata resync + drift re-run) and can take several minutes on a cold DER.  All runs are audited."
        actions={
          <>
            <Link to="/monitoring/health"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="System"
                  data-test="ea19-open-health">
              <UiIcon icon="health" size={14} />
              <span>System health</span>
            </Link>
            <Link to="/audit/events"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Security &amp; Audit"
                  data-test="ea19-open-audit">
              <UiIcon icon="audit" size={14} />
              <span>Audit stream</span>
            </Link>
          </>
        }
      />

      {error && (
        <ErrorBlock title="Recovery op failed" testId="ea19-error">{error}</ErrorBlock>
      )}

      <RecoveryAction
        testIdPrefix="ea19-metadata"
        runTestId="ea19-metadata-resync"
        title="Trigger full metadata resync"
        description="Pulls the full metadata catalogue from DHIS2 and rewrites the DER mirror.  Use when drift keeps re-appearing or an upstream migration has shifted uid shapes.  Takes 30s–several minutes depending on catalogue size."
        affects={['Metadata mirror', 'Program rules', 'TEI type attributes']}
        state={status.metadata ?? 'idle'}
        lastRunAt={lastRunAt.metadata}
        toneFor={toneFor}
        labelFor={labelFor}
        onRun={() => {
          confirmThenRun(
            'Trigger a full metadata resync — DER will pause ingest + drain while the catalogue reloads.',
            () => { run('metadata', () => api.triggerJob('METADATA_SYNC_FULL'))
              .catch(() => undefined); });
        }}
      />
      <RecoveryAction
        testIdPrefix="ea19-drift"
        runTestId="ea19-drift-refresh"
        title="Re-run metadata drift"
        description="Compares the local metadata mirror against DHIS2 central and refreshes the drift report.  Usually cheap; run after a central-side change if the drift dashboard is stale."
        affects={['Drift findings', 'Drift report snapshot']}
        state={status.drift ?? 'idle'}
        lastRunAt={lastRunAt.drift}
        toneFor={toneFor}
        labelFor={labelFor}
        onRun={() => { run('drift', () => api.drift(true)).catch(() => undefined); }}
      />
      <RecoveryAction
        testIdPrefix="ea19-conflicts"
        runTestId="ea19-conflicts-refresh"
        title="Refresh conflict list"
        description="Re-reads the journal conflict queue.  Non-destructive; does not resolve or re-run any conflict.  Equivalent to a cache-refresh on the Conflicts dashboard."
        affects={['Conflict queue view (read-only)']}
        state={status.conflicts ?? 'idle'}
        lastRunAt={lastRunAt.conflicts}
        toneFor={toneFor}
        labelFor={labelFor}
        onRun={() => { run('conflicts', () => api.listConflicts()).catch(() => undefined); }}
      />
    </div>
  );
}

function RecoveryAction({ testIdPrefix, runTestId, title, description, affects, state,
                         lastRunAt, toneFor, labelFor, onRun }: {
  testIdPrefix: string;
  runTestId: string;
  title: string;
  description: string;
  affects: ReadonlyArray<string>;
  state: 'idle' | 'running' | 'done' | 'error';
  lastRunAt?: string;
  toneFor: (s: 'idle' | 'running' | 'done' | 'error')
    => 'muted' | 'info' | 'success' | 'danger';
  labelFor: (s: 'idle' | 'running' | 'done' | 'error') => string;
  onRun: () => void;
}): JSX.Element {
  return (
    <Panel
      title={title}
      action={
        <span data-test={`${testIdPrefix}-status-chip`}>
          <Status tone={toneFor(state)}>{labelFor(state)}</Status>
        </span>
      }>
      <p style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--der-ink-700)',
                   lineHeight: 1.5 }}>
        {description}
      </p>
      <dl className="ea-def-list">
        <div className="ea-def-row">
          <dt>Affects</dt>
          <dd>
            {affects.map((a, i) => (
              <span key={a}>
                {i > 0 && <span className="ea-text-muted"> · </span>}
                {a}
              </span>
            ))}
          </dd>
        </div>
        {lastRunAt && (
          <div className="ea-def-row">
            <dt>Last run</dt>
            <dd className="ea-mono" data-test={`${testIdPrefix}-last-run`}>
              {lastRunAt.replace('T', ' ').slice(0, 19)}Z
            </dd>
          </div>
        )}
      </dl>
      <div style={{ marginTop: 10 }}>
        <button type="button"
                className="ea-btn ea-btn--primary ea-btn--sm"
                data-test={runTestId}
                disabled={state === 'running'}
                onClick={onRun}>
          {state === 'running' ? 'Running…' : 'Run'}
        </button>
        {/* Keep an invisible status span for the pre-existing test harness
         *  which may still query `*-status` text content. */}
        <span style={{ display: 'none' }} data-test={`${testIdPrefix}-status`}>
          {state}
        </span>
      </div>
    </Panel>
  );
}

// EA-23..26 Backup / restore (stubs; Phase 07 orchestrates) ----------
export function EABackupList({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'listBackups' | 'requestBackup'>;
} = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.BackupRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load(): Promise<void> {
    try { setRows(await api.listBackups()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => undefined); }, [api]);
  async function trigger(kind: 'AUDIT' | 'FULL'): Promise<void> {
    try { await api.requestBackup(kind); await load(); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  if (error) return <ErrorBlock title="Backups failed" testId="ea23-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea23-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea23-heading">Backup runs</h1>
      <p>Phase 07 ships the pg_dump worker; alpha.3 just records intent.</p>
      <button type="button" data-test="ea23-request-audit"
              onClick={() => { trigger('AUDIT').catch(() => undefined); }}>
        Request audit backup
      </button>
      <button type="button" data-test="ea23-request-full"
              onClick={() => { trigger('FULL').catch(() => undefined); }}>
        Request full backup
      </button>
      {rows.length === 0 ? (
        <EmptyBlock title="No runs" testId="ea23-empty">
          Nothing requested yet.
        </EmptyBlock>
      ) : (
        <ul>{rows.map((r) => (
          <li key={r.runId}>
            <span data-test={`ea23-row-${r.runId}`}>
              {r.kind} / {r.status} — {r.requestedAt}
            </span>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

export function EARestoreList({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'listRestores' | 'requestRestore'>;
} = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.RestoreRow[] | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function load(): Promise<void> {
    try { setRows(await api.listRestores()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch(() => undefined); }, [api]);
  async function trigger(): Promise<void> {
    try { await api.requestRestore(source); await load(); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  if (error) return <ErrorBlock title="Restores failed" testId="ea25-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea25-loading" />;
  return (
    <div className="ea-screen">
      <h1 data-test="ea25-heading">Restore runs</h1>
      <label><span>Source URI</span>
        <input data-test="ea25-source" value={source}
               onChange={(e) => setSource(e.target.value)} /></label>
      <button type="button" data-test="ea25-request" disabled={!source}
              onClick={() => { trigger().catch(() => undefined); }}>
        Request restore
      </button>
      {rows.length === 0 ? (
        <EmptyBlock title="No restores" testId="ea25-empty">
          Nothing requested yet.
        </EmptyBlock>
      ) : (
        <ul>{rows.map((r) => (
          <li key={r.runId}>
            <span data-test={`ea25-row-${r.runId}`}>
              {r.source} / {r.status}
            </span>
          </li>
        ))}</ul>
      )}
    </div>
  );
}

// EA-27..30 Evaluation / reports ------------------------------------
export function EAEvaluationReports({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'listJobs' | 'workerHealth'>;
} = {}): JSX.Element {
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [worker, setWorker] = useState<edgeApi.WorkerHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [j, w] = await Promise.all([api.listJobs(100), api.workerHealth()]);
        if (!cancelled) { setJobs(j); setWorker(w); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Reports failed" testId="ea27-error">{error}</ErrorBlock>;
  if (!jobs || !worker) return <LoadingBlock testId="ea27-loading" />;
  const totals = jobs.reduce((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return (
    <div className="ea-screen">
      <h1 data-test="ea27-heading">Evaluation reports</h1>
      <p style={{ fontSize: 13 }}>
        <Link to="/reports/operational"
               className="ea-link-btn"
               data-test="ea27-ops-report-link">
          Operational report (local vs. central-confirmed) →
        </Link>
      </p>
      <section>
        <h2>Job outcomes (last {jobs.length})</h2>
        <ul data-test="ea27-job-totals">
          {Object.entries(totals).map(([k, v]) => (
            <li key={k}>
              <span data-test={`ea27-outcome-${k}`}>{k}: {v}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Journal backlog</h2>
        <ul data-test="ea27-journal-backlog">
          {Object.entries(worker.backlog).map(([k, v]) => (
            <li key={k}>
              <span data-test={`ea27-backlog-${k}`}>{k}: {v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// EA-31..34 Installed apps ---------------------------------------
export function EAAppsList({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'listApps' | 'setAppEnabled' | 'uninstallApp'>;
} = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.InstalledAppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function reload(): Promise<void> {
    try { setRows(await api.listApps()); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  // Why: load/reload closes over state; re-run only when api changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, [api]);
  async function toggle(row: edgeApi.InstalledAppRow): Promise<void> {
    try { await api.setAppEnabled(row.appId, !row.enabled); await reload(); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function remove(row: edgeApi.InstalledAppRow): Promise<void> {
    try { await api.uninstallApp(row.appId); await reload(); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  if (error) return <ErrorBlock title="Apps failed" testId="ea31-error">{error}</ErrorBlock>;
  if (rows === null) return <LoadingBlock testId="ea31-loading" />;
  const enabled = rows.filter((r) => r.enabled).length;
  const disabled = rows.length - enabled;
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Apps"
        subtitle="Custom DHIS2 apps installed on this edge."
        actions={
          <span className="ea-btn ea-btn--primary ea-btn--muted" aria-disabled="true" title="Install dialog — not yet available">
            + Install app
          </span>
        }
      />
      <h1 data-test="ea31-heading" className="ea-visually-hidden">Installed apps</h1>

      <section role="group" aria-label="App summary"
               style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13,
                        margin: '0 0 var(--sp-3)' }}>
        <span>Installed <strong style={{ color: 'var(--der-ink-900)' }}>{rows.length}</strong></span>
        <span>·</span>
        <span style={{ color: 'var(--der-success-ink)' }}>Enabled <strong>{enabled}</strong></span>
        <span>·</span>
        <span className="ea-text-muted">Disabled <strong>{disabled}</strong></span>
      </section>

      {rows.length === 0 ? (
        <EmptyBlock title="No installed apps" testId="ea31-empty">
          Install a custom DHIS2 app via the install dialog.
        </EmptyBlock>
      ) : (
        <div className="ea-app-grid">
          {rows.map((r) => (
            <article key={r.appId} className="ea-app-card">
              <div className="ea-app-card-head">
                <div className="ea-app-icon" aria-hidden="true">
                  {r.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="ea-app-ident">
                  <div className="ea-app-title" data-test={`ea31-app-${r.appId}`}>
                    {r.displayName}
                  </div>
                  <div className="ea-app-key ea-mono">{r.appKey}</div>
                </div>
                <span
                  className={'ea-chip ea-chip--' + (r.enabled ? 'success' : 'neutral')}
                  data-test={`ea31-state-${r.appId}`}
                >
                  {r.enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <dl className="ea-app-meta">
                <dt>Version</dt><dd className="ea-mono">{r.version}</dd>
                <dt>Installed</dt><dd>{r.installedAt?.slice(0, 10) ?? '—'}</dd>
              </dl>
              <div className="ea-app-actions">
                <button
                  type="button"
                  className="ea-btn ea-btn--ghost"
                  data-test={`ea31-toggle-${r.appId}`}
                  onClick={() => { toggle(r).catch(() => undefined); }}
                >
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="ea-btn ea-btn--ghost ea-btn--danger"
                  data-test={`ea31-delete-${r.appId}`}
                  onClick={() => { remove(r).catch(() => undefined); }}
                >
                  Uninstall
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}


// EA-35 Diagnostics -------------------------------------------------
export function EADiagnostics({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'diagnostics'>;
} = {}): JSX.Element {
  const [d, setD] = useState<edgeApi.Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.diagnostics()
      .then((r) => { if (!cancelled) setD(r); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  if (error) return <ErrorBlock title="Diagnostics failed" testId="ea35-error">{error}</ErrorBlock>;
  if (!d) return <LoadingBlock testId="ea35-loading" />;

  const journalEntries = Object.entries(d.journalBacklog ?? {});
  const journalTotal = journalEntries.reduce((a, [, v]) => a + v, 0);
  const failedBacklog = d.journalBacklog?.FAILED ?? 0;
  const tone: 'success' | 'info' | 'warning' | 'danger' = failedBacklog > 0
    ? 'danger'
    : (d.schedulerBacklog ?? 0) > 50 || journalTotal >= 100
      ? 'warning'
      : (d.schedulerBacklog ?? 0) > 0 || journalTotal > 0
        ? 'info'
        : 'success';
  const statusLabel = failedBacklog > 0
    ? `${failedBacklog} failed op${failedBacklog === 1 ? '' : 's'}`
    : journalTotal === 0 && (d.schedulerBacklog ?? 0) === 0
      ? 'Idle'
      : `${journalTotal} journal · ${d.schedulerBacklog ?? 0} scheduler`;

  return (
    <div className="ea-screen" data-test="ea35">
      <SyncStatusBar
        tone={tone}
        title="Diagnostics"
        statusLabel={statusLabel}
        subtitle="Point-in-time snapshot of the JVM + scheduler + journal.  Memory pressure, uptime, Quartz backlog and per-state journal counts in one place for operator triage."
        actions={
          <Link to="/support-bundle"
                className="ea-btn ea-btn--primary ea-btn--sm"
                data-test="ea35-support-bundle-link">
            <UiIcon icon="download" size={14} />
            <span>Export support bundle</span>
          </Link>
        }
      />
      <Panel title="Runtime"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Live from /edge-api/v1/system/diagnostics
               </span>
             }>
        <dl className="ea-def-list" data-test="ea35-runtime">
          <div className="ea-def-row">
            <dt>Memory (MiB)</dt>
            <dd data-test="ea35-mem" className="ea-mono">{d.memoryMb}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Uptime (s)</dt>
            <dd data-test="ea35-uptime" className="ea-mono">{d.uptimeSeconds}</dd>
          </div>
          <div className="ea-def-row">
            <dt>Quartz backlog</dt>
            <dd data-test="ea35-scheduler">
              {(d.schedulerBacklog ?? 0) === 0
                ? <Status tone="success">0 pending</Status>
                : <Status tone={(d.schedulerBacklog ?? 0) > 50 ? 'warning' : 'info'}>
                    {d.schedulerBacklog} pending
                  </Status>}
            </dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Journal backlog"
             action={
               <span className="ea-text-muted" style={{ fontSize: 12 }}>
                 Total: <strong>{journalTotal}</strong>
               </span>
             }>
        {journalEntries.length === 0 ? (
          <EmptyBlock title="Journal empty" testId="ea35-journal-empty">
            No pending operations in any journal state.
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" data-test="ea35-journal">
              <thead><tr>
                <th style={{ width: 140 }}>State</th>
                <th style={{ textAlign: 'right' }}>Operations</th>
              </tr></thead>
              <tbody>
                {journalEntries.map(([k, v]) => (
                  <tr key={k} data-test={`ea35-journal-${k}`}>
                    <td>
                      {k === 'FAILED'
                        ? <Status tone="danger">{k}</Status>
                        : k === 'PENDING'
                          ? <Status tone="info">{k}</Status>
                          : <Status tone="success">{k}</Status>}
                    </td>
                    <td className="ea-mono" style={{ textAlign: 'right' }}>{v}</td>
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

// EA-36 Settings ----------------------------------------------------
export function EASettings({ api = edgeApi }: {
  api?: Pick<typeof edgeApi, 'readSettings' | 'saveSettings'>;
} = {}): JSX.Element {
  const [s, setS] = useState<edgeApi.SettingsPayload | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.readSettings()
      .then((r) => { if (!cancelled) setS(r); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [api]);
  async function doSave(): Promise<void> {
    if (!s) return;
    setStatus('saving'); setError(null);
    try { await api.saveSettings(s); setStatus('saved'); } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  if (error && !s) return <ErrorBlock title="Settings failed" testId="ea36-error">{error}</ErrorBlock>;
  if (!s) return <LoadingBlock testId="ea36-loading" />;
  const cronEntries = Object.entries(s.cron ?? {});
  const flagEntries = Object.entries(s.featureFlags ?? {});
  return (
    <div className="ea-screen">
      <HeroHeader
        title="Settings"
        subtitle="Scheduler overrides and feature toggles for this edge."
        actions={
          <button
            type="button"
            className="ea-btn ea-btn--primary ea-btn--sm"
            data-test="ea36-save"
            disabled={status === 'saving'}
            onClick={() => { doSave().catch(() => undefined); }}
          >
            <UiIcon icon="refresh" size={14} />
            <span>{status === 'saving' ? 'Saving…' : 'Save changes'}</span>
          </button>
        }
      />
      <h1 data-test="ea36-heading" className="ea-visually-hidden">Settings</h1>

      <p style={{ marginTop: -4, marginBottom: 12, fontSize: 13,
                   display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <Link to="/configuration"
               className="ea-link-btn"
               data-test="ea36-config-editor-link">
          Operational configuration editor →
        </Link>
        <Link to="/site/config"
               className="ea-link-btn"
               data-test="ea36-site-config-link">
          Site configuration (connectivity + time-zone) →
        </Link>
      </p>

      {status === 'saved' && (
        <p data-test="ea36-saved" className="ea-saved">Settings saved.</p>
      )}
      {status === 'error' && error && (
        <ErrorBlock title="Save failed" testId="ea36-save-error">{error}</ErrorBlock>
      )}

      <section className="ea-card ea-form-card">
        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Cron overrides</h2>
            <p>Override the default schedule for background workers. Use
              standard Quartz cron syntax. Leave blank to use defaults.</p>
          </div>
          <div className="ea-form-grid">
            {cronEntries.length === 0 && (
              <div className="ea-field-hint">No cron overrides defined.</div>
            )}
            {cronEntries.map(([k, v]) => (
              <label key={k} className="ea-field">
                <span className="ea-field-label">{k}</span>
                <input
                  className="ea-input ea-mono"
                  data-test={`ea36-cron-${k}`}
                  value={v}
                  onChange={(e) => setS({
                    ...s, cron: { ...s.cron, [k]: e.target.value },
                  })}
                  placeholder="0 */5 * * * ?"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="ea-form-section">
          <div className="ea-form-section-head">
            <h2>Feature flags</h2>
            <p>Experimental surfaces hidden by default. Enable only in
              development or pilot environments.</p>
          </div>
          <div className="ea-flag-list">
            {flagEntries.length === 0 && (
              <div className="ea-field-hint">No feature flags defined.</div>
            )}
            {flagEntries.map(([k, v]) => (
              <label key={k} className="ea-flag-row">
                <input
                  type="checkbox"
                  className="ea-switch"
                  data-test={`ea36-flag-${k}`}
                  checked={v}
                  onChange={(e) => setS({
                    ...s, featureFlags: { ...s.featureFlags, [k]: e.target.checked },
                  })}
                />
                <span className="ea-flag-name">{k}</span>
                <span className={'ea-chip ea-chip--' + (v ? 'success' : 'neutral')}>
                  {v ? 'on' : 'off'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <InternetSimulatePreference />
      </section>
    </div>
  );
}

/** §2.3.74 — operator-controlled mode for the Internet node's
 *  simulator on the Workspace topology. Persisted locally via
 *  simulateStore; dashboard reacts live. */
function InternetSimulatePreference(): JSX.Element {
  const mode = useSyncExternalStore(subscribeSimulateMode, getSimulateMode);
  const options: Array<{ v: SimulateMode; label: string; hint: string }> = [
    { v: 'auto', label: 'Auto',
      hint: 'Simulate only when DHIS2 Central is a local URL (dev/CI).' },
    { v: 'on', label: 'Always on',
      hint: 'Always cycle the Internet state — useful for walkthroughs.' },
    { v: 'off', label: 'Off',
      hint: 'Never simulate — show the live server probe truthfully.' },
  ];
  return (
    <div className="ea-form-section">
      <div className="ea-form-section-head">
        <h2>Demo &amp; simulation</h2>
        <p>Internet simulator on the Workspace topology. When engaged
          the Internet node cycles ON/OFF on a random schedule
          (up 25–60 s, down 6–15 s) to depict the edge-first
          offline-capable behaviour on dev or demo rigs where DHIS2
          Central is co-located with DER.</p>
      </div>
      <div className="ea-flag-list" role="radiogroup"
           aria-label="Internet simulator mode">
        {options.map((opt) => (
          <label key={opt.v} className="ea-flag-row">
            <input
              type="radio"
              name="internet-sim-mode"
              value={opt.v}
              data-test={`ea36-sim-${opt.v}`}
              checked={mode === opt.v}
              onChange={() => setSimulateMode(opt.v)}
            />
            <span className="ea-flag-name">{opt.label}</span>
            <span className="ea-field-hint" style={{ marginLeft: 8 }}>
              {opt.hint}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
