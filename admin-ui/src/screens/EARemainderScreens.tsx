import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';
import { HeroHeader } from '../components/HeroHeader';
import { UiIcon } from '../components/UiIcon';

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
  const [status, setStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  async function run(name: string, fn: () => Promise<unknown>): Promise<void> {
    setStatus({ ...status, [name]: 'running' });
    setError(null);
    try {
      await fn();
      setStatus({ ...status, [name]: 'done' });
    } catch (err) {
      setStatus({ ...status, [name]: 'error' });
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  return (
    <div className="ea-screen">
      <h1 data-test="ea19-heading">Recovery tools</h1>
      {error && <ErrorBlock title="Recovery op failed" testId="ea19-error">{error}</ErrorBlock>}
      <ul>
        <li>
          <button type="button" data-test="ea19-metadata-resync"
                  onClick={() => { run('metadata', () => api.triggerJob('METADATA_SYNC_FULL'))
                    .catch(() => undefined); }}>
            Trigger metadata resync
          </button>
          <span data-test="ea19-metadata-status">{status.metadata ?? 'idle'}</span>
        </li>
        <li>
          <button type="button" data-test="ea19-drift-refresh"
                  onClick={() => { run('drift', () => api.drift(true))
                    .catch(() => undefined); }}>
            Re-run drift
          </button>
          <span data-test="ea19-drift-status">{status.drift ?? 'idle'}</span>
        </li>
        <li>
          <button type="button" data-test="ea19-conflicts-refresh"
                  onClick={() => { run('conflicts', () => api.listConflicts())
                    .catch(() => undefined); }}>
            Refresh conflict list
          </button>
          <span data-test="ea19-conflicts-status">{status.conflicts ?? 'idle'}</span>
        </li>
      </ul>
    </div>
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
  return (
    <div className="ea-screen">
      <h1 data-test="ea35-heading">Diagnostics</h1>
      <dl>
        <dt>Memory (MiB)</dt><dd data-test="ea35-mem">{d.memoryMb}</dd>
        <dt>Uptime (s)</dt><dd data-test="ea35-uptime">{d.uptimeSeconds}</dd>
        <dt>Quartz backlog</dt><dd data-test="ea35-scheduler">{d.schedulerBacklog}</dd>
      </dl>
      <ul data-test="ea35-journal">
        {Object.entries(d.journalBacklog ?? {}).map(([k, v]) => (
          <li key={k}>
            <span data-test={`ea35-journal-${k}`}>{k}: {v}</span>
          </li>
        ))}
      </ul>
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
      </section>
    </div>
  );
}
