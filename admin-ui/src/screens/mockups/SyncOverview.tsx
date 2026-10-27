import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, fmtAgo, syncActivityShape, operatorState, operatorStateTone,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/**
 * `/admin/sync` — Overview per DER Sync requirements §5.
 *
 * Answers "Is synchronisation working?" with a hero status card, two
 * large primary actions (Pull Metadata Now · Push Data Now) and a short
 * recent-activity feed. No charts, no raw queue tables, no state
 * breakdowns — those live on the dedicated sub-pages.
 */
export function MockupSyncOverview(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [stats, setStats] = useState<edgeApi.JournalStatsByType | null>(null);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const [a, b, st, si] = await Promise.allSettled([
      edgeApi.workerHealth(), edgeApi.listJobs(100),
      edgeApi.journalStatsByType(), edgeApi.systemInfo(),
    ]);
    if (a.status === 'fulfilled') setW(a.value);
    if (b.status === 'fulfilled') setJobs(b.value);
    if (st.status === 'fulfilled') setStats(st.value);
    if (si.status === 'fulfilled') setSysInfo(si.value);
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  async function pull(): Promise<void> {
    setPulling(true); setFlash(null);
    try {
      await edgeApi.triggerJob('METADATA_SYNC_FULL');
      setFlash('Metadata pull started.');
      setTimeout(() => reload().catch(() => undefined), 1500);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally { setPulling(false); }
  }
  async function push(): Promise<void> {
    setPushing(true); setFlash(null);
    try {
      await edgeApi.triggerJob('JOURNAL_WORKER_DRAIN');
      setFlash('Data push started.');
      setTimeout(() => reload().catch(() => undefined), 1500);
    } catch (e) {
      setFlash(e instanceof Error ? e.message : String(e));
    } finally { setPushing(false); }
  }

  if (!w) return <LoadingBlock testId="loading" />;

  // Operator-facing overall status.
  const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
  const attentionCount = stats
    ? Object.values(stats).reduce((a, b) =>
        a + (b.CONFLICT_REVIEW ?? 0) + (b.RETRYABLE ?? 0) + (b.CENTRAL_REJECTED ?? 0), 0)
    : 0;
  const waitingCount = stats
    ? Object.values(stats).reduce((a, b) => a + (b.PENDING ?? 0) + (b.IN_FLIGHT ?? 0), 0)
    : 0;

  type Status = 'working' | 'paused' | 'offline' | 'attention';
  let status: Status;
  let statusCopy: string;
  if (!w.enabled) {
    status = 'paused';
    statusCopy = 'Sync is paused. Captured records are being saved locally and will send once sync resumes.';
  } else if (!centralReachable) {
    status = 'offline';
    statusCopy = 'Central DHIS2 is unreachable. Captured data is safe locally and will send automatically when the connection returns.';
  } else if (attentionCount > 0) {
    status = 'attention';
    statusCopy = `${attentionCount} record${attentionCount === 1 ? '' : 's'} ${attentionCount === 1 ? 'needs' : 'need'} your attention.`;
  } else {
    status = 'working';
    statusCopy = waitingCount > 0
      ? `Sync is working. ${waitingCount.toLocaleString()} record${waitingCount === 1 ? '' : 's'} waiting to send.`
      : 'Sync is working. All local data has reached Central DHIS2.';
  }

  const lastSuccess = (jobs ?? []).find((j) => j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS');
  const statusHeadline = {
    working: 'Sync is working',
    paused: 'Sync is paused',
    offline: 'Central DHIS2 is unavailable',
    attention: 'Sync needs attention',
  }[status];
  const statusAccent = {
    working: 'var(--der-success, #16a34a)',
    paused: 'var(--der-ink-400, #94a3b8)',
    offline: 'var(--der-warning, #d97706)',
    attention: 'var(--der-danger, #dc2626)',
  }[status];
  const statusIcon = { working: '✓', paused: '⏸', offline: '⌁', attention: '!' }[status];

  return (
    <div className="ea-screen" data-test="sync-hub">
      {flash && <p className="ea-saved" style={{ marginBottom: 10 }}>{flash}</p>}

      <section data-test="sync-hero"
               style={{
                 display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 16,
                 alignItems: 'center', padding: 16, marginBottom: 16,
                 border: '1px solid var(--der-border-subtle)', borderRadius: 8,
                 borderLeft: `4px solid ${statusAccent}`,
                 background: 'white',
               }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: statusAccent,
                       textAlign: 'center', lineHeight: 1 }} aria-hidden="true">
          {statusIcon}
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}
              data-test="sync-status-headline">{statusHeadline}</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--der-ink-500)' }}>{statusCopy}</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12,
                        color: 'var(--der-ink-500)', flexWrap: 'wrap' }}>
            <span>
              <strong style={{ color: 'var(--der-ink-900)' }}>Last successful sync:</strong>{' '}
              {lastSuccess ? fmtAgo(lastSuccess.startedAt) : 'None yet'}
            </span>
            <span>
              <strong style={{ color: 'var(--der-ink-900)' }}>Central DHIS2:</strong>{' '}
              {centralReachable ? 'Reachable' : 'Unreachable'}
            </span>
            {attentionCount > 0 && (
              <span>
                <strong style={{ color: 'var(--der-ink-900)' }}>Needs attention:</strong>{' '}
                <Link to="/sync/attention" style={{ color: 'var(--der-danger, #dc2626)' }}>
                  {attentionCount}
                </Link>
              </span>
            )}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                    gap: 12, marginBottom: 16 }}>
        <ActionCard
          icon="📦"
          title="Pull metadata now"
          desc="Refresh programs, data elements, organisation units and other DHIS2 metadata."
          button={pulling ? 'Pulling…' : 'Pull metadata now'}
          onClick={() => { pull().catch(() => undefined); }}
          disabled={pulling || !centralReachable}
          hint={!centralReachable ? 'Central DHIS2 is unavailable.' : undefined}
          testId="sync-pull-metadata"
          detailLink={['View metadata details', '/sync/metadata']}
        />
        <ActionCard
          icon="🩺"
          title="Push data now"
          desc="Send locally captured aggregate data, events and tracker records to Central DHIS2."
          button={pushing ? 'Pushing…' : 'Push data now'}
          onClick={() => { push().catch(() => undefined); }}
          disabled={pushing || !centralReachable || !w.enabled}
          hint={!w.enabled
            ? 'Worker is paused — resume it on the Worker page.'
            : !centralReachable
            ? 'Central DHIS2 is unavailable.'
            : waitingCount === 0
            ? 'Nothing waiting to send.'
            : undefined}
          testId="sync-push-data"
          detailLink={['View data details', '/sync/data']}
        />
      </div>

      <Panel title="Recent activity"
             action={<Link to="/sync/history" className="ea-link-btn">View all history</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense">
            <thead><tr>
              <th style={{ width: 32 }}></th>
              <th>Activity</th>
              <th style={{ width: 90 }}>When</th>
              <th style={{ width: 110 }}>Result</th>
            </tr></thead>
            <tbody>
              {(jobs ?? []).slice(0, 8).map((j) => {
                const shape = syncActivityShape(j.jobName, j.detail);
                const os = operatorState(j.outcome);
                return (
                  <tr key={j.runId}>
                    <td style={{ fontSize: 16, textAlign: 'center' }} aria-hidden="true">
                      {shape.icon}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{shape.category}</div>
                      <div className="ea-text-muted" style={{ fontSize: 11 }}>
                        {shape.sentence}
                      </div>
                    </td>
                    <td className="ea-text-muted" style={{ fontSize: 12 }}
                        title={j.startedAt}>{fmtAgo(j.startedAt)}</td>
                    <td>
                      <span className={`ea-chip ea-chip--${operatorStateTone(os)}`}>{os}</span>
                    </td>
                  </tr>
                );
              })}
              {(jobs ?? []).length === 0 && (
                <tr><td colSpan={4} className="ea-text-muted"
                        style={{ textAlign: 'center', padding: 16 }}>
                  No sync runs yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ActionCard({ icon, title, desc, button, onClick, disabled, hint, testId, detailLink }: {
  icon: string;
  title: string;
  desc: string;
  button: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  testId?: string;
  detailLink?: readonly [string, string];
}): JSX.Element {
  return (
    <section data-test={testId}
             style={{
               padding: 16, border: '1px solid var(--der-border-subtle)',
               borderRadius: 8, background: 'white',
               display: 'flex', flexDirection: 'column', gap: 10,
             }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 32, lineHeight: 1 }} aria-hidden="true">{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--der-ink-500)', lineHeight: 1.4 }}>
            {desc}
          </p>
        </div>
      </div>
      <button type="button"
              className="ea-btn ea-btn--primary"
              style={{ fontSize: 14, padding: '10px 14px' }}
              disabled={disabled}
              onClick={onClick}>
        {button}
      </button>
      {hint && (
        <p className="ea-text-muted" style={{ margin: 0, fontSize: 11 }}>{hint}</p>
      )}
      {detailLink && (
        <Link to={detailLink[1]} className="ea-link-btn" style={{ fontSize: 12 }}>
          {detailLink[0]} →
        </Link>
      )}
    </section>
  );
}
