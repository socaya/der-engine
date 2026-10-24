import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { KpiTile, Panel, MiniBarChart, Dot, fmtDur, fmtAgo, fmtBytes } from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/** DHIS2 Synchronisation Overview — matches docs/media/ui/DHIS2 Synchronisation Dashboard Overview.png */
export function MockupSyncOverview(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, c] = await Promise.allSettled([
      edgeApi.workerHealth(), edgeApi.listJobs(100), edgeApi.systemInfo(),
    ]);
    if (a.status === 'fulfilled') setW(a.value);
    if (b.status === 'fulfilled') setJobs(b.value);
    if (c.status === 'fulfilled') setSi(c.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function toggle(): Promise<void> {
    if (!w) return;
    setBusy(true);
    try {
      await (w.enabled ? edgeApi.pauseWorker() : edgeApi.resumeWorker());
      await reload();
    } finally { setBusy(false); }
  }

  if (!w || !si) return <LoadingBlock testId="loading" />;

  const now = Date.now();
  const bars: Array<{ label: string; value: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const start = now - (i + 1) * 3600_000;
    const end = now - i * 3600_000;
    bars.push({
      label: `${new Date(end).getHours()}h`,
      value: (jobs ?? []).filter((j) => {
        const t = Date.parse(j.startedAt);
        return t >= start && t < end;
      }).length,
    });
  }

  const lastJob = (jobs ?? []).find((j) => j.outcome === 'SUCCEEDED');
  const backlog = Object.values(w.backlog).reduce((a, b) => a + b, 0);
  const succeeded24 = (jobs ?? []).filter((j) => Date.now() - Date.parse(j.startedAt) < 86400_000 && j.outcome === 'SUCCEEDED').length;
  const failed24 = (jobs ?? []).filter((j) => Date.now() - Date.parse(j.startedAt) < 86400_000 && j.outcome === 'FAILED').length;
  const reliability = succeeded24 + failed24 ? Math.round((100 * succeeded24) / (succeeded24 + failed24)) : 100;

  const dataTypes = [
    { label: 'Data Elements', items: (si.journal?.AGGREGATE ?? 0) + (si.journal?.AGGREGATE_PUSH ?? 0) },
    { label: 'Events', items: (si.journal?.EVENT ?? 0) },
    { label: 'Tracker Enrollments', items: (si.journal?.ENROLLMENT ?? 0) + (si.journal?.TRACKED_ENTITY ?? 0) },
    { label: 'Organisation Units', items: (si.journal?.ORG_UNIT ?? 0) },
  ];

  return (
    <div className="ea-screen">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <div className="ea-dash-hero-eyebrow">Office &amp; Sync › Synchronisation</div>
          <h1 className="ea-dash-hero-title">Synchronisation</h1>
          <p className="ea-dash-hero-sub">
            Manage data synchronisation between DER and DHIS2.
          </p>
          <div className="ea-dash-hero-meta">
            <span className={'ea-chip ea-chip--' + (w.enabled ? 'success' : 'muted')}>
              {w.enabled ? 'Running' : 'Paused'}
            </span>
          </div>
        </div>
        <div>
          <button type="button" className="ea-btn ea-btn--primary" disabled={busy}
                  onClick={() => { toggle().catch(() => undefined); }}>
            {w.enabled ? 'Pause Sync' : 'Resume Sync'}
          </button>
        </div>
      </section>

      <div className="ea-kpi-grid">
        <KpiTile tone={backlog > 0 ? 'warning' : 'success'}
                 icon={<IconDocs />} label="Records to Sync"
                 value={backlog.toLocaleString()}
                 caption="pending in journal" />
        <KpiTile tone="info" icon={<IconClock />}
                 label="Last Sync"
                 value={lastJob ? fmtAgo(lastJob.startedAt) : '—'}
                 caption={lastJob?.jobName ?? '—'} />
        <KpiTile tone="info" icon={<IconHourglass />}
                 label="Last Duration"
                 value={lastJob ? fmtDur(lastJob.durationMs) : '—'}
                 caption={lastJob ? lastJob.outcome : '—'} />
        <KpiTile tone="success" icon={<IconDisk />}
                 label="Reliability (24h)"
                 value={`${reliability}%`}
                 caption={`${succeeded24} ok · ${failed24} failed`} />
      </div>

      <div className="ea-dash-middle">
        <Panel title="Synchronisation Progress">
          <div className="ea-sync-flow">
            <div className="ea-sync-node">
              <strong>DER</strong>
              <span>local database</span>
            </div>
            <div className="ea-sync-arrow">
              <span>{w.enabled ? 'Syncing' : 'Paused'}</span>
              <div className="ea-sync-arrow-line" />
            </div>
            <div className="ea-sync-node">
              <strong>DHIS2</strong>
              <span>central</span>
            </div>
          </div>
          <div className="ea-sync-progress-body">
            <div className="ea-sync-progress-row">
              <span>Last batch</span>
              <strong>{w.lastBatchSize}</strong>
            </div>
            <div className="ea-sync-progress-row">
              <span>Last tick</span>
              <strong>{fmtAgo(w.lastTick)}</strong>
            </div>
            <div className="ea-sync-progress-row">
              <span>Backlog</span>
              <strong>{backlog}</strong>
            </div>
          </div>
        </Panel>

        <Panel title="Synchronisation Activity" action={<span className="ea-text-muted">last 24h</span>}>
          <MiniBarChart bars={bars} />
          <div className="ea-dash-sync-stats">
            <div><strong>{succeeded24}</strong><span>Succeeded</span></div>
            <div><strong>{failed24}</strong><span>Failed</span></div>
            <div><strong>{reliability}%</strong><span>Reliability</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="Data Types" action={<Link to="/metadata" className="ea-link-btn">Configure</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table">
            <thead><tr>
              <th>Type</th><th>Items</th><th>Last Sync</th><th>Status</th>
            </tr></thead>
            <tbody>
              {dataTypes.map((d) => (
                <tr key={d.label}>
                  <td>{d.label}</td>
                  <td className="ea-mono">{d.items.toLocaleString()}</td>
                  <td>{lastJob ? fmtAgo(lastJob.startedAt) : '—'}</td>
                  <td>
                    <Dot tone={d.items === 0 ? 'muted' : w.enabled ? 'success' : 'warning'} />
                    {d.items === 0 ? ' idle' : w.enabled ? ' syncing' : ' paused'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent Synchronisation Activity" action={<Link to="/sync/history" className="ea-link-btn">View All</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Started</th><th>Job</th><th>Outcome</th><th>Duration</th>
            </tr></thead>
            <tbody>
              {(jobs ?? []).slice(0, 10).map((j) => (
                <tr key={j.runId}>
                  <td className="ea-mono">{fmtAgo(j.startedAt)}</td>
                  <td>{j.jobName}</td>
                  <td><span className={'ea-chip ea-chip--' +
                      (j.outcome === 'SUCCEEDED' ? 'success' : j.outcome === 'FAILED' ? 'danger' : 'info')}>{j.outcome}</span></td>
                  <td>{fmtDur(j.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function IconDocs(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2h8l4 4v16H4V2h4z" /><path d="M8 2v6h8" /></svg>); }
function IconClock(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>); }
function IconHourglass(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12M6 22h12M6 2v4a6 6 0 0012 0V2M6 22v-4a6 6 0 0112 0v4" /></svg>); }
function IconDisk(): JSX.Element { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>); }
export { fmtBytes };
