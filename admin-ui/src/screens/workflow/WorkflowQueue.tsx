import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { HeroHeader } from '../../components/HeroHeader';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/ScreenStates';

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

  return (
    <div className="ea-screen" data-test="queue-root">
      <HeroHeader title="My queue" />
      <h1 className="ea-visually-hidden" data-test="queue-heading">My queue</h1>

      <div className="ea-queue-controls">
        <div className="ea-queue-tabs" data-test="queue-tabs" role="tablist">
          <TabBtn label={`All (${rows.length})`} value="ALL" current={filter} onPick={setFilter} />
          <TabBtn label={`Ready (${readyCount})`} value="READY" current={filter} onPick={setFilter} />
          <TabBtn label={`Blocked (${blockedCount})`} value="BLOCKED" current={filter} onPick={setFilter} />
        </div>
        <label className="ea-field" style={{ margin: 0, maxWidth: 240 }}>
          <span className="ea-field-label">Device</span>
          <select className="ea-input" data-test="queue-device-filter"
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
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="Nothing here" testId="queue-empty">
          No steps match the current device scope.
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
                          className="ea-chip ea-chip--danger"
                          data-test={`queue-row-${r.runId}-${r.stepId}-issues`}>
                      {r.validationErrorCount} issue{r.validationErrorCount === 1 ? '' : 's'}
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
      )}
    </div>
  );
}

function ReadinessPill({ readiness }: { readiness: 'READY' | 'BLOCKED' }): JSX.Element {
  return (
    <span className={`ea-chip ea-chip--${readiness === 'READY' ? 'success' : 'neutral'}`}
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
