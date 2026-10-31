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

export function WorkflowQueue({ api = edgeApi }:
    WorkflowQueueProps = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.WorkflowQueueRow[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'BLOCKED'>('ALL');
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const r = await api.workflowQueue();
      setRows(r.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    reload().catch(() => undefined);
    const t = window.setInterval(() => { reload().catch(() => undefined); }, 15_000);
    return () => window.clearInterval(t);
  }, [api]);

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
      <h1 data-test="queue-heading">My work</h1>
      <p className="ea-text-muted">
        Workflow steps that are ready for you to capture, plus steps
        that are waiting on an earlier step to finish. Updates every 15
        seconds.
      </p>

      <div className="ea-queue-tabs" data-test="queue-tabs" role="tablist">
        <TabBtn label={`All (${rows.length})`} value="ALL" current={filter} onPick={setFilter} />
        <TabBtn label={`Ready (${readyCount})`} value="READY" current={filter} onPick={setFilter} />
        <TabBtn label={`Blocked (${blockedCount})`} value="BLOCKED" current={filter} onPick={setFilter} />
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
