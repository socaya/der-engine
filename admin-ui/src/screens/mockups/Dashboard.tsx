import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  KpiTile, Panel, Ring, MiniBarChart, Dot, fmtDate, fmtAgo, fmtBytes, fmtDur,
} from './shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/** DER Server Operations Dashboard — matches docs/media/ui/DER Server Operations Dashboard.png */
export function MockupDashboard(): JSX.Element {
  const [h, setH] = useState<edgeApi.HealthResponse | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [c, setC] = useState<edgeApi.CompatSnapshot | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [conflicts, setConflicts] = useState<edgeApi.ConflictRow[] | null>(null);
  const [activity, setActivity] = useState<edgeApi.ActivityEntry[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[] | null>(null);
  const [workflows, setWorkflows] = useState<edgeApi.CaptureWorkflowSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      edgeApi.health(), edgeApi.systemInfo(), edgeApi.compat(),
      edgeApi.listJobs(50), edgeApi.listConflicts(50),
      edgeApi.recentActivity(10), edgeApi.listDevices(),
      edgeApi.listWorkflows(),
    ]).then((r) => {
      if (r[0].status === 'fulfilled') setH(r[0].value);
      if (r[1].status === 'fulfilled') setSi(r[1].value);
      if (r[2].status === 'fulfilled') setC(r[2].value);
      if (r[3].status === 'fulfilled') setJobs(r[3].value);
      if (r[4].status === 'fulfilled') setConflicts(r[4].value);
      if (r[5].status === 'fulfilled') setActivity(r[5].value.entries);
      if (r[6].status === 'fulfilled') setDevices(r[6].value.devices);
      if (r[7].status === 'fulfilled') setWorkflows(r[7].value.workflows);
      const first = r.find((x) => x.status === 'rejected');
      if (first && first.status === 'rejected') {
        setErr(first.reason instanceof Error ? first.reason.message : String(first.reason));
      }
    });
  }, []);

  if (!h || !si) return <LoadingBlock testId="loading" />;

  // Derive KPIs
  const dhis2Up = c?.probeReachable === true;
  const dbUp = si.database.configured && !si.database.probeError;
  const schedUp = si.scheduler.started === true;
  const deviceCount = devices?.length ?? 0;
  const avgRtt = si.dhis2.probeDurationMs != null ? `${si.dhis2.probeDurationMs}ms` : '—';

  // Sync activity — bucket last 50 runs into 24 hourly bars
  const now = Date.now();
  const bars: Array<{ label: string; value: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    const count = (jobs ?? []).filter((j) => {
      const t = Date.parse(j.startedAt);
      return t >= start && t < end;
    }).length;
    const hour = new Date(end).getHours();
    bars.push({ label: `${hour}h`, value: count });
  }
  const totalRuns = (jobs ?? []).length;
  const succeeded = (jobs ?? []).filter((j) => j.outcome === 'SUCCEEDED').length;
  const reliability = totalRuns ? Math.round((100 * succeeded) / totalRuns) : 0;

  // Conflicts by severity (attemptCount as proxy)
  const highC = (conflicts ?? []).filter((c) => c.attemptCount >= 5).length;
  const medC = (conflicts ?? []).filter((c) => c.attemptCount >= 2 && c.attemptCount < 5).length;
  const lowC = (conflicts ?? []).filter((c) => c.attemptCount < 2).length;

  // Storage ring
  const used = (si.storage.totalBytes ?? 0) - (si.storage.usableBytes ?? 0);
  const storagePct = si.storage.totalBytes
    ? Math.round((100 * used) / si.storage.totalBytes) : 0;

  // Memory ring
  const heapPct = si.runtime.heapMaxBytes
    ? Math.round((100 * (si.runtime.heapUsedBytes ?? 0)) / si.runtime.heapMaxBytes) : 0;

  // "CPU" — scheduler load proxy
  const cpuPct = si.scheduler.totalJobs
    ? Math.round((100 * (si.scheduler.executingJobs ?? 0)) / Math.max(1, si.scheduler.totalJobs))
    : 0;

  return (
    <div className="ea-screen">
      {err && <ErrorBlock title="Partial load" testId="dashboard-err">{err}</ErrorBlock>}

      {/* Hero welcome block */}
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Welcome back,</div>
          <h1 className="ea-dash-hero-title">DER Server</h1>
          <p className="ea-dash-hero-sub">
            DHIS2 Edge Runtime for resilient data capture, synchronisation and analytics.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + (h.status === 'UP' ? 'success' : 'danger')}>
              {h.status === 'UP' ? 'Operational' : h.status}
            </span>
            <span className="ea-dash-hero-meta-item">DER v{si.build.version}</span>
            <span className="ea-dash-hero-meta-item">{fmtDate(si.timestamp)}</span>
          </div>
        </div>
      </section>

      {/* 4 KPI tiles row */}
      <div className="ea-kpi-grid">
        <KpiTile
          tone={dhis2Up ? 'success' : 'danger'}
          icon={<IconPlug />}
          label="DHIS2 Connection"
          value={dhis2Up ? 'Connected' : 'Unreachable'}
          caption={si.dhis2.centralBaseUrl ?? '—'}
        />
        <KpiTile
          tone={dbUp ? 'success' : 'danger'}
          icon={<IconDatabase />}
          label="Local Database"
          value={dbUp ? 'Operational' : 'Degraded'}
          caption={si.database.product ?? '—'}
        />
        <KpiTile
          tone={schedUp ? 'success' : 'warning'}
          icon={<IconSync />}
          label="Synchronisation"
          value={schedUp ? 'Running' : 'Standby'}
          caption={`${avgRtt} RTT probe`}
        />
        <KpiTile
          tone="info"
          icon={<IconDevice />}
          label="Client Devices"
          value={deviceCount}
          caption={`${(devices ?? []).filter((d) => d.status === 'APPROVED').length} active`}
        />
      </div>

      {/* 2-column middle layout: left col = components + chart; right col = conflicts + workflows */}
      <div className="ea-dash-middle">
        <div className="ea-dash-middle-left">
          <Panel title="System Components" action={<Link to="/system/information" className="ea-link-btn">View All</Link>}>
            <ul className="ea-components-list">
              <ComponentRow name="DER Server" version={`v${si.build.version}`} status="OK" meta={fmtDur(si.runtime.uptimeMillis) + ' uptime'} />
              <ComponentRow name="DHIS2 App Runtime" version={si.dhis2.pinnedVersion ?? '—'} status={dhis2Up ? 'OK' : 'FAIL'} meta={si.dhis2.centralVersion ? 'central ' + si.dhis2.centralVersion : '—'} />
              <ComponentRow name="PostgreSQL" version={(si.database.product ?? '').split(' ')[1] ?? '—'} status={dbUp ? 'OK' : 'FAIL'} meta={`${si.database.migrationCount ?? 0} migrations`} />
              <ComponentRow name="DER Scheduler" version="Quartz" status={schedUp ? 'OK' : 'WARN'} meta={`${si.scheduler.totalJobs ?? 0} jobs`} />
              <ComponentRow name="Compat engine" version={c?.engineVersion ?? '—'} status={c?.probeReachable ? 'OK' : 'FAIL'} meta={c?.profileName ?? '—'} />
              <ComponentRow name="Journal worker" version="—" status="OK" meta={`${Object.values(si.journal ?? {}).reduce((a, b) => a + b, 0)} entries`} />
              <ComponentRow name="Storage" version={si.storage.root ?? '—'} status={si.storage.status === 'OK' ? 'OK' : 'WARN'} meta={fmtBytes(si.storage.usableBytes) + ' free'} />
              <ComponentRow name="Custom apps" version={`${si.apps.installed ?? 0}`} status="OK" meta={`${si.apps.enabled ?? 0} enabled`} />
              <ComponentRow name="Security Service" version="SessionStore" status="OK" meta={`${si.database.sessionCount ?? 0} sessions`} />
            </ul>
          </Panel>

          <Panel title="Synchronisation Activity" action={<span className="ea-text-muted">last 24h</span>}>
            <MiniBarChart bars={bars} />
            <div className="ea-dash-sync-stats">
              <div><strong>{totalRuns.toLocaleString()}</strong><span>Total Runs</span></div>
              <div><strong>{succeeded.toLocaleString()}</strong><span>Succeeded</span></div>
              <div><strong>{reliability}%</strong><span>Reliability</span></div>
            </div>
          </Panel>
        </div>

        <div className="ea-dash-middle-right">
          <Panel title="Conflict Review" action={<Link to="/journal/conflicts" className="ea-link-btn">View All</Link>}>
            <div className="ea-dash-conflict-total">{(conflicts ?? []).length}</div>
            <ul className="ea-dash-priority-list">
              <li><Dot tone="danger" /><span>High priority</span><strong>{highC}</strong></li>
              <li><Dot tone="warning" /><span>Medium priority</span><strong>{medC}</strong></li>
              <li><Dot tone="muted" /><span>Low priority</span><strong>{lowC}</strong></li>
            </ul>
          </Panel>

          <Panel title="Edge Workflows" action={<Link to="/workflows" className="ea-link-btn">View All</Link>}>
            {(workflows ?? []).length === 0 ? (
              <p className="ea-text-muted">No workflows defined.</p>
            ) : (
              <ul className="ea-dash-workflow-list">
                {(workflows ?? []).slice(0, 6).map((w) => (
                  <li key={w.workflowId}>
                    <Dot tone={w.enabled ? 'success' : 'muted'} />
                    <span>{w.displayName}</span>
                    <span className="ea-text-muted">{w.steps?.length ?? 0} steps</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Bottom row: Recent Activity + Client Devices + Storage */}
      <div className="ea-dash-bottom">
        <Panel title="Recent Activity" action={<Link to="/audit/events" className="ea-link-btn">View All</Link>}>
          {(activity ?? []).length === 0 ? (
            <p className="ea-text-muted">No activity yet.</p>
          ) : (
            <ul className="ea-dash-activity-list">
              {(activity ?? []).slice(0, 6).map((a) => (
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

        <Panel title="Client Devices" action={<Link to="/devices" className="ea-link-btn">View All</Link>}>
          {(devices ?? []).length === 0 ? (
            <p className="ea-text-muted">No devices enrolled yet.</p>
          ) : (
            <ul className="ea-dash-device-list">
              {(devices ?? []).slice(0, 6).map((d) => (
                <li key={d.deviceId}>
                  <Dot tone={d.status === 'APPROVED' ? 'success' : d.status === 'PENDING' ? 'warning' : 'danger'} />
                  <div>
                    <div className="ea-mono">{d.deviceId.slice(0, 10)}…</div>
                    <div className="ea-dash-activity-meta">
                      {d.status} · {fmtAgo(d.lastSeenAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Storage &amp; Resources">
          <div className="ea-dash-gauges">
            <div className="ea-dash-gauge">
              <Ring percent={cpuPct} label="CPU" color="var(--der-primary)" />
            </div>
            <div className="ea-dash-gauge">
              <Ring percent={heapPct} label="Memory" color="var(--der-teal)" />
            </div>
            <div className="ea-dash-gauge">
              <Ring percent={storagePct} label="Storage" color="var(--der-warning)" />
            </div>
          </div>
        </Panel>
      </div>
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

function IconPlug(): JSX.Element {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v4M15 2v4" /><path d="M7 6h10v4a5 5 0 01-10 0V6z" /><path d="M12 15v7" /></svg>);
}
function IconDatabase(): JSX.Element {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>);
}
function IconSync(): JSX.Element {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0113-6.3L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 01-13 6.3L4 16" /><path d="M4 20v-4h4" /></svg>);
}
function IconDevice(): JSX.Element {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5" /><path d="M11 18h2" /></svg>);
}
