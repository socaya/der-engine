import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, MiniBarChart, Dot, fmtDur, fmtAgo, fmtBytes, humaniseJob, humaniseState } from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/**
 * Sync hub — one landing page for the whole `/sync` section.
 *
 *  1. Pause/Resume worker in the header.
 *  2. Flat 6-stat strip: Worker state · Backlog · Last sync · Last duration ·
 *     Reliability (24h) · Last tick.
 *  3. Sync-flow diagram (DER → DHIS2) + 24h activity bar chart.
 *  4. Data types mini table.
 *  5. Related tile grid linking into every Sync-group sub-page
 *     (Jobs · History · Queues · Conflicts · Worker health · Metadata
 *     sync · Data exchange · Schedule · Drift).
 *  6. Compact "Recent activity" preview with a link to the full
 *     history.
 */
export function MockupSyncOverview(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [si, setSi] = useState<edgeApi.SystemInfo | null>(null);
  const [d, setD] = useState<edgeApi.DriftResponse | null>(null);
  const [c, setC] = useState<edgeApi.ConflictRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(): Promise<void> {
    const [a, b, cs, drf, conf] = await Promise.allSettled([
      edgeApi.workerHealth(), edgeApi.listJobs(100), edgeApi.systemInfo(),
      edgeApi.drift(), edgeApi.listConflicts(100),
    ]);
    if (a.status === 'fulfilled') setW(a.value);
    if (b.status === 'fulfilled') setJobs(b.value);
    if (cs.status === 'fulfilled') setSi(cs.value);
    if (drf.status === 'fulfilled') setD(drf.value);
    if (conf.status === 'fulfilled') setC(conf.value);
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
  const succeeded24 = (jobs ?? []).filter((j) =>
    Date.now() - Date.parse(j.startedAt) < 86400_000 && j.outcome === 'SUCCEEDED').length;
  const failed24 = (jobs ?? []).filter((j) =>
    Date.now() - Date.parse(j.startedAt) < 86400_000 && j.outcome === 'FAILED').length;
  const reliability = succeeded24 + failed24
    ? Math.round((100 * succeeded24) / (succeeded24 + failed24))
    : 100;

  const dataTypes = [
    { label: 'Data elements', items: (si.journal?.AGGREGATE ?? 0) + (si.journal?.AGGREGATE_PUSH ?? 0) },
    { label: 'Events', items: (si.journal?.EVENT ?? 0) },
    { label: 'Tracker enrollments', items: (si.journal?.ENROLLMENT ?? 0) + (si.journal?.TRACKED_ENTITY ?? 0) },
    { label: 'Organisation units', items: (si.journal?.ORG_UNIT ?? 0) },
  ];

  const driftDetected = Boolean(d?.fingerprintFrom && d?.fingerprintTo
    && d.fingerprintFrom !== d.fingerprintTo);
  const pendingConflicts = (c ?? []).filter((x) => x.state !== 'RESOLVED').length;

  return (
    <div className="ea-screen" data-test="sync-hub">
      <section className="ea-dash-hero">
        <div className="ea-dash-hero-left">
          <h1 className="ea-dash-hero-title">Sync</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/sync/jobs/trigger" className="ea-btn ea-btn--ghost"
                data-test="sync-trigger">
            Trigger a job
          </Link>
          <button type="button" className="ea-btn ea-btn--primary" disabled={busy}
                  data-test="sync-toggle"
                  onClick={() => { toggle().catch(() => undefined); }}>
            {busy ? '…' : w.enabled ? 'Pause sync' : 'Resume sync'}
          </button>
        </div>
      </section>

      <div className="ea-stat-strip">
        <Stat label="Worker" tone={w.enabled ? 'success' : 'muted'}
              value={w.enabled ? 'running' : 'paused'} />
        <Stat label="Backlog" tone={backlog > 0 ? 'warning' : 'success'}
              value={backlog.toLocaleString()} />
        <Stat label="Last sync"
              value={lastJob ? fmtAgo(lastJob.startedAt) : '—'} />
        <Stat label="Last duration"
              value={lastJob ? fmtDur(lastJob.durationMs) : '—'} />
        <Stat label="Reliability (24h)" tone={reliability >= 95 ? 'success' : 'warning'}
              value={`${reliability}%`} />
        <Stat label="Last tick" value={fmtAgo(w.lastTick)} />
      </div>

      <div className="ea-dash-middle">
        <Panel title="Synchronisation directions">
          <div data-test="sync-directions"
               style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            <SyncLane
              kind="Metadata"
              arrow="→"
              detail="Central → DER (pull only)"
              desc="DHIS2 is the source of truth. DER mirrors it locally so capture surfaces keep running when the WAN drops."
              badge={<span className="ea-chip ea-chip--info">one-way</span>} />
            <SyncLane
              kind="Data"
              arrow="↔"
              detail="Central ↔ DER (push + pull)"
              desc="Local captures journal up to central; central-held OU data syncs down so distributed workflows have the shared record."
              badge={<span className="ea-chip ea-chip--success">two-way</span>} />
          </div>
          <div className="ea-sync-progress-body" style={{ marginTop: 10 }}>
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

        <Panel title="24h activity"
               action={<Link to="/sync/history" className="ea-link-btn">View all</Link>}>
          <MiniBarChart bars={bars} />
          <div className="ea-dash-sync-stats">
            <div><strong>{succeeded24}</strong><span>Succeeded</span></div>
            <div><strong>{failed24}</strong><span>Failed</span></div>
            <div><strong>{reliability}%</strong><span>Reliability</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="Journal by data type">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Type</th><th>Items</th><th>Last sync</th><th>Status</th>
            </tr></thead>
            <tbody>
              {dataTypes.map((dt) => (
                <tr key={dt.label}>
                  <td>{dt.label}</td>
                  <td className="ea-mono">{dt.items.toLocaleString()}</td>
                  <td>{lastJob ? fmtAgo(lastJob.startedAt) : '—'}</td>
                  <td>
                    <Dot tone={dt.items === 0 ? 'muted' : w.enabled ? 'success' : 'warning'} />
                    {dt.items === 0 ? ' idle' : w.enabled ? ' syncing' : ' paused'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <section data-test="sync-related">
        <div className="ea-section-title">Sync sub-modules</div>
        <div className="ea-tile-grid">
          <SyncTile to="/sync/jobs" icon="▶" title="Jobs"
                    desc={`${(jobs ?? []).length} recent runs`} />
          <SyncTile to="/sync/history" icon="⏱" title="History"
                    desc="Every sync run on this edge." />
          <SyncTile to="/sync/queues" icon="≡" title="Queues"
                    desc={backlog > 0
                      ? `${backlog.toLocaleString()} items waiting to send`
                      : 'Nothing waiting to send.'} />
          <SyncTile to="/journal/conflicts" icon="⚠" title="Conflicts"
                    desc={pendingConflicts > 0
                      ? `${pendingConflicts} need a reviewer decision`
                      : 'No conflicts to review.'} />
          <SyncTile to="/journal/worker" icon="♥" title="Worker health"
                    desc={w.enabled ? 'Running smoothly.'
                                    : 'Paused — sync is stopped.'} />
          <SyncTile to="/sync/metadata" icon="◱" title="Metadata sync"
                    desc="Pull the latest DHIS2 metadata now." />
          <SyncTile to="/sync/data" icon="↕" title="Data exchange"
                    desc="Push + pull data between DER and DHIS2." />
          <SyncTile to="/sync/schedule" icon="🗓" title="Schedule"
                    desc="When each background flow runs." />
          <SyncTile to="/sync/drift" icon="≠" title="Metadata drift"
                    desc={driftDetected ? 'Drift detected — review before next sync.'
                                        : 'Mirror matches DHIS2.'} />
        </div>
      </section>

      <Panel title="Recent activity"
             action={<Link to="/sync/history" className="ea-link-btn">View all</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th>Started</th><th>Job</th><th>Outcome</th><th>Duration</th>
            </tr></thead>
            <tbody>
              {(jobs ?? []).slice(0, 10).map((j) => (
                <tr key={j.runId}>
                  <td className="ea-mono">{fmtAgo(j.startedAt)}</td>
                  <td>
                    {humaniseJob(j.jobName)}
                    <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}
                         title={j.jobName}>{j.jobName}</div>
                  </td>
                  <td>
                    <span className={'ea-chip ea-chip--' +
                        (j.outcome === 'SUCCEEDED' ? 'success'
                        : j.outcome === 'FAILED' ? 'danger' : 'info')}>
                      {humaniseState(j.outcome)}
                    </span>
                  </td>
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

function Stat({ label, value, tone = 'info' }: {
  label: string; value: ReactNode; tone?: 'info' | 'success' | 'danger' | 'warning' | 'muted';
}): JSX.Element {
  return (
    <div className={`ea-stat ea-stat--${tone}`}>
      <div className="ea-stat-value">{value}</div>
      <div className="ea-stat-label">{label}</div>
    </div>
  );
}

function SyncLane({ kind, arrow, detail, desc, badge }: {
  kind: string; arrow: string; detail: string; desc: string; badge: ReactNode;
}): JSX.Element {
  return (
    <div title={desc}
         style={{
           display: 'grid', gridTemplateColumns: 'max-content 1fr max-content max-content',
           columnGap: 12, alignItems: 'center',
           padding: '6px 10px', border: '1px solid var(--der-border-subtle)', borderRadius: 6,
         }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <span className="ea-mono" style={{ fontSize: 14, color: 'var(--der-ink-900)' }}>Central</span>
        <span style={{ fontSize: 18, color: 'var(--der-primary)', fontWeight: 700 }}>{arrow}</span>
        <span className="ea-mono" style={{ fontSize: 14, color: 'var(--der-ink-900)' }}>DER</span>
      </div>
      <div style={{ minWidth: 0, fontSize: 13, color: 'var(--der-ink-900)' }}>
        <span style={{ fontWeight: 600 }}>{kind}</span>
        <span className="ea-text-muted" style={{ fontWeight: 400, fontSize: 12 }}> · {detail}</span>
      </div>
      <span aria-hidden="true" title={desc}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: '50%',
              border: '1px solid var(--der-border)', color: 'var(--der-ink-400)',
              fontSize: 11, lineHeight: 1, cursor: 'help', fontFamily: 'serif',
            }}>i</span>
      {badge}
    </div>
  );
}

function SyncTile({ to, icon, title, desc }: {
  to: string; icon: string; title: string; desc: string;
}): JSX.Element {
  return (
    <Link to={to} className="ea-link-tile">
      <div className="ea-link-tile-icon" aria-hidden="true">{icon}</div>
      <div className="ea-link-tile-body">
        <div className="ea-link-tile-title">{title}</div>
        <div className="ea-link-tile-desc">{desc}</div>
      </div>
    </Link>
  );
}

export { fmtBytes };
