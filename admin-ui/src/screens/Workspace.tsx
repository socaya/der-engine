import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, Dot, fmtAgo, fmtBytes, humaniseJob,
} from './shared';
import { useRuntimeStatus } from '../components/RuntimeStatusProvider';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * Overview — the DER Admin landing page.
 *
 * This is the first screen any administrator or examiner lands on,
 * so it must answer five questions in one glance:
 *
 *   1. Is the local DER server running?
 *   2. Can local users continue capturing data?
 *   3. Is Central DHIS2 reachable right now?
 *   4. Is any data waiting to be synchronised?
 *   5. Does any record need review?
 *
 * The earlier revision answered these via a full topology canvas,
 * resource donut and multiple KPI rows on this one screen. Those
 * heavyweight widgets are still available on their own canonical
 * screens (Network topology, Storage, Devices, Workflows). This
 * Overview now only renders the compact answers and links to the
 * detail screens — one owner per metric, no competing full tables
 * on the landing page.
 *
 * Loading gate — the pre-rework code did `if (!h || !si) return
 * <LoadingBlock />`, which hangs indefinitely whenever either of the
 * two authoritative probes fails. We now separately track the
 * `settled` flag: once Promise.allSettled resolves we always render
 * the shell, substituting `Unknown` for any slot whose probe failed.
 */
