import { useEffect, useState } from 'react';
import * as edgeApi from '../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../components/ScreenStates';

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
  return (
    <div className="ea-screen">
      <h1 data-test="ea31-heading">Installed apps</h1>
      {rows.length === 0 ? (
        <EmptyBlock title="No installed apps" testId="ea31-empty">
          Install a custom DHIS2 app via the install dialog.
        </EmptyBlock>
      ) : (
        <table><thead><tr><th>App</th><th>Version</th><th>State</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.appId}>
              <td data-test={`ea31-app-${r.appId}`}>{r.displayName} ({r.appKey})</td>
              <td>{r.version}</td>
              <td data-test={`ea31-state-${r.appId}`}>{r.enabled ? 'enabled' : 'disabled'}</td>
              <td>
                <button type="button" data-test={`ea31-toggle-${r.appId}`}
                        onClick={() => { toggle(r).catch(() => undefined); }}>
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button type="button" data-test={`ea31-delete-${r.appId}`}
                        onClick={() => { remove(r).catch(() => undefined); }}>
                  Uninstall
                </button>
              </td>
            </tr>
          ))}</tbody></table>
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
        {Object.entries(d.journalBacklog).map(([k, v]) => (
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
  return (
    <div className="ea-screen">
      <h1 data-test="ea36-heading">Settings</h1>
      <section>
        <h2>Cron overrides</h2>
        <ul>
          {Object.entries(s.cron).map(([k, v]) => (
            <li key={k}>
              <label><span>{k}</span>
                <input data-test={`ea36-cron-${k}`} value={v}
                       onChange={(e) => setS({
                         ...s, cron: { ...s.cron, [k]: e.target.value },
                       })} /></label>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Feature flags</h2>
        <ul>
          {Object.entries(s.featureFlags).map(([k, v]) => (
            <li key={k}>
              <label><input type="checkbox" data-test={`ea36-flag-${k}`} checked={v}
                            onChange={(e) => setS({
                              ...s, featureFlags: { ...s.featureFlags, [k]: e.target.checked },
                            })} /> {k}</label>
            </li>
          ))}
        </ul>
      </section>
      <button type="button" data-test="ea36-save" disabled={status === 'saving'}
              onClick={() => { doSave().catch(() => undefined); }}>Save</button>
      {status === 'saved' && <p data-test="ea36-saved">Settings saved.</p>}
      {status === 'error' && error && (
        <ErrorBlock title="Save failed" testId="ea36-save-error">{error}</ErrorBlock>
      )}
    </div>
  );
}
