import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../api/edgeApi';
import {
  KpiTile, Panel, Ring, MiniBarChart, Dot, fmtDate, fmtAgo, fmtBytes, fmtDur,
} from './shared';
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
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [activity, setActivity] = useState<edgeApi.ActivityEntry[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [t, setT] = useState<Date | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.workerHealth(), edgeApi.listJobs(100),
      edgeApi.listConflicts(50), edgeApi.recentActivity(10),
      edgeApi.listDevices(), edgeApi.listWorkflows(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[2].status === 'fulfilled') setC(r[2].value);
      if (r[3].status === 'fulfilled') setW(r[3].value);
      if (r[4].status === 'fulfilled') setJobs(r[4].value);
      if (r[5].status === 'fulfilled') setConflicts(r[5].value);
      if (r[6].status === 'fulfilled') setActivity(r[6].value.entries);
      if (r[7].status === 'fulfilled') setDevices(r[7].value.devices);
      if (r[8].status === 'fulfilled') setWfs(r[8].value.workflows);
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
  const totalDevices = devices?.length ?? 0;
  const activeDevices = (devices ?? []).filter((d) => d.status === 'APPROVED').length;
  const backlog = w ? Object.values(w.backlog).reduce((a, b) => a + b, 0) : 0;

  // 24h sync bars
  const now = Date.now();
  const bars: Array<{ label: string; value: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    const count = (jobs ?? []).filter((j) => {
      const tt = Date.parse(j.startedAt);
      return tt >= start && tt < end;
    }).length;
    bars.push({ label: `${new Date(end).getHours()}h`, value: count });
  }
  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const failed = (jobs ?? []).filter((j) => j.outcome === 'FAILED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : 100;

  // Conflict priority buckets
  const high = (conflicts ?? []).filter((x) => x.attemptCount >= 5).length;
  const med = (conflicts ?? []).filter((x) => x.attemptCount >= 2 && x.attemptCount < 5).length;
  const low = (conflicts ?? []).filter((x) => x.attemptCount < 2).length;

  // Resource rings — DER actual footprint (data root + Postgres der.*)
  // against the volume total so operators see DER's cost, not host-OS
  // utilisation.
  const derFootprint = (si.storage.derDataRootBytes ?? 0)
      + (si.storage.derDbSchemaBytes ?? 0);
  const storagePct = si.storage.totalBytes
    ? Math.max(1, Math.round((100 * derFootprint) / si.storage.totalBytes)) : 0;
  const heapPct = si.runtime.heapMaxBytes
    ? Math.round((100 * (si.runtime.heapUsedBytes ?? 0)) / si.runtime.heapMaxBytes) : 0;
  const cpuPct = Math.min(100, Math.round(
    (si.scheduler.executingJobs ?? 0) / Math.max(1, si.scheduler.totalJobs ?? 1) * 100));

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
            <span className="ea-dash-hero-meta-item">{fmtDate(si.timestamp)}</span>
            {t && <span className="ea-dash-hero-meta-item">updated {fmtAgo(t.toISOString())}</span>}
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

      {/* ─── 5 KPIs row ───────────────────────────────────────── */}
      <div className="ea-kpi-grid">
        <KpiTile tone={derUp ? 'success' : 'danger'}
                 icon={<IconPulse />} label="DER status"
                 value={derStatusLabel}
                 caption={`uptime ${fmtDur(si.runtime.uptimeMillis)}`} />
        <KpiTile tone={dhis2Up ? 'success' : 'danger'}
                 icon={<IconPlug />} label="DHIS2"
                 value={dhis2Up ? 'Connected' : 'Unreachable'}
                 caption={c?.centralVersion ?? '—'} />
        <KpiTile tone={dbUp ? 'success' : 'danger'}
                 icon={<IconDatabase />} label="Local database"
                 value={dbUp ? 'Operational' : 'Degraded'}
                 caption={si.database.product?.split(' ').slice(0, 2).join(' ') ?? '—'} />
        <KpiTile tone={schedUp ? 'success' : 'warning'}
                 icon={<IconSync />} label="Synchronisation"
                 value={schedUp ? 'Running' : 'Standby'}
                 caption={`${backlog} queued`} />
        <KpiTile tone="info"
                 icon={<IconDevice />} label="Client devices"
                 value={totalDevices}
                 caption={`${activeDevices} active`} />
      </div>

      {/* ─── Row: Topology + Resource usage ──────────────────── */}
      <div className="ea-ws-grid-2">
        <Panel title="System topology">
          <div className="ea-topology">
            <TopoNode label="DHIS2 Central"
                      sub={c?.centralVersion ?? '—'}
                      tone={dhis2Up ? 'success' : 'danger'} />
            <TopoArrow />
            <TopoNode label="DER Server"
                      sub={`v${si.build.version}`}
                      tone={derUp ? 'success' : 'danger'} highlight />
            <TopoArrow />
            <TopoNode label="Clients"
                      sub={`${activeDevices} / ${totalDevices}`}
                      tone={activeDevices > 0 ? 'success' : 'muted'} />
          </div>
        </Panel>

        <Panel title="Resource usage">
          <div className="ea-dash-gauges">
            <div className="ea-dash-gauge"><Ring percent={cpuPct} label="Scheduler" size={72} color="var(--der-primary)" /></div>
            <div className="ea-dash-gauge"><Ring percent={heapPct} label="Memory" size={72} color="var(--der-teal)" /></div>
            <div className="ea-dash-gauge"><Ring percent={storagePct} label="DER footprint" size={72} color="var(--der-warning)" /></div>
          </div>
        </Panel>
      </div>

      {/* ─── Row: Sync activity + Conflict review ────────────── */}
      <div className="ea-ws-grid-2">
        <Panel title="Synchronisation activity"
               action={<Link to="/sync/jobs" className="ea-link-btn">View all</Link>}>
          <MiniBarChart bars={bars} />
          <div className="ea-dash-sync-stats">
            <div><strong>{totalRuns}</strong><span>Runs</span></div>
            <div><strong>{succeeded}</strong><span>Succeeded</span></div>
            <div><strong>{failed}</strong><span>Failed</span></div>
            <div><strong>{reliability}%</strong><span>Reliability</span></div>
          </div>
        </Panel>

        <Panel title="Conflict review"
               action={<Link to="/journal/conflicts" className="ea-link-btn">View all</Link>}>
          <PriorityBreakdown total={(conflicts ?? []).length}
                             high={high} medium={med} low={low} />
        </Panel>
      </div>

      {/* ─── Row: System components + Recent activity ────────── */}
      <div className="ea-ws-grid-2">
        <Panel title="System components"
               action={<Link to="/system/information" className="ea-link-btn">Details</Link>}>
          <ul className="ea-components-list ea-components-list--grid">
            <ComponentRow name="DER Server" version={`v${si.build.version}`} status="OK" meta={fmtDur(si.runtime.uptimeMillis)} />
            <ComponentRow name="DHIS2 central" version={si.dhis2.centralVersion ?? '—'} status={dhis2Up ? 'OK' : 'FAIL'} meta={dhis2Up ? 'reachable' : 'unreachable'} />
            <ComponentRow name="PostgreSQL" version={(si.database.product ?? '').split(' ')[1] ?? '—'} status={dbUp ? 'OK' : 'FAIL'} meta={`${si.database.migrationCount ?? 0} migrations`} />
            <ComponentRow name="Scheduler" version={`${si.scheduler.totalJobs ?? 0} jobs`} status={schedUp ? 'OK' : 'WARN'} meta={`${si.scheduler.executingJobs ?? 0} running`} />
            <ComponentRow name="Compat engine" version={c?.profileName ?? '—'} status={c?.probeReachable ? 'OK' : 'FAIL'} meta={c?.engineVersion ?? '—'} />
            <ComponentRow name="Journal worker" version={w?.enabled ? 'running' : 'paused'} status={w?.enabled ? 'OK' : 'WARN'} meta={`${backlog} queued`} />
            <ComponentRow name="Custom apps" version={`${si.apps.installed ?? 0} installed`} status="OK" meta={`${si.apps.enabled ?? 0} enabled`} />
          </ul>
        </Panel>

        <Panel title="Recent activity"
               action={<Link to="/audit/events" className="ea-link-btn">View all</Link>}>
          {(activity ?? []).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>No activity recorded yet.</p>
          ) : (
            <ul className="ea-dash-activity-list">
              {dedupeActivity(activity ?? []).slice(0, 5).map((a) => (
                <li key={`${a.first.auditId}-${a.count}`}>
                  <Dot tone={a.first.outcome === 'SUCCESS' ? 'success' : a.first.outcome === 'FAILURE' ? 'danger' : 'muted'} />
                  <div>
                    <div className="ea-dash-activity-type">
                      {a.first.eventType}
                      {a.count > 1 && <span className="ea-text-muted" style={{ marginLeft: 6 }}>· ×{a.count}</span>}
                    </div>
                    <div className="ea-dash-activity-meta">
                      {a.first.outcome} · {fmtAgo(a.last.observedAt)}
                      {a.count > 1 && <> → {fmtAgo(a.first.observedAt)}</>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ─── Row: Devices + Workflows + Storage health ───────── */}
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
                    <div className="ea-mono">{d.deviceId.slice(0, 8)}…</div>
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

        <Panel title="Database &amp; storage">
          <ul className="ea-components-list">
            <li>
              <Dot tone={si.database.probeError ? 'danger' : 'success'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Database</div>
                <div className="ea-components-meta">{si.database.product?.split(' ').slice(0, 2).join(' ') ?? '—'}</div>
              </div>
              <div className="ea-components-version ea-mono">{si.database.migrationCount ?? 0} mig</div>
            </li>
            <li>
              <Dot tone={si.storage.status === 'OK' ? 'success' : si.storage.status === 'WARN' ? 'warning' : 'danger'} />
              <div className="ea-components-main">
                <div className="ea-components-name">Edge data root</div>
                <div className="ea-components-meta ea-mono" style={{ wordBreak: 'break-all' }}>{si.storage.root ?? '—'}</div>
              </div>
              <div className="ea-components-version">{fmtBytes(si.storage.usableBytes)}</div>
            </li>
            <li>
              <Dot tone="muted" />
              <div className="ea-components-main">
                <div className="ea-components-name">Journal entries</div>
                <div className="ea-components-meta">by kind</div>
              </div>
              <div className="ea-components-version">
                {Object.values(si.journal ?? {}).reduce((a, b) => a + (b as number), 0).toLocaleString()}
              </div>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

interface ActivityGroup {
  first: edgeApi.ActivityEntry;
  last: edgeApi.ActivityEntry;
  count: number;
}
function dedupeActivity(items: ReadonlyArray<edgeApi.ActivityEntry>): ActivityGroup[] {
  const out: ActivityGroup[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && prev.first.eventType === it.eventType && prev.first.outcome === it.outcome) {
      prev.last = it;
      prev.count += 1;
    } else {
      out.push({ first: it, last: it, count: 1 });
    }
  }
  return out;
}

function PriorityBreakdown({ total, high, medium, low }: {
  total: number; high: number; medium: number; low: number;
}): JSX.Element {
  const safeTotal = Math.max(1, total);
  const hp = (100 * high) / safeTotal;
  const mp = (100 * medium) / safeTotal;
  const lp = (100 * low) / safeTotal;
  return (
    <div className="ea-prio">
      <div className="ea-prio-head">
        <strong>{total.toLocaleString()}</strong>
        <span className="ea-prio-head-label">pending conflicts</span>
      </div>
      <div className="ea-prio-track" aria-hidden="true">
        <div className="ea-prio-seg ea-prio-seg--high"   style={{ width: `${hp}%` }} />
        <div className="ea-prio-seg ea-prio-seg--medium" style={{ width: `${mp}%` }} />
        <div className="ea-prio-seg ea-prio-seg--low"    style={{ width: `${lp}%` }} />
      </div>
      <ul className="ea-prio-legend">
        <li><span className="ea-prio-dot ea-prio-dot--high"   /> High priority <strong>{high}</strong></li>
        <li><span className="ea-prio-dot ea-prio-dot--medium" /> Medium priority <strong>{medium}</strong></li>
        <li><span className="ea-prio-dot ea-prio-dot--low"    /> Low priority <strong>{low}</strong></li>
      </ul>
    </div>
  );
}

function ComponentRow({ name, version, status, meta }: {
  name: string; version: string; status: 'OK' | 'WARN' | 'FAIL'; meta: string;
}): JSX.Element {
  const tone = status === 'OK' ? 'success' : status === 'WARN' ? 'warning' : 'danger';
  return (
    <li>
      <Dot tone={tone} />
      <div className="ea-components-main">
        <div className="ea-components-name">{name}</div>
        <div className="ea-components-meta">{meta}</div>
      </div>
      <div className="ea-components-version ea-mono">{version}</div>
    </li>
  );
}

function TopoNode({ label, sub, tone, highlight }: {
  label: string; sub: string;
  tone: 'success' | 'warning' | 'danger' | 'muted'; highlight?: boolean;
}): JSX.Element {
  return (
    <div className={'ea-topo-node' + (highlight ? ' ea-topo-node--highlight' : '')}>
      <div className="ea-topo-label">{label}</div>
      <div className="ea-topo-sub">{sub}</div>
      <Dot tone={tone} />
    </div>
  );
}
function TopoArrow(): JSX.Element {
  return (
    <div className="ea-topo-arrow" aria-hidden="true">
      <svg width="48" height="20" viewBox="0 0 48 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 10h40M38 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function IconPulse(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h4l3-9 6 18 3-9h4" /></svg>); }
function IconPlug(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v4M15 2v4" /><path d="M7 6h10v4a5 5 0 01-10 0V6z" /><path d="M12 15v7" /></svg>); }
function IconDatabase(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>); }
function IconSync(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0113-6.3L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 01-13 6.3L4 16" /><path d="M4 20v-4h4" /></svg>); }
function IconDevice(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5" /><path d="M11 18h2" /></svg>); }
