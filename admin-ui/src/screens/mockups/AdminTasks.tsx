import { useEffect, useState } from 'react';
import * as edgeApi from '../../api/edgeApi';
import { Panel, KpiTile, fmtAgo, fmtDur, fmtBytes } from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * MockupAdminTasks — ADMIN-only lifecycle + control-plane page.
 *
 * Surfaces the destructive operations an on-site admin may need to run
 * without opening a shell on the host:
 *
 *   - Shutdown DER (graceful JVM exit)
 *   - Restart DER (shutdown + sentinel file for the host supervisor)
 *   - Clear all active sessions (force everyone to sign in again)
 *   - Reload DHIS2 connection config (no-op; just signals the UI)
 *   - Tail the server log file
 *
 * Each destructive button opens a confirm dialog that requires an
 * explicit secondary click. All actions are POST-only and gated by
 * {@code hasRole('ADMIN')} on the server.
 */
export function MockupAdminTasks(): JSX.Element {
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | 'shutdown' | 'restart' | 'clear-sessions'>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<edgeApi.LifecycleLogs | null>(null);
  const [logLines, setLogLines] = useState(200);

  async function reload(): Promise<void> {
    try { setSi(await edgeApi.systemInfo()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function run(label: string, fn: () => Promise<edgeApi.LifecycleAck>): Promise<void> {
    setBusy(label); setErr(null); setMsg(null);
    try {
      const r = await fn();
      let text = `${label}: ${r.status}`;
      if (r.sessionsRevoked != null) text += ` · ${r.sessionsRevoked} session${r.sessionsRevoked === 1 ? '' : 's'} revoked`;
      if (r.note) text += ` · ${r.note}`;
      setMsg(text);
      setConfirm(null);
    } catch (e) {
      // Shutdown / restart drop the connection — treat ECONNABORTED as success.
      const em = e instanceof Error ? e.message : String(e);
      if (/EDGE_UNREACHABLE|aborted|network|socket/i.test(em)) {
        setMsg(`${label}: process is exiting — server will stop responding momentarily.`);
      } else {
        setErr(em);
      }
    } finally {
      setBusy(null);
    }
  }

  async function tail(): Promise<void> {
    setBusy('logs'); setErr(null);
    try { setLogs(await edgeApi.adminLogs(logLines)); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }

  if (!si) return <LoadingBlock testId="loading" />;

  const uptime = fmtDur(si.runtime.uptimeMillis);
  const heap = si.runtime.heapMaxBytes
    ? Math.round((100 * (si.runtime.heapUsedBytes ?? 0)) / si.runtime.heapMaxBytes) : 0;
  const sessions = si.database.sessionCount ?? 0;

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Workspace</div>
          <h1 className="ea-dash-hero-title">Admin tasks</h1>
          <p className="ea-dash-hero-sub">
            Destructive operations that affect the running edge: service
            lifecycle, session invalidation, config reload, and recent log
            output. ADMIN only.
          </p>
        </div>
      </section>

      {msg && <p className="ea-saved">{msg}</p>}
      {err && <ErrorBlock title="Action failed" testId="err-admin">{err}</ErrorBlock>}

      <div className="ea-kpi-grid">
        <KpiTile tone="info" label="Uptime" value={uptime} caption={`JVM pid snapshot`} />
        <KpiTile tone="info" label="Heap used" value={`${heap}%`}
                 caption={`${fmtBytes(si.runtime.heapUsedBytes)} / ${fmtBytes(si.runtime.heapMaxBytes)}`} />
        <KpiTile tone="info" label="DB sessions" value={sessions}
                 caption="revokable via Clear sessions" />
        <KpiTile tone={si.scheduler.started ? 'success' : 'warning'}
                 label="Scheduler" value={si.scheduler.started ? 'running' : 'standby'}
                 caption={`${si.scheduler.executingJobs ?? 0} / ${si.scheduler.totalJobs ?? 0}`} />
      </div>

      <Panel title="Service control">
        <p className="ea-text-muted" style={{ margin: '0 0 12px' }}>
          Shutdown exits the DER process cleanly. Restart writes a sentinel
          file so a host supervisor (systemd, launchd, Docker restart-policy)
          respawns the process. If no supervisor is configured, Restart is
          equivalent to Shutdown + manual start.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {confirm === 'shutdown' ? (
            <>
              <button type="button" className="ea-btn ea-btn--ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="ea-btn ea-btn--primary ea-btn--danger"
                      disabled={busy === 'Shutdown'}
                      onClick={() => { run('Shutdown', edgeApi.adminShutdown).catch(() => undefined); }}>
                Yes, shut down DER
              </button>
            </>
          ) : (
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                    onClick={() => setConfirm('shutdown')}>
              Shut down
            </button>
          )}

          {confirm === 'restart' ? (
            <>
              <button type="button" className="ea-btn ea-btn--ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="ea-btn ea-btn--primary"
                      disabled={busy === 'Restart'}
                      onClick={() => { run('Restart', edgeApi.adminRestart).catch(() => undefined); }}>
                Yes, restart DER
              </button>
            </>
          ) : (
            <button type="button" className="ea-btn ea-btn--primary"
                    onClick={() => setConfirm('restart')}>
              Restart
            </button>
          )}
        </div>
      </Panel>

      <Panel title="Sessions">
        <p className="ea-text-muted" style={{ margin: '0 0 12px' }}>
          Revoke every active DER_SESSION. Operators and other admins (including you)
          will be forced to sign in again. Useful after rotating a shared credential.
        </p>
        {confirm === 'clear-sessions' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ea-btn ea-btn--ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--danger"
                    disabled={busy === 'Clear sessions'}
                    onClick={() => { run('Clear sessions', edgeApi.adminClearSessions).catch(() => undefined); }}>
              Yes, revoke all sessions
            </button>
          </div>
        ) : (
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--danger"
                  onClick={() => setConfirm('clear-sessions')}>
            Clear all sessions
          </button>
        )}
      </Panel>

      <Panel title="Configuration">
        <p className="ea-text-muted" style={{ margin: '0 0 12px' }}>
          DER reads the editable DHIS2 connection config on every outbound call,
          so settings saved on the Connection page take effect immediately.
          This button is a no-op signal — handy as a smoke test.
        </p>
        <button type="button" className="ea-btn ea-btn--primary"
                disabled={busy === 'Reload DHIS2 config'}
                onClick={() => { run('Reload DHIS2 config', edgeApi.adminReloadDhis2Config).catch(() => undefined); }}>
          Reload DHIS2 config
        </button>
      </Panel>

      <Panel title="Recent server log"
             action={
               <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                 <label style={{ fontSize: 12, color: 'var(--der-ink-400)' }}>
                   Lines{' '}
                   <input type="number" className="ea-input ea-mono" style={{ maxWidth: 80 }}
                          min={10} max={2000} value={logLines}
                          onChange={(e) => setLogLines(Math.max(1, Math.min(2000, Number(e.target.value) || 200)))} />
                 </label>
                 <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                         disabled={busy === 'logs'}
                         onClick={() => { tail().catch(() => undefined); }}>
                   {busy === 'logs' ? 'Loading…' : 'Load'}
                 </button>
               </div>
             }>
        {!logs ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            Click Load to tail the server log file.
          </p>
        ) : logs.status !== 'OK' ? (
          <p className="ea-text-muted" style={{ margin: 0 }}>
            {logs.status === 'NO_LOG_FILE'
              ? `No log file at ${logs.path}. Pass -Dder.lifecycle.log-path=... when starting DER to point this at the real log.`
              : `Could not read ${logs.path}: ${logs.error ?? 'unknown error'}`}
          </p>
        ) : (
          <>
            <div className="ea-text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
              {logs.path} · showing last {logs.entries.length} of {logs.totalLines ?? '—'} lines · fetched {fmtAgo(new Date().toISOString())}
            </div>
            <pre className="ea-log-tail" aria-label="server log tail">{logs.entries.join('\n')}</pre>
          </>
        )}
      </Panel>
    </div>
  );
}
