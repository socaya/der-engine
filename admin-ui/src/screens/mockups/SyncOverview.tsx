import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, fmtAgo, syncActivityShape, operatorState, operatorStateTone,
  SyncStatusBar, Spinner, useTriggerAndWatch, type SyncStatusTone,
} from './shared';
import { LoadingBlock } from '../../components/ScreenStates';

/**
 * `/admin/sync` — Overview per DER Sync requirements §5.
 *
 * Compact status bar on top (no chunky hero card) with Pull-metadata +
 * Push-data as inline toolbar actions that run the Quartz triggers and
 * poll for completion. Recent activity feed below.
 */
export function MockupSyncOverview(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [jobs, setJobs] = useState<edgeApi.JobRun[] | null>(null);
  const [stats, setStats] = useState<edgeApi.JournalStatsByType | null>(null);
  const [sysInfo, setSysInfo] = useState<edgeApi.SystemInfo | null>(null);

  const pull = useTriggerAndWatch();
  const push = useTriggerAndWatch();

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

  // After a pull/push completes, reload all state so the activity
  // feed + counts reflect the new run.
  useEffect(() => {
    if (pull.state === 'done' || pull.state === 'failed') {
      reload().catch(() => undefined);
    }
  }, [pull.state]);
  useEffect(() => {
    if (push.state === 'done' || push.state === 'failed') {
      reload().catch(() => undefined);
    }
  }, [push.state]);

  if (!w) return <LoadingBlock testId="loading" />;

  const centralReachable = sysInfo?.dhis2?.probeReachable ?? false;
  const attentionCount = stats
    ? Object.values(stats).reduce((a, b) =>
        a + (b.CONFLICT_REVIEW ?? 0) + (b.RETRYABLE ?? 0) + (b.CENTRAL_REJECTED ?? 0), 0)
    : 0;
  const waitingCount = stats
    ? Object.values(stats).reduce((a, b) => a + (b.PENDING ?? 0) + (b.IN_FLIGHT ?? 0), 0)
    : 0;

  let tone: SyncStatusTone;
  let title: string;
  if (!w.enabled) {
    tone = 'muted'; title = 'Sync is paused';
  } else if (!centralReachable) {
    tone = 'warning'; title = 'Central DHIS2 is unavailable';
  } else if (attentionCount > 0) {
    tone = 'danger';
    title = `Sync needs attention · ${attentionCount} record${attentionCount === 1 ? '' : 's'}`;
  } else if (waitingCount > 0) {
    tone = 'info';
    title = `Sync is working · ${waitingCount.toLocaleString()} record${waitingCount === 1 ? '' : 's'} waiting`;
  } else {
    tone = 'success'; title = 'Sync is working · all local data has been sent';
  }

  const lastSuccess = (jobs ?? []).find((j) => j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS');

  // Button labels + disable logic per spec §14.
  const pullBusy = pull.state === 'triggering' || pull.state === 'running';
  const pushBusy = push.state === 'triggering' || push.state === 'running';
  const pullDisabled = pullBusy || !centralReachable;
  const pushDisabled = pushBusy || !centralReachable || !w.enabled;

  return (
    <div className="ea-screen" data-test="sync-hub">
      <SyncStatusBar
        tone={tone}
        title={title}
        details={
          <>
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
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                    data-test="sync-pull-metadata"
                    disabled={pullDisabled}
                    title={!centralReachable ? 'Central DHIS2 is unavailable' : undefined}
                    onClick={() => { pull.trigger('METADATA_SYNC_FULL').catch(() => undefined); }}>
              {pullBusy && <Spinner />} <span style={{ marginLeft: pullBusy ? 6 : 0 }}>
                {pull.state === 'running' ? 'Pulling metadata…' : 'Pull metadata'}
              </span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="sync-push-data"
                    disabled={pushDisabled}
                    title={!w.enabled ? 'Worker is paused — resume it on the Worker page'
                      : !centralReachable ? 'Central DHIS2 is unavailable' : undefined}
                    onClick={() => { push.trigger('JOURNAL_WORKER_DRAIN').catch(() => undefined); }}>
              {pushBusy && <Spinner />} <span style={{ marginLeft: pushBusy ? 6 : 0 }}>
                {push.state === 'running' ? 'Pushing data…' : 'Push data'}
              </span>
            </button>
          </>
        }
      />

      {(pull.state !== 'idle' || push.state !== 'idle') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
          {pull.state !== 'idle' && (
            <ProgressStrip label="Pull metadata" state={pull.state} message={pull.message}
                           onDismiss={pull.state === 'done' || pull.state === 'failed' || pull.state === 'timeout'
                             ? pull.reset : undefined} />
          )}
          {push.state !== 'idle' && (
            <ProgressStrip label="Push data" state={push.state} message={push.message}
                           onDismiss={push.state === 'done' || push.state === 'failed' || push.state === 'timeout'
                             ? push.reset : undefined} />
          )}
        </div>
      )}

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

function ProgressStrip({ label, state, message, onDismiss }: {
  label: string;
  state: 'triggering' | 'running' | 'done' | 'failed' | 'timeout';
  message: string;
  onDismiss?: () => void;
}): JSX.Element {
  const tone = state === 'done' ? 'success'
             : state === 'failed' ? 'danger'
             : state === 'timeout' ? 'warning'
             : 'info';
  const accent = tone === 'success' ? 'var(--der-success, #16a34a)'
               : tone === 'danger' ? 'var(--der-danger, #dc2626)'
               : tone === 'warning' ? 'var(--der-warning, #d97706)'
               : 'var(--der-primary)';
  const busy = state === 'triggering' || state === 'running';
  return (
    <div data-test={`progress-${label.toLowerCase().replace(' ', '-')}`}
         style={{
           display: 'flex', alignItems: 'center', gap: 10,
           padding: '6px 12px', borderRadius: 4,
           background: 'var(--der-ink-50)',
           borderLeft: `3px solid ${accent}`,
           fontSize: 12,
         }}>
      {busy ? <Spinner /> : <span style={{ fontSize: 13, color: accent }} aria-hidden="true">●</span>}
      <strong style={{ color: 'var(--der-ink-900)' }}>{label}:</strong>
      <span style={{ flex: 1, color: 'var(--der-ink-700)' }}>{message}</span>
      {busy && (
        <div style={{
          height: 3, background: 'var(--der-ink-100)', borderRadius: 2,
          overflow: 'hidden', width: 140, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            animation: 'der-prog 1.4s linear infinite',
          }} />
        </div>
      )}
      {onDismiss && (
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  );
}
