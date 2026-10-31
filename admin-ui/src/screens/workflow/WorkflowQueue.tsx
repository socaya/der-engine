import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

/**
 * Operator work queue — "my inbox" across all active workflow runs.
 * Spec §51–§52. The server role-filters rows against the signed-in
 * user's granted roles; this screen just renders what it gets back.
 */
export interface WorkflowQueueProps {
  api?: Pick<typeof edgeApi, 'workflowQueue'>;
}

// 2.3.24 — Streaming cue label.
function StreamBadge({ connected }: { connected: boolean }): JSX.Element {
  return (
    <span className={`ea-pill ea-pill--${connected ? 'success' : 'muted'}`}
           data-test="queue-stream-badge"
           title={connected ? 'Live updates via SSE' : 'Polling fallback'}
           style={{ marginLeft: 8, fontSize: 11 }}>
      {connected ? '● live' : '○ polling'}
    </span>
  );
}

export function WorkflowQueue({ api = edgeApi }:
    WorkflowQueueProps = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.WorkflowQueueRow[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'BLOCKED'>('ALL');
  const [deviceId, setDeviceId] = useState<string | ''>('');
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

  async function reload(scope?: string): Promise<void> {
    try {
      const r = await api.workflowQueue(scope === '' ? undefined : scope);
      setRows(r.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    edgeApi.listDevices().then((d) => setDevices(d.devices ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    reload(deviceId).catch(() => undefined);
    // §2.3.24 — SSE push instead of a 15 s poll. We still refresh on
    // scope change, and keep a 60 s safety-net poll in case the stream
    // drops silently (reverse proxies, laptop sleep, etc).
    const es = new EventSource('/edge-api/v1/workflows/queue/stream');
    es.addEventListener('hello', () => setStreamConnected(true));
    es.addEventListener('queue.invalidate',
      () => { reload(deviceId).catch(() => undefined); });
    es.onerror = () => setStreamConnected(false);
    const safetyNet = window.setInterval(
      () => { reload(deviceId).catch(() => undefined); }, 60_000);
    return () => {
      es.close();
      window.clearInterval(safetyNet);
    };
  }, [api, deviceId]);

  if (error) {
    return <ErrorBlock title="Queue load failed"
                        testId="queue-error">{error}</ErrorBlock>;
  }
  if (rows == null) {
    return <LoadingBlock testId="queue-loading" />;
  }

  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.readiness === filter);
  const readyCount = rows.filter((r) => r.readiness === 'READY').length;
  const blockedCount = rows.length - readyCount;

  return (
    <div className="ea-screen" data-test="queue-root">
      <h1 data-test="queue-heading">
        My work
        <StreamBadge connected={streamConnected} />
      </h1>
      <p className="ea-text-muted">
        Workflow steps that are ready for you to capture, plus steps
        that are waiting on an earlier step to finish. Updates push via
        a live stream — a 60-second safety-net poll backs it up.
      </p>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center',
                     flexWrap: 'wrap', margin: 'var(--sp-3) 0' }}>
        <div className="ea-queue-tabs" data-test="queue-tabs" role="tablist">
          <TabBtn label={`All (${rows.length})`} value="ALL" current={filter} onPick={setFilter} />
          <TabBtn label={`Ready (${readyCount})`} value="READY" current={filter} onPick={setFilter} />
          <TabBtn label={`Blocked (${blockedCount})`} value="BLOCKED" current={filter} onPick={setFilter} />
        </div>
        <label className="ea-wizard-field" style={{ margin: 0, maxWidth: 280 }}>
          <span>Device scope</span>
          <select data-test="queue-device-filter" value={deviceId}
                   onChange={(e) => setDeviceId(e.target.value)}>
            <option value="">All devices</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.displayName ?? d.deviceId.slice(0, 12)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title={filter === 'ALL' ? 'No pending work'
                             : filter === 'READY' ? 'Nothing ready for you'
                                                     : 'Nothing blocked'}
                     testId="queue-empty">
          {filter === 'READY' && 'When a step becomes ready for your role, it will show up here.'}
          {filter === 'BLOCKED' && 'Blocked steps are waiting on an earlier step to complete.'}
          {filter === 'ALL' && 'You will see rows here once a workflow run opens and a step matches your role.'}
        </EmptyBlock>
      ) : (
        <table className="ea-table ea-queue-table" data-test="queue-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Step</th>
              <th>Role</th>
              <th>Readiness</th>
              <th>Issues</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.runId}-${r.stepId}`}
                   data-test={`queue-row-${r.runId}-${r.stepId}`}
                   className={r.readiness === 'BLOCKED' ? 'is-dim' : ''}>
                <td style={{ fontWeight: 500 }}>
                  <Link to={`/workflows/${r.workflowId}`}>
                    {r.workflowName}
                  </Link>
                  <div className="ea-text-muted" style={{ fontSize: 12 }}>
                    run · {r.businessKey ?? r.runId.slice(0, 8)}
                  </div>
                </td>
                <td>
                  <strong>#{r.stepOrdinal}</strong> · {r.stepName}
                </td>
                <td>{r.ownerRole}</td>
                <td>
                  <ReadinessPill readiness={r.readiness} />
                </td>
                <td>
                  {r.validationErrorCount > 0 ? (
                    <Link to={`/workflows/runs/${r.runId}/validation`}
                          className="ea-pill ea-pill--error"
                          data-test={`queue-row-${r.runId}-${r.stepId}-issues`}>
                      {r.validationErrorCount} issue{r.validationErrorCount === 1 ? '' : 's'}
                    </Link>
                  ) : (
                    <span className="ea-text-muted" style={{ fontSize: 12 }}>—</span>
                  )}
                </td>
                <td className="ea-text-muted" style={{ fontSize: 12 }}>
                  {new Date(r.runUpdatedAt).toLocaleString()}
                </td>
                <td>
                  <Link to={`/workflows/runs?workflow=${r.workflowId}`}
                        className="ea-btn ea-btn--ghost ea-btn--sm"
                        data-test={`queue-row-${r.runId}-${r.stepId}-open`}>
                    Open run
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ReadinessPill({ readiness }: { readiness: 'READY' | 'BLOCKED' }): JSX.Element {
  return (
    <span className={`ea-pill ea-pill--${readiness === 'READY' ? 'success' : 'muted'}`}
           data-test={`queue-pill-${readiness.toLowerCase()}`}>
      {readiness === 'READY' ? 'Ready' : 'Blocked'}
    </span>
  );
}

function TabBtn({ label, value, current, onPick }: {
    label: string;
    value: 'ALL' | 'READY' | 'BLOCKED';
    current: 'ALL' | 'READY' | 'BLOCKED';
    onPick: (v: 'ALL' | 'READY' | 'BLOCKED') => void;
}): JSX.Element {
  const active = current === value;
  return (
    <button type="button"
             className={'ea-queue-tab' + (active ? ' is-active' : '')}
             data-test={`queue-tab-${value.toLowerCase()}`}
             onClick={() => onPick(value)}
             role="tab" aria-selected={active}>
      {label}
    </button>
  );
}
