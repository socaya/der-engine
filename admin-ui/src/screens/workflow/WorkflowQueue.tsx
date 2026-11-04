import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { Panel, Status, SyncStatusBar } from '../shared';
import { UiIcon } from '../../components/UiIcon';

export interface WorkflowQueueProps {
  api?: Pick<typeof edgeApi, 'workflowQueue'>;
}

export function WorkflowQueue({ api = edgeApi }:
    WorkflowQueueProps = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.WorkflowQueueRow[] | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'READY' | 'BLOCKED'>('ALL');
  const [deviceId, setDeviceId] = useState<string | ''>('');
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload(scope?: string): Promise<void> {
    try {
      // "" = All devices → force server to drop any saved pref.
      // non-empty → explicit scope.
      const r = await api.workflowQueue(
        scope === '' ? { allDevices: true } : { deviceId: scope });
      setRows(r.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    edgeApi.listDevices().then((d) => setDevices(d.devices ?? [])).catch(() => undefined);
    // Load saved pref into the local picker so operators see what the
    // auto-scope is bound to. The server reads the pref itself, so
    // this is purely for display.
    edgeApi.readAllUserPrefs()
      .then((p) => {
        const pref = p.prefs?.[edgeApi.PREF_PREFERRED_DEVICE];
        if (pref) setDeviceId(pref);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    reload(deviceId).catch(() => undefined);
    const es = new EventSource('/edge-api/v1/workflows/queue/stream');
    es.addEventListener('queue.invalidate',
      () => { reload(deviceId).catch(() => undefined); });
    const safetyNet = window.setInterval(
      () => { reload(deviceId).catch(() => undefined); }, 60_000);
    return () => {
      es.close();
      window.clearInterval(safetyNet);
    };
    // Why: reload closes over state; re-run only when api/deviceId changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const totalIssues = rows.reduce((a, r) => a + r.validationErrorCount, 0);
  const tone: 'success' | 'info' | 'warning' | 'muted' = rows.length === 0
    ? 'muted'
    : totalIssues > 0
      ? 'warning'
      : blockedCount === 0
        ? 'success'
        : 'info';
  const statusLabel = rows.length === 0
    ? 'Queue empty'
    : totalIssues > 0
      ? `${totalIssues} issue${totalIssues === 1 ? '' : 's'} · ${readyCount} ready · ${blockedCount} blocked`
      : `${readyCount} ready · ${blockedCount} blocked`;

  return (
    <div className="ea-screen" data-test="queue-root">
      <SyncStatusBar
        tone={tone}
        title="My queue"
        statusLabel={statusLabel}
        subtitle="Steps waiting on this operator across every workflow run.  Ready rows can be acted on immediately; Blocked rows are waiting for upstream steps or validation issues to clear."
        actions={
          <>
            <Link to="/workflows"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Workflows"
                  data-test="queue-open-activity">
              <UiIcon icon="overview" size={14} />
              <span>Activity</span>
            </Link>
            <Link to="/workflows/monitoring"
                  className="ea-btn ea-btn--ghost ea-btn--sm"
                  data-cross-module="Workflows"
                  data-test="queue-open-monitoring">
              <UiIcon icon="analytics" size={14} />
              <span>Monitoring</span>
            </Link>
          </>
        }
      />
      <h1 className="ea-visually-hidden" data-test="queue-heading">My queue</h1>

      <Panel title={`Steps (${filtered.length}${filter === 'ALL' ? '' : ' of ' + rows.length})`}
             action={
               <div style={{ display: 'flex', gap: 8, alignItems: 'center',
                              flexWrap: 'wrap' }}>
                 <div className="ea-queue-tabs" data-test="queue-tabs" role="tablist">
                   <TabBtn label={`All (${rows.length})`} value="ALL" current={filter} onPick={setFilter} />
                   <TabBtn label={`Ready (${readyCount})`} value="READY" current={filter} onPick={setFilter} />
                   <TabBtn label={`Blocked (${blockedCount})`} value="BLOCKED" current={filter} onPick={setFilter} />
                 </div>
                 <select aria-label="Filter queue by device"
                         className="ea-input"
                         data-test="queue-device-filter"
                         style={{ width: 200 }}
                         value={deviceId}
                         onChange={(e) => {
                           const v = e.target.value;
                           setDeviceId(v);
                           if (v === '') {
                             edgeApi.deleteUserPref(edgeApi.PREF_PREFERRED_DEVICE)
                               .catch(() => undefined);
                           } else {
                             edgeApi.writeUserPref(edgeApi.PREF_PREFERRED_DEVICE, v)
                               .catch(() => undefined);
                           }
                         }}>
                   <option value="">All devices</option>
                   {devices.map((d) => (
                     <option key={d.deviceId} value={d.deviceId}>
                       {d.displayName ?? d.deviceId.slice(0, 12)}
                     </option>
                   ))}
                 </select>
               </div>
             }>
        {filtered.length === 0 ? (
          <EmptyBlock title={rows.length === 0 ? 'Queue empty' : 'Nothing here'}
                      testId="queue-empty">
            {rows.length === 0
              ? 'No steps are waiting on this operator right now.'
              : 'No steps match the current device + filter scope.'}
          </EmptyBlock>
        ) : (
          <div className="ea-table-wrap">
            <table className="ea-table ea-table--dense" data-test="queue-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Step</th>
                  <th style={{ width: 110 }}>Role</th>
                  <th style={{ width: 110 }}>Readiness</th>
                  <th style={{ width: 110 }}>Issues</th>
                  <th style={{ width: 160 }}>Updated</th>
                  <th style={{ width: 90 }} aria-label="actions"></th>
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
                    <td data-test={`queue-row-${r.runId}-${r.stepId}-readiness`}>
                      <ReadinessPill readiness={r.readiness} />
                    </td>
                    <td>
                      {r.validationErrorCount > 0 ? (
                        <Link to={`/workflows/runs/${r.runId}/validation`}
                              data-test={`queue-row-${r.runId}-${r.stepId}-issues`}
                              style={{ textDecoration: 'none' }}>
                          <Status tone="danger">
                            {r.validationErrorCount} issue{r.validationErrorCount === 1 ? '' : 's'}
                          </Status>
                        </Link>
                      ) : (
                        <span className="ea-text-muted">—</span>
                      )}
                    </td>
                    <td className="ea-text-muted">
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
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReadinessPill({ readiness }: { readiness: 'READY' | 'BLOCKED' }): JSX.Element {
  return (
    <span data-test={`queue-pill-${readiness.toLowerCase()}`}>
      {readiness === 'READY'
        ? <Status tone="success">Ready</Status>
        : <Status tone="muted">Blocked</Status>}
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
