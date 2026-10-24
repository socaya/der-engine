import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  KpiTile, Panel, Ring, MiniBarChart, Dot, fmtDate, fmtAgo, fmtBytes,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** DER System Overview — matches docs/media/ui/DER DHIS2 Edge Runtime System Overview.png */
export function MockupSystemOverview(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [wfs, setWfs] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [activity, setActivity] = useState<edgeApi.ActivityEntry[] | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.workerHealth(), edgeApi.listJobs(50), edgeApi.listDevices(),
      edgeApi.listWorkflows(), edgeApi.recentActivity(10),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[2].status === 'fulfilled') setC(r[2].value);
      if (r[3].status === 'fulfilled') setW(r[3].value);
      if (r[4].status === 'fulfilled') setJobs(r[4].value);
      if (r[5].status === 'fulfilled') setDevices(r[5].value.devices);
      if (r[6].status === 'fulfilled') setWfs(r[6].value.workflows);
      if (r[7].status === 'fulfilled') setActivity(r[7].value.entries);
    });
  }, []);

  if (!h || !si) return <LoadingBlock testId="loading" />;

  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : 0;
  const backlog = w ? Object.values(w.backlog).reduce((a, b) => a + b, 0) : 0;
  const activeDevices = (devices ?? []).filter((d) => d.status === 'APPROVED').length;
  const totalDevices = (devices ?? []).length;
  const activeWf = (wfs ?? []).filter((x) => x.enabled).length;
  const allOps = h.status === 'UP' && c?.probeReachable;

  // bars
  const now = Date.now();
  const bars: Array<{ label: string; value: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    const count = (jobs ?? []).filter((j) => {
      const t = Date.parse(j.startedAt);
      return t >= start && t < end;
    }).length;
    bars.push({ label: `${new Date(end).getHours()}h`, value: count });
  }

  const used = (si.storage.totalBytes ?? 0) - (si.storage.usableBytes ?? 0);
  const storagePct = si.storage.totalBytes ? Math.round((100 * used) / si.storage.totalBytes) : 0;
  const heapPct = si.runtime.heapMaxBytes
    ? Math.round((100 * (si.runtime.heapUsedBytes ?? 0)) / si.runtime.heapMaxBytes) : 0;
  const cpuPct = Math.min(100, Math.round((si.scheduler.executingJobs ?? 0) / Math.max(1, si.scheduler.totalJobs ?? 1) * 100));

  return (
    <div className="ea-screen">
      {/* Hero */}
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Overview</div>
          <h1 className="ea-dash-hero-title">System Overview</h1>
          <p className="ea-dash-hero-sub">
            Monitor the health, status and performance of your DER environment.
          </p>
          <div className="ea-dash-hero-meta">
            <span className="ea-dash-hero-meta-item">{fmtDate(si.timestamp)}</span>
          </div>
        </div>
        <div>
          <span className={'ea-chip ea-chip--' + (allOps ? 'success' : 'warning')}>
            {allOps ? 'All systems operational' : 'Partial outage'}
          </span>
        </div>
      </section>

      {/* 5 KPI tiles */}
      <div className="ea-kpi-grid">
        <KpiTile tone={h.status === 'UP' ? 'success' : 'danger'}
                 icon={<IconPulse />} label="Status"
                 value={h.status === 'UP' ? 'Live' : h.status}
                 caption="DER service" />
        <KpiTile tone="info" icon={<IconUsers />}
                 label="Connected Clients" value={`${activeDevices} of ${totalDevices}`}
                 caption="approved devices" />
        <KpiTile tone="info" icon={<IconFlow />}
                 label="Edge Workflows" value={activeWf}
                 caption={`${(wfs ?? []).length} defined`} />
        <KpiTile tone={backlog > 0 ? 'warning' : 'success'} icon={<IconClock />}
                 label="Pending Records" value={backlog}
                 caption="journal backlog" />
        <KpiTile tone={reliability >= 95 ? 'success' : 'warning'} icon={<IconAlert />}
                 label="Reliability" value={`${reliability}%`}
                 caption={`${totalRuns} runs sampled`} />
      </div>

      {/* Topology diagram */}
      <Panel title="System Topology">
        <div className="ea-topology">
          <TopoNode icon={<IconCloud />} label="DHIS2 Central"
                    sub={c?.centralVersion ?? '—'}
                    tone={c?.probeReachable ? 'success' : 'danger'} />
          <TopoArrow />
          <TopoNode icon={<IconServer />} label="DER Server"
                    sub={`v${si.build.version}`} tone="success" />
          <TopoArrow />
          <TopoNode icon={<IconDevices />} label="Client Devices"
                    sub={`${activeDevices} active`} tone={activeDevices > 0 ? 'success' : 'muted'} />
        </div>
      </Panel>

      {/* Sync activity + Resource usage */}
      <div className="ea-dash-middle">
        <Panel title="Synchronisation Activity" action={<span className="ea-text-muted">last 24h</span>}>
          <MiniBarChart bars={bars} />
          <div className="ea-dash-sync-stats">
            <div><strong>{totalRuns}</strong><span>Runs</span></div>
            <div><strong>{succeeded}</strong><span>Succeeded</span></div>
            <div><strong>{reliability}%</strong><span>Reliability</span></div>
          </div>
        </Panel>
        <Panel title="Resource Usage">
          <div className="ea-dash-gauges">
            <div className="ea-dash-gauge"><Ring percent={cpuPct} label="CPU" color="var(--der-primary)" /></div>
            <div className="ea-dash-gauge"><Ring percent={heapPct} label="Memory" color="var(--der-teal)" /></div>
            <div className="ea-dash-gauge"><Ring percent={storagePct} label="Storage" color="var(--der-warning)" /></div>
          </div>
        </Panel>
      </div>

      {/* Bottom: queues + client status + alerts/activity */}
      <div className="ea-dash-bottom">
        <Panel title="Queues &amp; Backlog">
          {w && (
            <ul className="ea-dash-priority-list">
              {Object.entries(w.backlog).map(([k, v]) => (
                <li key={k}>
                  <Dot tone={k === 'FAILED' ? 'danger' : k === 'PENDING' ? 'warning' : 'muted'} />
                  <span>{k}</span><strong>{v as number}</strong>
                </li>
              ))}
              {Object.keys(w.backlog).length === 0 && (
                <li><Dot tone="success" /><span>No backlog</span><strong>0</strong></li>
              )}
            </ul>
          )}
        </Panel>

        <Panel title="Client Status" action={<Link to="/devices" className="ea-link-btn">View All</Link>}>
          {(devices ?? []).length === 0 ? (
            <p className="ea-text-muted">No clients enrolled.</p>
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

        <Panel title="Recent System Activity" action={<Link to="/audit/events" className="ea-link-btn">View All</Link>}>
          {(activity ?? []).length === 0 ? (
            <p className="ea-text-muted">No activity yet.</p>
          ) : (
            <ul className="ea-dash-activity-list">
              {(activity ?? []).slice(0, 5).map((a) => (
                <li key={a.auditId}>
                  <Dot tone={a.outcome === 'SUCCESS' ? 'success' : a.outcome === 'FAILURE' ? 'danger' : 'muted'} />
                  <div>
                    <div className="ea-dash-activity-type">{a.eventType}</div>
                    <div className="ea-dash-activity-meta">{fmtAgo(a.observedAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Database &amp; Storage Health">
        <ul className="ea-components-list">
          <li>
            <Dot tone={si.database.probeError ? 'danger' : 'success'} />
            <div className="ea-components-main">
              <div className="ea-components-name">Primary database</div>
              <div className="ea-components-meta">{si.database.product ?? '—'}</div>
            </div>
            <div className="ea-components-version ea-mono">{si.database.migrationCount ?? 0} migrations</div>
          </li>
          <li>
            <Dot tone={si.storage.status === 'OK' ? 'success' : si.storage.status === 'WARN' ? 'warning' : 'danger'} />
            <div className="ea-components-main">
              <div className="ea-components-name">Edge data root</div>
              <div className="ea-components-meta ea-mono">{si.storage.root ?? '—'}</div>
            </div>
            <div className="ea-components-version">{fmtBytes(si.storage.usableBytes)} / {fmtBytes(si.storage.totalBytes)}</div>
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function TopoNode({ icon, label, sub, tone }: {
  icon: JSX.Element; label: string; sub: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
}): JSX.Element {
  return (
    <div className="ea-topo-node">
      <div className="ea-topo-icon">{icon}</div>
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
function IconUsers(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3.1-6 7-6s7 2.5 7 6" /></svg>); }
function IconFlow(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="4" rx="1" /><rect x="3" y="10" width="14" height="4" rx="1" /><rect x="3" y="16" width="14" height="4" rx="1" /></svg>); }
function IconClock(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); }
function IconAlert(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l10 18H2z" /><path d="M12 10v5" /><circle cx="12" cy="18" r=".5" fill="currentColor" /></svg>); }
function IconCloud(): JSX.Element { return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 18H7a4 4 0 010-8 6 6 0 0111.3-.5A4.5 4.5 0 0118 18z" /></svg>); }
function IconServer(): JSX.Element { return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="7" rx="1.5" /><rect x="3" y="13" width="18" height="7" rx="1.5" /><path d="M7 7h.01M7 16h.01" /></svg>); }
function IconDevices(): JSX.Element { return (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5" /><path d="M11 18h2" /></svg>); }
