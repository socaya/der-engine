import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  Panel, Donut, Dot, fmtDate, fmtAgo, fmtBytes,
} from './shared';
import { TopologyCanvas } from '../components/network/TopologyCanvas';
import { useMeshTopology } from '../components/network/useMeshTopology';
import type { SelectedNode } from '../components/network/types';
import { ErrorBlock, LoadingBlock } from '../components/ScreenStates';

/**
 * MockupWorkspace — the single Workspace landing page.
 *
 * Replaces the old `/` (SystemOverview) + `/dashboard` (DER Server
 * Operations) duplication with one professional dashboard that
 * combines the best of docs/media/ui/DER DHIS2 Edge Runtime System
 * Overview.png and docs/media/ui/DER Server Operations Dashboard.png.
 *
 * Layout:
 *   1. Welcome hero with build/status
 *   2. 5 KPI tiles — service status, DHIS2 connection, local database,
 *      synchronisation, client devices
 *   3. Topology (DHIS2 → DER → clients) + Resource usage rings
 *   4. Sync activity (24h chart) + Conflict review (priorities)
 *   5. System components list + Recent activity timeline
 *   6. Client devices + Edge workflows + Storage health
 *
 * Every stat comes from live /edge-api/v1 endpoints — no mocks.
 */
export function MockupWorkspace(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Date | null>(null);
  const [meshSel, setMeshSel] = useState<SelectedNode | null>(null);
  const mesh = useMeshTopology(30000);

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
      const first = r.find((x) => x.status === 'rejected');
      if (first && first.status === 'rejected') {
        setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
      }
    });
  }, []);

  if (!h || !si) return <LoadingBlock testId="loading" />;

  // ── Derived state ──────────────────────────────────────────────
  const dhis2Up = c?.probeReachable === true;
  // The /system/info response reports product + migrationCount when the
  // DB is live. The old `configured && !probeError` check referenced
  // fields that aren't on the response and always failed closed.
  const dbUp = Boolean(si.database.product) && (si.database.migrationCount ?? 0) > 0;
  const schedUp = si.scheduler.started === true;
  // Conflict count for the attention chip (details live under /journal/conflicts).
  const totalConflicts = (conflicts ?? []).length;
  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : 100;
  const activeWf = (wfs ?? []).filter((x) => x.enabled).length;

  // DER's /system/health reports `starter-ready` when the service is live
  // (see SystemHealthResponse). Keep `UP` as a synonym for forwards
  // compatibility with legacy actuator snapshots.
  const derUp = h.status === 'UP' || h.status === 'starter-ready' || h.status === 'ready';
  const derStatusLabel = derUp ? 'Live' : h.status;
  const allOps = derUp && dhis2Up && dbUp && schedUp;

  return (
    <div className="ea-screen">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Welcome back</div>
          <h1 className="ea-dash-hero-title">DER Server</h1>
          <p className="ea-dash-hero-sub">
            DHIS2 Edge Runtime for resilient data capture,
            synchronisation and analytics.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + (allOps ? 'success' : derUp ? 'warning' : 'danger')}>
              {allOps ? 'All systems operational'
                : !derUp ? derStatusLabel : 'Partial outage'}
            </span>
            <span className="ea-dash-hero-meta-item">v{si.build.version}</span>
            <span className="ea-dash-hero-meta-item">Sync reliability {reliability}%</span>
            {totalConflicts > 0 && (
              <Link to="/journal/conflicts"
                     className="ea-chip ea-chip--warning"
                     style={{ textDecoration: 'none' }}>
                {totalConflicts} conflict{totalConflicts === 1 ? '' : 's'}
              </Link>
            )}
            {t && <span className="ea-dash-hero-meta-item">updated {fmtAgo(t.toISOString())}</span>}
            <span className="ea-dash-hero-meta-item">{fmtDate(si.timestamp)}</span>
          </div>
        </div>
        <div className="ea-dash-hero-topology-mini" aria-hidden="true">
          <svg width="180" height="60" viewBox="0 0 180 60" fill="none">
            <rect x="4" y="18" width="40" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <path d="M46 30h30" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <rect x="78" y="12" width="46" height="36" rx="6" stroke="currentColor" strokeWidth="1.75" />
            <path d="M126 30h30" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <rect x="158" y="22" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            <text x="24" y="34" fontSize="7" textAnchor="middle" fill="currentColor" opacity="0.6">DHIS2</text>
            <text x="101" y="32" fontSize="8" textAnchor="middle" fill="currentColor" fontWeight="600">DER</text>
            <text x="167" y="32" fontSize="7" textAnchor="middle" fill="currentColor" opacity="0.6">CLI</text>
          </svg>
        </div>
      </section>

      {err && <ErrorBlock title="Partial load" testId="err-workspace">{err}</ErrorBlock>}

      {/* ─── Mesh topology (modern) ──────────────────────────── */}
      <Panel title="Topology"
             action={<Link to="/network/mesh" className="ea-link-btn">View full mesh</Link>}>
        {mesh.topology ? (
          <div className="ea-ws-mesh" data-test="ws-mesh">
            <TopologyCanvas
              der={mesh.topology.der}
              wan={mesh.topology.wan}
              devices={mesh.topology.devices}
              peers={mesh.topology.peers}
              connections={mesh.topology.connections}
              selected={meshSel}
              onSelect={setMeshSel} />
          </div>
        ) : (
          <p className="ea-text-muted" style={{ padding: 16, textAlign: 'center' }}>
            {mesh.loading ? 'Loading topology…'
              : mesh.error ? `Topology unavailable (${mesh.error})`
              : 'No topology data yet.'}
          </p>
        )}
      </Panel>

      {/* ─── Row: Devices + Workflows + Storage pie ────────────── */}
      <div className="ea-ws-grid-3">
        <Panel title="Client devices"
               action={<Link to="/devices" className="ea-link-btn">All</Link>}>
          {(devices ?? []).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>No devices enrolled.</p>
          ) : (
            <ul className="ea-dash-device-list">
              {(devices ?? []).slice(0, 5).map((d) => (
                <li key={d.deviceId}>
                  <Dot tone={d.status === 'APPROVED' ? 'success' : d.status === 'PENDING' ? 'warning' : 'danger'} />
                  <div>
                    <div className="ea-mono">{d.displayName ?? d.deviceId.slice(0, 8) + '…'}</div>
                    <div className="ea-dash-activity-meta">{d.status} · {fmtAgo(d.lastSeenAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Edge workflows"
               action={<Link to="/workflows" className="ea-link-btn">All</Link>}>
          <div className="ea-dash-conflict-total" style={{ fontSize: 24 }}>{activeWf}<span style={{ color: 'var(--der-ink-400)', fontSize: 11, marginLeft: 6, fontWeight: 500 }}>of {(wfs ?? []).length}</span></div>
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

        <Panel title="Storage"
               action={<Link to="/monitoring/storage" className="ea-link-btn">Details</Link>}>
          {(() => {
            const total  = si.storage.totalBytes ?? 0;
            const files  = si.storage.derDataRootBytes ?? 0;
            const dbSz   = si.storage.derDbSchemaBytes ?? 0;
            const free   = si.storage.usableBytes ?? 0;
            const other  = Math.max(0, total - files - dbSz - free);
            return (
              <Donut
                size={128}
                thickness={18}
                caption={<div><strong>{fmtBytes(files + dbSz)}</strong>
                             <div style={{ fontSize: 10, color: 'var(--der-ink-500)' }}>DER footprint</div></div>}
                slices={[
                  { label: `DER files · ${fmtBytes(files)}`, value: files,
                    color: 'var(--der-primary, #1d4ed8)' },
                  { label: `PostgreSQL (der.*) · ${fmtBytes(dbSz)}`, value: dbSz,
                    color: 'var(--der-teal, #0d9488)' },
                  { label: `Other on volume · ${fmtBytes(other)}`, value: other,
                    color: 'var(--der-warning, #d97706)' },
                  { label: `Free · ${fmtBytes(free)}`, value: free,
                    color: 'var(--der-border-strong, #cbd5e1)' },
                ]} />
            );
          })()}
        </Panel>
      </div>
    </div>
  );
}

