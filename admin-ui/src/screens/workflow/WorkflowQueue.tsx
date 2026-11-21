import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { Panel, Status, SyncStatusBar, RowMenu, type RowMenuItem,
         usePaged, TablePager } from '../shared';
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

  const filtered = filter === 'ALL' || rows == null
    ? (rows ?? [])
    : rows.filter((r) => r.readiness === filter);
  const readyCount = (rows ?? []).filter((r) => r.readiness === 'READY').length;
  const blockedCount = (rows ?? []).length - readyCount;
  /* `usePaged` must stay above every early-return so React sees the
   * same hook order on every render. */
  const paged = usePaged(filtered, 25);

  if (error) {
    return <ErrorBlock title="Queue load failed"
                        testId="queue-error">{error}</ErrorBlock>;
  }
  if (rows == null) {
    return <LoadingBlock testId="queue-loading" />;
  }

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

      <Panel title={`${filtered.length} step${filtered.length === 1 ? '' : 's'}${filter === 'ALL' ? '' : ' of ' + rows.length}`}
             action={
               <div className="ea-data-filterbar" role="group" aria-label="Filters">
                 <select className="ea-input ea-input--compact"
                         data-test="queue-readiness-filter"
                         value={filter}
                         onChange={(e) => setFilter(e.target.value as typeof filter)}
                         aria-label="Filter queue by readiness">
                   <option value="ALL">All ({rows.length})</option>
                   <option value="READY">Ready ({readyCount})</option>
                   <option value="BLOCKED">Blocked ({blockedCount})</option>
                 </select>
                 <select className="ea-input ea-input--compact"
                         data-test="queue-device-filter"
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
                         }}
                         aria-label="Filter queue by device">
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
            <table className="ea-table ea-table--dense ea-table--nowrap" data-test="queue-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th className="ea-col-w-140">Run</th>
                  <th>Step</th>
                  <th className="ea-col-w-110">Role</th>
                  <th className="ea-col-w-110">Readiness</th>
                  <th className="ea-col-w-110">Issues</th>
                  <th className="ea-col-w-140 ea-text-right">Updated</th>
                  <th className="ea-col-w-48 ea-text-right" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((r) => {
                  const menuItems: RowMenuItem[] = [
                    { label: 'Open run',
                      to: `/workflows/runs?workflow=${r.workflowId}`,
                      dataTest: `queue-row-${r.runId}-${r.stepId}-open` },
                    { label: 'Open workflow',
                      to: `/workflows/${r.workflowId}` },
                  ];
                  if (r.validationErrorCount > 0) {
                    menuItems.push({
                      label: `View ${r.validationErrorCount} issue${r.validationErrorCount === 1 ? '' : 's'}`,
                      to: `/workflows/runs/${r.runId}/validation`,
                    });
                  }
                  return (
                    <tr key={`${r.runId}-${r.stepId}`}
                        data-test={`queue-row-${r.runId}-${r.stepId}`}
                        className={r.readiness === 'BLOCKED' ? 'is-dim' : ''}>
                      <td className="ea-fw-medium"
                          title={r.workflowName}>
                        <Link to={`/workflows/${r.workflowId}`}
                              style={{ color: 'var(--der-ink-900)',
                                       textDecoration: 'none' }}>
                          {r.workflowName}
                        </Link>
                      </td>
                      <td className="ea-mono ea-text-2xs ea-text-muted"
                          title={r.runId}>
                        {r.businessKey ?? r.runId.slice(0, 8)}
                      </td>
                      <td title={r.stepName}>
                        <strong>#{r.stepOrdinal}</strong>{' '}{r.stepName}
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
                      <td className="ea-text-muted ea-text-xs ea-text-right">
                        {new Date(r.runUpdatedAt).toLocaleDateString()}
                      </td>
                      <td className="ea-text-right">
                        <RowMenu items={menuItems} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePager {...paged.pagerProps} />
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

/* Phase-4B: `TabBtn` chip-tab component removed — the readiness
 * filter is now the standard `.ea-input--compact` select inside
 * `.ea-data-filterbar`, matching every other listing screen. */
