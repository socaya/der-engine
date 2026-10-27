import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, MiniBarChart, Dot, fmtDur, fmtAgo, fmtBytes, humaniseState, syncActivityShape, entityTypeIcon, entityTypeLabel } from './shared';
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
  const [stats, setStats] = useState<edgeApi.JournalStatsByType | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function reload(): Promise<void> {
    const [a, b, st] = await Promise.allSettled([
      edgeApi.workerHealth(), edgeApi.listJobs(100),
      edgeApi.journalStatsByType(),
    ]);
    if (a.status === 'fulfilled') setW(a.value);
    if (b.status === 'fulfilled') setJobs(b.value);
    if (st.status === 'fulfilled') setStats(st.value);
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

  if (!w) return <LoadingBlock testId="loading" />;

  const isSuccess = (o: string): boolean => o === 'SUCCEEDED' || o === 'SUCCESS';
  const isFailure = (o: string): boolean => o === 'FAILED' || o === 'FAILURE';

  // 24h activity: bin into 12 slots of 2 hours each so bars are chunky
  // and the chart doesn't look blank when drains cluster into a few
  // minutes. Falls back to the actual job time range if there is any
  // activity in the window — otherwise the fixed 24h window.
  const now = Date.now();
  const windowMs = 24 * 3600_000;
  const slots = 12;
  const slotMs = windowMs / slots;
  const bars: Array<{ label: string; value: number }> = [];
  for (let i = slots - 1; i >= 0; i--) {
    const start = now - (i + 1) * slotMs;
    const end = now - i * slotMs;
    bars.push({
      label: new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: (jobs ?? []).filter((j) => {
        const t = Date.parse(j.startedAt);
        return t >= start && t < end;
      }).length,
    });
  }

  const lastJob = (jobs ?? []).find((j) => isSuccess(j.outcome));
  const lastAnyJob = (jobs ?? [])[0];
  const backlog = Object.values(w.backlog).reduce((a, b) => a + b, 0);
  const succeeded24 = (jobs ?? []).filter((j) =>
    Date.now() - Date.parse(j.startedAt) < windowMs && isSuccess(j.outcome)).length;
  const failed24 = (jobs ?? []).filter((j) =>
    Date.now() - Date.parse(j.startedAt) < windowMs && isFailure(j.outcome)).length;
  const totalRuns24 = succeeded24 + failed24;
  const reliability = totalRuns24
    ? Math.round((100 * succeeded24) / totalRuns24)
    : 100;

  return (
    <div className="ea-screen" data-test="sync-hub">
      <div className="ea-stat-strip">
        <Stat label="Worker" tone={w.enabled ? 'success' : 'muted'}
              value={w.enabled ? 'Running' : 'Paused'} />
        <Stat label="Backlog" tone={backlog > 0 ? 'warning' : 'success'}
              value={backlog.toLocaleString()} />
        <Stat label="Last sync"
              value={(lastJob ?? lastAnyJob)
                ? fmtAgo((lastJob ?? lastAnyJob).startedAt)
                : 'No runs yet'} />
        <Stat label="Last duration"
              value={(lastJob ?? lastAnyJob)
                ? fmtDur((lastJob ?? lastAnyJob).durationMs)
                : '—'} />
        <Stat label="Reliability (24h)"
              tone={totalRuns24 === 0 ? 'muted' : reliability >= 95 ? 'success' : 'warning'}
              value={totalRuns24 === 0 ? 'No data' : `${reliability}%`} />
        <Stat label="Last tick"
              value={w.lastTick ? fmtAgo(w.lastTick) : 'Never'} />
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

      <Panel title="Outbound queue · by data type"
             action={
               <>
                 <Link to="/sync/jobs/trigger" className="ea-btn ea-btn--ghost ea-btn--sm"
                       data-test="sync-trigger">
                   Trigger a job
                 </Link>
                 <button type="button" className="ea-btn ea-btn--primary ea-btn--sm" disabled={busy}
                         data-test="sync-toggle"
                         onClick={() => { toggle().catch(() => undefined); }}>
                   {busy ? '…' : w.enabled ? 'Pause sync' : 'Resume sync'}
                 </button>
               </>
             }>
        <p className="ea-text-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
          Operations captured locally and queued for push to DHIS2.
          Click a row to inspect the records and their payload JSON.
        </p>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense ea-table--selectable">
            <thead><tr>
              <th style={{ width: 32 }}></th>
              <th>Data type</th>
              <th style={{ width: 90 }}>Pending</th>
              <th style={{ width: 90 }}>In flight</th>
              <th style={{ width: 90 }}>Accepted</th>
              <th style={{ width: 90 }}>Needs review</th>
              <th style={{ width: 90 }}>Status</th>
            </tr></thead>
            <tbody>
              {stats && Object.entries(stats).map(([type, states]) => {
                const pending = (states.PENDING ?? 0) + (states.IN_FLIGHT ?? 0);
                const inFlight = states.IN_FLIGHT ?? 0;
                const accepted = states.CENTRAL_ACCEPTED ?? 0;
                const review = (states.CONFLICT_REVIEW ?? 0) + (states.RETRYABLE ?? 0)
                             + (states.CENTRAL_REJECTED ?? 0);
                const total = pending + accepted + review;
                return (
                  <tr key={type} onClick={() => navigate('/sync/queues')}
                      style={{ cursor: 'pointer' }}>
                    <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true">
                      {entityTypeIcon(type)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{entityTypeLabel(type)}</div>
                      <div className="ea-text-muted ea-mono" style={{ fontSize: 10 }}>{type}</div>
                    </td>
                    <td className="ea-mono">{(states.PENDING ?? 0).toLocaleString()}</td>
                    <td className="ea-mono">{inFlight.toLocaleString()}</td>
                    <td className="ea-mono">{accepted.toLocaleString()}</td>
                    <td className="ea-mono">{review.toLocaleString()}</td>
                    <td>
                      <Dot tone={total === 0 ? 'muted'
                                : review > 0 ? 'warning'
                                : w.enabled ? 'success' : 'warning'} />
                      <span style={{ marginLeft: 4 }}>
                        {total === 0 ? 'Idle'
                          : review > 0 ? 'Needs attention'
                          : w.enabled ? 'Syncing' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!stats && (
                <tr><td colSpan={7} className="ea-text-muted"
                        style={{ padding: 16, textAlign: 'center' }}>
                  Loading backlog…
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Recent activity"
             action={<Link to="/sync/history" className="ea-link-btn">View all</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th style={{ width: 32 }}></th>
              <th>What was synced</th>
              <th style={{ width: 130 }}>Direction</th>
              <th style={{ width: 90 }}>When</th>
              <th style={{ width: 70 }}>Duration</th>
              <th style={{ width: 110 }}>Status</th>
            </tr></thead>
            <tbody>
              {(jobs ?? []).slice(0, 10).map((j) => {
                const shape = syncActivityShape(j.jobName, j.detail);
                return (
                  <tr key={j.runId}>
                    <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true"
                        title={shape.category}>
                      {shape.icon}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--der-ink-900)' }}>
                        {shape.category}
                      </div>
                      <div className="ea-text-muted" style={{ fontSize: 11, marginTop: 1 }}>
                        {shape.sentence}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {shape.direction === 'local' ? (
                        <span className="ea-text-muted">DER-local</span>
                      ) : (
                        <>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' → ')[0]}
                          </span>
                          <span style={{ color: 'var(--der-primary)', margin: '0 6px', fontWeight: 700 }}>→</span>
                          <span className="ea-mono" style={{ color: 'var(--der-ink-900)' }}>
                            {shape.directionLabel.split(' → ')[1]}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}
                        title={j.startedAt}>{fmtAgo(j.startedAt)}</td>
                    <td className="ea-mono">{fmtDur(j.durationMs)}</td>
                    <td>
                      <span className={'ea-chip ea-chip--' +
                          (j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS' ? 'success'
                          : j.outcome === 'FAILED' || j.outcome === 'FAILURE' ? 'danger' : 'info')}>
                        {humaniseState(j.outcome)}
                      </span>
                    </td>
                  </tr>
                );
              })}
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

export { fmtBytes };