export function Workspace(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Date | null>(null);
  const [settled, setSettled] = useState(false);
  const runtime = useRuntimeStatus();

  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.listJobs(100),
      edgeApi.listConflicts(50),
      edgeApi.listDevices(), edgeApi.listWorkflows(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[2].status === 'fulfilled') setC(r[2].value);
      if (r[3].status === 'fulfilled') setJobs(r[3].value);
      if (r[4].status === 'fulfilled') setConflicts(r[4].value);
      if (r[5].status === 'fulfilled') setDevices(r[5].value.devices);
      if (r[6].status === 'fulfilled') setWfs(r[6].value.workflows);
      setT(new Date());
      setSettled(true);
      const first = r.find((x) => x.status === 'rejected');
      if (first && first.status === 'rejected') {
        setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
      }
    });
  }, []);

  if (!settled) return <LoadingBlock testId="loading" />;

  // ── Derived state ──────────────────────────────────────────────
  // DER's /system/health reports `starter-ready` when the service is
  // live (see SystemHealthResponse); UP + ready are legacy synonyms.
  const derUp = h ? (h.status === 'UP' || h.status === 'starter-ready' || h.status === 'ready') : null;
  const derStatusLabel = derUp === null
    ? 'Unknown'
    : derUp ? 'Running' : (h?.status ?? 'Unavailable');
  const derTone: 'success' | 'warning' | 'danger' | 'muted' = derUp === null
    ? 'muted' : derUp ? 'success' : 'danger';

  // Compatibility probe is authoritative for central reachability.
  // When the compat probe hasn't landed (null snapshot) we show
  // "Unknown" rather than defaulting to false → `Unreachable`.
  const dhis2Known = c != null;
  const dhis2Up = c?.probeReachable === true;
  const dhis2StatusLabel = !dhis2Known
    ? 'Unknown'
    : dhis2Up ? 'Reachable' : 'Unreachable';
  const dhis2Tone: 'success' | 'warning' | 'danger' | 'muted' = !dhis2Known
    ? 'muted' : dhis2Up ? 'success' : 'warning';

  // Local DB readiness — product + migrationCount tell us the
  // schema has booted at least once.
  const dbUp = si ? Boolean(si.database.product) && (si.database.migrationCount ?? 0) > 0 : null;
  const captureReady = derUp === true && dbUp === true;
  const captureLabel = captureReady === null
    ? 'Unknown'
    : captureReady ? 'Available' : 'Limited';
  const captureTone: 'success' | 'warning' | 'danger' | 'muted' = captureReady === null
    ? 'muted' : captureReady ? 'success' : 'warning';

  // Sync queue + attention aggregates.
  const totalConflicts = (conflicts ?? []).length;
  const schedStarted = si?.scheduler?.started === true;
  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : null;
  const activeWf = (wfs ?? []).filter((x) => x.enabled).length;

  // Storage numbers (no donut on Overview — link to /monitoring/storage).
  const storageTotal = si?.storage.totalBytes ?? 0;
  const storageFiles = si?.storage.derDataRootBytes ?? 0;
  const storageDb = si?.storage.derDbSchemaBytes ?? 0;
  const storageFree = si?.storage.usableBytes ?? 0;
  const storageUsed = storageFiles + storageDb;

  const approvedDevices = (devices ?? []).filter((d) => d.status === 'APPROVED');

  const allOps = derUp === true && dhis2Up && dbUp === true && schedStarted;
  const heroTone: 'success' | 'warning' | 'danger' = allOps
    ? 'success'
    : derUp === false ? 'danger' : 'warning';
  const heroLabel = allOps
    ? 'All systems operational'
    : derUp === false ? (h?.status ?? 'DEGRADED')
    : dhis2Known && !dhis2Up ? 'Central DHIS2 unreachable'
    : 'Partial outage';

  // Most recent sync outcomes (5 lines, link to /sync/history).
  const recentJobs = (jobs ?? []).slice(0, 5);

  return (
    <div className="ea-screen" data-test="workspace-overview">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <h1 className="ea-dash-hero-title">DER Server</h1>
          <p className="ea-dash-hero-sub">
            Local data capture and synchronisation with Central DHIS2.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + heroTone}>{heroLabel}</span>
            {si && <span className="ea-dash-hero-meta-item">v{si.build.version}</span>}
            {reliability != null && (
              <span
                className="ea-dash-hero-meta-item"
                title={`Successful job runs in the last ${totalRuns} tracked runs.`}
              >
                Recent sync success {reliability}% ({totalRuns} runs)
              </span>
            )}
            {totalConflicts > 0 && (
              <Link
                to="/journal/conflicts"
                className="ea-chip ea-chip--warning"
                style={{ textDecoration: 'none' }}
              >
                {totalConflicts} conflict{totalConflicts === 1 ? '' : 's'}
              </Link>
            )}
            {t && <span className="ea-dash-hero-meta-item">updated {fmtAgo(t.toISOString())}</span>}
          </div>
        </div>
      </section>

      {err && (
        <ErrorBlock title="Partial load" testId="err-workspace">
          {err}
        </ErrorBlock>
      )}

      {/* ─── Status row — the five questions, as a compact grid. ─── */}
      <div className="ea-ws-status-row" data-test="workspace-status-row">
        <StatusCell
          label="Local server"
          value={derStatusLabel}
          tone={derTone}
          detail={runtime.detail}
          to="/monitoring/health"
        />
        <StatusCell
          label="Local capture"
          value={captureLabel}
          tone={captureTone}
          detail={captureReady
            ? 'Local database and scheduler are up. Capture clients can submit data.'
            : 'Local database or scheduler is not ready — capture may be limited.'}
          to="/data"
        />
        <StatusCell
          label="Central DHIS2"
          value={dhis2StatusLabel}
          tone={dhis2Tone}
          detail={!dhis2Known
            ? 'Checking Central DHIS2 connection…'
            : dhis2Up
              ? `Central DHIS2 ${c?.centralVersion ?? ''} reachable.`
              : 'Central DHIS2 is unavailable. Local work continues; pending changes will retry.'}
          to="/dhis2/compat"
        />
        <StatusCell
          label="Sync queue"
          value={
            totalConflicts > 0
              ? `${totalConflicts} need review`
              : totalRuns === 0
                ? 'No recent runs'
                : 'No items waiting'
          }
          tone={totalConflicts > 0 ? 'warning' : 'success'}
          detail="Captured records awaiting synchronisation or conflict review."
          to={totalConflicts > 0 ? '/sync/attention' : '/sync'}
        />
      </div>

      {/* ─── One actionable attention area. ─── */}
      {totalConflicts > 0 && (
        <div className="ea-ws-attention" data-test="workspace-attention">
          <strong>{totalConflicts} record{totalConflicts === 1 ? '' : 's'} need{totalConflicts === 1 ? 's' : ''} review</strong>{' '}
          — conflicting changes must be resolved before they can be accepted centrally.{' '}
          <Link to="/sync/attention" className="ea-link-btn">Review conflicts</Link>
          {/* Preserve entity ref visibility for test probes and
           * operators who want to quickly see the first conflict. */}
          {conflicts && conflicts[0] && (
            <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              First: {conflicts[0].entityType} · {conflicts[0].entityRef}
            </div>
          )}
        </div>
      )}

      {/* ─── How DER works — four-step model, always visible. ─── */}
      <div className="ea-ws-steps" data-test="workspace-steps" aria-label="How DER works">
        <StepChip n={1} label="Capture locally" />
        <StepArrow />
        <StepChip n={2} label="Store safely" />
        <StepArrow />
        <StepChip n={3} label="Synchronise when connected" />
        <StepArrow />
        <StepChip n={4} label="Review conflicts if needed" />
      </div>

      {/* ─── Row: Recent sync activity + Quick actions ─────────── */}
      <div className="ea-ws-grid-2">
        <Panel
          title="Recent sync activity"
          action={<Link to="/sync/history" className="ea-link-btn">All runs</Link>}
        >
          {recentJobs.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>
              No sync runs recorded yet.
            </p>
          ) : (
            <ul className="ea-dash-activity-list">
              {recentJobs.map((j) => (
                <li key={j.runId}>
                  <Dot tone={j.outcome === 'SUCCEEDED' ? 'success' : j.outcome === 'FAILED' ? 'danger' : 'muted'} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{humaniseJob(j.jobName)}</span>
                    <span className="ea-dash-activity-meta">
                      {j.outcome} · {fmtAgo(j.startedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Common tasks">
          <ul className="ea-ws-quick-actions" data-test="workspace-quick-actions">
            <li>
              <Link to="/data" className="ea-link-btn">View captured data →</Link>
              <span className="ea-text-muted">Aggregate, events and tracker records on this server</span>
            </li>
            <li>
              <Link to="/sync" className="ea-link-btn">Check synchronisation →</Link>
              <span className="ea-text-muted">Pending, in progress, accepted and conflicts</span>
            </li>
            <li>
              <Link to="/devices" className="ea-link-btn">Manage devices →</Link>
              <span className="ea-text-muted">Registered clients and network peers</span>
            </li>
          </ul>
        </Panel>
      </div>

      {/* ─── Row: Devices + Workflows + Storage summary ─────────── */}
      <div className="ea-ws-grid-3">
        <Panel
          title="Client devices"
          action={<Link to="/devices" className="ea-link-btn">All</Link>}
        >
          {approvedDevices.length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>No approved devices yet.</p>
          ) : (
            <ul className="ea-dash-device-list">
              {approvedDevices.slice(0, 5).map((d) => (
                <li key={d.deviceId}>
                  <Dot tone="success" />
                  <div>
                    <div className="ea-mono">{d.displayName ?? d.deviceId.slice(0, 8) + '…'}</div>
                    <div className="ea-dash-activity-meta">{d.status} · {fmtAgo(d.lastSeenAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Workflows"
          action={<Link to="/workflows" className="ea-link-btn">All</Link>}
        >
          <div className="ea-dash-conflict-total" style={{ fontSize: 24 }}>
            {activeWf}
            <span
              style={{
                color: 'var(--der-ink-400)',
                fontSize: 11,
                marginLeft: 6,
                fontWeight: 500,
              }}
            >
              of {(wfs ?? []).length} active
            </span>
          </div>
          {(wfs ?? []).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: '8px 0 0' }}>No workflows defined.</p>
          ) : (
            <ul className="ea-dash-workflow-list">
              {(wfs ?? []).slice(0, 4).map((wf) => (
                <li key={wf.workflowId}>
                  <Dot tone={wf.enabled ? 'success' : 'muted'} />
                  <span>{wf.displayName}</span>
                  <span className="ea-text-muted">{wf.steps?.length ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Storage"
          action={<Link to="/monitoring/storage" className="ea-link-btn">Details</Link>}
        >
          {si ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {fmtBytes(storageUsed)}{' '}
                <span style={{ fontSize: 11, color: 'var(--der-ink-400)', fontWeight: 500 }}>
                  DER footprint
                </span>
              </div>
              <div className="ea-text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                Free on volume: {fmtBytes(storageFree)}
              </div>
              <div className="ea-text-muted" style={{ fontSize: 12 }}>
                Volume total: {fmtBytes(storageTotal)}
              </div>
            </>
          ) : (
            <p className="ea-text-muted" style={{ margin: 0 }}>Storage usage unavailable.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StatusCell(props: {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
  detail: string;
  to: string;
}): JSX.Element {
  return (
    <Link
      to={props.to}
      className={'ea-ws-status-cell ea-ws-status-cell--' + props.tone}
      title={props.detail}
      data-test={`status-cell-${props.label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <span className="ea-ws-status-cell-label">{props.label}</span>
      <span className="ea-ws-status-cell-value">
        <Dot tone={props.tone} />
        {props.value}
      </span>
    </Link>
  );
}

function StepChip({ n, label }: { n: number; label: string }): JSX.Element {
  return (
    <span className="ea-ws-step" aria-label={`Step ${n}: ${label}`}>
      <span className="ea-ws-step-n" aria-hidden="true">{n}</span>
      <span className="ea-ws-step-label">{label}</span>
    </span>
  );
}

function StepArrow(): JSX.Element {
  return (
    <span className="ea-ws-step-arrow" aria-hidden="true">→</span>
  );
}
