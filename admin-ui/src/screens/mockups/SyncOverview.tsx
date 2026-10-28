import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import {
  Panel, fmtAgo, syncActivityShape, operatorState, operatorStateTone,
  SyncStatusBar, Spinner, useTriggerAndWatch, type SyncStatusTone, Status,
} from './shared';
import { UiIcon } from '../../components/UiIcon';
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
  let statusLabel: string;
  if (!w.enabled) {
    tone = 'muted'; statusLabel = 'Paused';
  } else if (!centralReachable) {
    tone = 'warning'; statusLabel = 'Central unavailable';
  } else if (attentionCount > 0) {
    tone = 'danger'; statusLabel = 'Needs attention';
  } else if (waitingCount > 0) {
    tone = 'info'; statusLabel = `${waitingCount.toLocaleString()} waiting`;
  } else {
    tone = 'success'; statusLabel = 'Up to date';
  }

  const lastSuccess = (jobs ?? []).find((j) => j.outcome === 'SUCCEEDED' || j.outcome === 'SUCCESS');

  const pullBusy = pull.state === 'triggering' || pull.state === 'running';
  const pushBusy = push.state === 'triggering' || push.state === 'running';
  const pullDisabled = pullBusy || !centralReachable;
  const pushDisabled = pushBusy || !centralReachable || !w.enabled;

  return (
    <div className="ea-screen" data-test="sync-hub">
      <SyncStatusBar
        tone={tone}
        title="Synchronisation"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>
              Last successful sync{' '}
              <strong style={{ color: 'var(--der-ink-900)' }}>
                {lastSuccess ? fmtAgo(lastSuccess.startedAt) : 'never'}
              </strong>
            </span>
            <span>·</span>
            <span>
              Central DHIS2{' '}
              <strong style={{ color: 'var(--der-ink-900)' }}>
                {centralReachable ? 'reachable' : 'unreachable'}
              </strong>
            </span>
            {attentionCount > 0 && (
              <>
                <span>·</span>
                <Link to="/sync/attention">
                  {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
                </Link>
              </>
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
              {pullBusy ? <Spinner /> : <UiIcon icon="pull" size={14} />}
              <span>{pull.state === 'running' ? 'Pulling metadata…' : 'Pull metadata'}</span>
            </button>
            <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                    data-test="sync-push-data"
                    disabled={pushDisabled}
                    title={!w.enabled ? 'Worker is paused — resume it on the Worker page'
                      : !centralReachable ? 'Central DHIS2 is unavailable' : undefined}
                    onClick={() => { push.trigger('JOURNAL_WORKER_DRAIN').catch(() => undefined); }}>
              {pushBusy ? <Spinner /> : <UiIcon icon="push" size={14} />}
              <span>{push.state === 'running' ? 'Pushing data…' : 'Push data'}</span>
            </button>
          </>
        }
      />

      {(pull.state !== 'idle' || push.state !== 'idle') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
          {pull.state !== 'idle' && (
            <ProgressRow label="Pull metadata" state={pull.state} message={pull.message}
                         onDismiss={pull.state !== 'triggering' && pull.state !== 'running'
                           ? pull.reset : undefined} />
          )}
          {push.state !== 'idle' && (
            <ProgressRow label="Push data" state={push.state} message={push.message}
                         onDismiss={push.state !== 'triggering' && push.state !== 'running'
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
              <th style={{ width: 180 }}>Activity</th>
              <th>Detail</th>
              <th style={{ width: 90 }}>When</th>
              <th style={{ width: 110 }}>Result</th>
            </tr></thead>
            <tbody>
              {(jobs ?? []).slice(0, 8).map((j) => {
                const shape = syncActivityShape(j.jobName, j.detail);
                const os = operatorState(j.outcome);
                return (
                  <tr key={j.runId}>
                    <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true">
                      <UiIcon icon={shape.icon} size={18} />
                    </td>
                    <td style={{ fontWeight: 500 }}>{shape.category}</td>
                    <td className="ea-text-muted">{shape.sentence}</td>
                    <td className="ea-text-muted"
                        title={j.startedAt}>{fmtAgo(j.startedAt)}</td>
                    <td>
                      <Status tone={operatorStateTone(os)}>{os}</Status>
                    </td>
                  </tr>
                );
              })}
              {(jobs ?? []).length === 0 && (
                <tr><td colSpan={5} className="ea-text-muted"
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

function ProgressRow({ label, state, message, onDismiss }: {
  label: string;
  state: 'triggering' | 'running' | 'done' | 'failed' | 'timeout';
  message: string;
  onDismiss?: () => void;
}): JSX.Element {
  const chipClass = state === 'done' ? 'ea-chip ea-chip--success'
                  : state === 'failed' ? 'ea-chip ea-chip--danger'
                  : state === 'timeout' ? 'ea-chip ea-chip--warning'
                  : 'ea-chip ea-chip--info';
  const busy = state === 'triggering' || state === 'running';
  const chipLabel = state === 'triggering' ? 'Starting'
                  : state === 'running' ? 'Running'
                  : state === 'done' ? 'Completed'
                  : state === 'failed' ? 'Failed'
                  : 'Still running';
  return (
    <div data-test={`progress-${label.toLowerCase().replace(' ', '-')}`}
         style={{
           display: 'flex', alignItems: 'center', gap: 8,
           fontSize: 12, color: 'var(--der-ink-500)',
         }}>
      {busy && <Spinner />}
      <span className={chipClass}>{chipLabel}</span>
      <strong style={{ color: 'var(--der-ink-900)' }}>{label}</strong>
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button type="button" className="ea-link-btn"
                style={{ fontSize: 11 }}
                onClick={onDismiss}>Dismiss</button>
      )}
    </div>
  );
}
