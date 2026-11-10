import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, fmtAgo, humaniseState, SyncStatusBar, confirmThenRun } from '../shared';
import { UiIcon } from '../../components/UiIcon';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { PolicyPausedBanner } from '../../components/PolicyPausedBanner';

/** DER Sync requirements §10. One status card + Pause/Resume + an
 *  optional queue breakdown behind "Show breakdown". */
export function WorkerHealthScreen(): JSX.Element {
  const [w, setW] = useState<edgeApi.WorkerHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  async function reload(): Promise<void> {
    try { setW(await edgeApi.workerHealth()); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);
  async function toggle(): Promise<void> {
    if (!w) return;
    setBusy(true);
    try { await (w.enabled ? edgeApi.pauseWorker() : edgeApi.resumeWorker()); await reload(); }
    finally { setBusy(false); }
  }
  if (err) return <ErrorBlock title="Worker health failed" testId="err-worker">{err}</ErrorBlock>;
  if (!w) return <LoadingBlock testId="loading" />;

  const waiting = (w.backlog.PENDING ?? 0) + (w.backlog.IN_FLIGHT ?? 0);
  const retrying = w.backlog.RETRYABLE ?? 0;
  const attention = (w.backlog.CONFLICT_REVIEW ?? 0) + (w.backlog.CENTRAL_REJECTED ?? 0);
  const total = Object.values(w.backlog).reduce((a, b) => a + b, 0);

  return (
    <div className="ea-screen">
      <PolicyPausedBanner />
      <SyncStatusBar
        tone={w.enabled ? 'success' : 'warning'}
        title="Worker"
        statusLabel={w.enabled ? 'Running' : 'Paused'}
        subtitle={
          <>
            <span data-test="ea14-enabled" style={{ display: 'none' }}>
              {w.enabled ? 'Running' : 'Paused'}
            </span>
            <span>
              {total === 0
                ? 'Nothing in the queue — the worker is idle.'
                : `${total.toLocaleString()} item${total === 1 ? '' : 's'} in queue · last activity ${fmtAgo(w.lastTick)}`}
            </span>
            <span>·</span>
            <span>Waiting <strong style={{ color: 'var(--der-ink-900)' }}>{waiting.toLocaleString()}</strong></span>
            <span>·</span>
            <span>Retrying <strong style={{ color: 'var(--der-ink-900)' }}>{retrying.toLocaleString()}</strong></span>
            {attention > 0 && (
              <>
                <span>·</span>
                {/* §2.3.108 R-AC — count stays as status text; the
                    cross-module jump moves to an explicit "Open in
                    Sync" link so interactivity + target are both
                    visible, not inferred from blue text on a number. */}
                <span>Needs attention{' '}
                  <strong style={{ color: 'var(--der-danger-ink)' }}>
                    {attention.toLocaleString()}
                  </strong>
                  {' '}·{' '}
                  <Link to="/sync/attention" className="ea-link-btn"
                        style={{ fontSize: 11 }}
                        title="Open attention queue in Sync module"
                        data-cross-module="Sync">
                    Sync › Open attention →
                  </Link>
                </span>
              </>
            )}
            <span>·</span>
            <span>Last batch <strong style={{ color: 'var(--der-ink-900)' }}>{w.lastBatchSize}</strong></span>
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--primary ea-btn--sm"
                  disabled={busy}
                  onClick={() => {
                    confirmThenRun(
                      w.enabled
                        ? 'Pause the sync worker? Captured records will keep queueing locally but nothing will be sent until it resumes.'
                        : 'Resume the sync worker? It will start draining the local queue to Central DHIS2.',
                      () => { toggle().catch(() => undefined); });
                  }}
                  data-test="ea14-toggle">
            <UiIcon icon={w.enabled ? 'pause' : 'play'} size={14} />
            <span>{busy ? '…' : w.enabled ? 'Pause' : 'Resume'}</span>
          </button>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                data-test="ea14-show-breakdown"
                onClick={() => setShowBreakdown((x) => !x)}>
          {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
        </button>
      </div>

      {showBreakdown && (
        <Panel title="Queue breakdown">
          {Object.keys(w.backlog).length === 0 ? (
            <p className="ea-text-muted" style={{ margin: 0 }}>Nothing pending.</p>
          ) : (
            <div className="ea-table-wrap">
              <table className="ea-table ea-table--dense">
                <thead><tr><th>State</th><th>Operations</th></tr></thead>
                <tbody>
                  {Object.entries(w.backlog).map(([k, v]) => (
                    <tr key={k} data-test={`ea14-backlog-${k}`}>
                      <td>
                        <span className={'ea-chip ea-chip--'
                            + (k === 'FAILED' || k === 'CENTRAL_REJECTED' ? 'danger'
                              : k === 'PENDING' || k === 'RETRYABLE' || k === 'CONFLICT_REVIEW' ? 'warning'
                              : k === 'CENTRAL_ACCEPTED' ? 'success'
                              : 'info')} title={k}>
                          {humaniseState(k)}
                        </span>
                      </td>
                      <td className="ea-mono">{v as number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {w.tune && (
        <WorkerTunePanel
          current={w.tune}
          onApplied={() => { reload().catch(() => undefined); }} />
      )}
    </div>
  );
}

/** SM-3c — adjust batch size + backoff live. Values persist only
 *  until the server restarts; the env-var baselines take back over.
 *  Range hints come from the server's validation code: batchSize
 *  [1, 500], backoffBase [1, cap], backoffCap [base, 86400]. */
function WorkerTunePanel(
  { current, onApplied }: {
    current: edgeApi.WorkerTune;
    onApplied: () => void;
  },
): JSX.Element {
  const [batchSize, setBatchSize] = useState<number>(current.batchSize);
  const [base, setBase] = useState<number>(current.backoffBaseSeconds);
  const [cap, setCap] = useState<number>(current.backoffCapSeconds);
  const [saving, setSaving] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setBatchSize(current.batchSize);
    setBase(current.backoffBaseSeconds);
    setCap(current.backoffCapSeconds);
  }, [current.batchSize, current.backoffBaseSeconds, current.backoffCapSeconds]);

  const dirty = batchSize !== current.batchSize
    || base !== current.backoffBaseSeconds
    || cap !== current.backoffCapSeconds;

  async function save(): Promise<void> {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const body: Partial<edgeApi.WorkerTune> = {};
      if (batchSize !== current.batchSize) body.batchSize = batchSize;
      if (base !== current.backoffBaseSeconds) body.backoffBaseSeconds = base;
      if (cap !== current.backoffCapSeconds) body.backoffCapSeconds = cap;
      await edgeApi.tuneWorker(body);
      setOk('Applied — next drain tick uses these values.');
      onApplied();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Worker tune">
      <p className="ea-text-muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
        Live knobs for the drain loop. Changes apply to the next tick.
        Reset to the env-var baselines happens on server restart.
      </p>
      <div style={{ display: 'grid',
                     gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                     gap: 12 }}
           data-test="worker-tune-grid">
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Batch size <span className="ea-text-muted">(1–500)</span>
          </span>
          <input type="number" min={1} max={500} value={batchSize}
                 onChange={(e) => setBatchSize(Number(e.target.value))}
                 data-test="worker-tune-batch"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Backoff base (s) <span className="ea-text-muted">(≤ cap)</span>
          </span>
          <input type="number" min={1} value={base}
                 onChange={(e) => setBase(Number(e.target.value))}
                 data-test="worker-tune-base"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
        <label>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>
            Backoff cap (s) <span className="ea-text-muted">(≤ 86400)</span>
          </span>
          <input type="number" min={1} max={86400} value={cap}
                 onChange={(e) => setCap(Number(e.target.value))}
                 data-test="worker-tune-cap"
                 style={{ width: '100%', padding: '6px 8px',
                           border: '1px solid var(--der-border-soft, #cbd5e1)',
                           borderRadius: 4 }} />
        </label>
      </div>
      {err && (
        <div className="ea-toast ea-toast--err" role="alert"
             data-test="worker-tune-err"
             style={{ marginTop: 10 }}>{err}</div>
      )}
      {ok && (
        <div className="ea-toast ea-toast--ok" role="status"
             data-test="worker-tune-ok"
             style={{ marginTop: 10 }}>{ok}</div>
      )}
      <div style={{ marginTop: 12, display: 'flex',
                     justifyContent: 'flex-end' }}>
        <button type="button"
                className="ea-btn ea-btn--primary"
                data-test="worker-tune-save"
                disabled={!dirty || saving}
                onClick={() => { void save(); }}>
          {saving ? 'Saving…' : 'Apply tune'}
        </button>
      </div>
    </Panel>
  );
}

export function titleCase(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

