import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, SyncStatusBar, Status,
         type SyncStatusTone, fmtAgo } from '../shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { UiIcon } from '../../components/UiIcon';

/**
 * §2.3.59 — Workflow monitoring. Admin-side read-only dashboard that
 * answers:
 *   • Where is work pooling up?    → depth per workflow × step
 *   • Who's falling behind?         → oldest ready step per owner device
 *   • What's moving?                → high-level counts
 *
 * Uses only the existing /workflows/queue endpoint; richer latency
 * telemetry (percentiles, prefetch readiness) is a follow-up that
 * needs a server-side step-transition record.
 */

export interface WorkflowMonitoringProps {
  api?: Pick<typeof edgeApi, 'workflowQueue' | 'listDevices'>;
}

interface WorkflowBreakdown {
  workflowId: string;
  workflowName: string;
  ready: number;
  blocked: number;
  oldestReady: edgeApi.WorkflowQueueRow | null;
}

interface DeviceBreakdown {
  deviceId: string | null;
  deviceName: string;
  ready: number;
  blocked: number;
  oldestReady: edgeApi.WorkflowQueueRow | null;
}

interface StepBreakdown {
  workflowId: string;
  workflowName: string;
  stepId: string;
  stepName: string;
  stepOrdinal: number;
  ready: number;
  blocked: number;
}

export function WorkflowMonitoring({ api = edgeApi }:
    WorkflowMonitoringProps = {}): JSX.Element {
  const [rows, setRows] = useState<edgeApi.WorkflowQueueRow[] | null>(null);
  const [devices, setDevices] = useState<edgeApi.EdgeDeviceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const [qRes, dRes] = await Promise.allSettled([
        api.workflowQueue({ allDevices: true }),
        api.listDevices(),
      ]);
      if (qRes.status === 'fulfilled') setRows(qRes.value.rows);
      if (dRes.status === 'fulfilled') setDevices(dRes.value.devices ?? []);
      setLoadedAt(new Date().toISOString());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => { reload().catch(() => undefined); }, []);

  const deviceNameById = useMemo(() => {
    const m = new Map<string, string>();
    devices.forEach((d) =>
      m.set(d.deviceId, d.displayName ?? d.deviceId.slice(0, 8)));
    return m;
  }, [devices]);

  const byWorkflow = useMemo((): WorkflowBreakdown[] => {
    if (rows == null) return [];
    const m = new Map<string, WorkflowBreakdown>();
    for (const r of rows) {
      let b = m.get(r.workflowId);
      if (!b) {
        b = { workflowId: r.workflowId, workflowName: r.workflowName,
              ready: 0, blocked: 0, oldestReady: null };
        m.set(r.workflowId, b);
      }
      if (r.readiness === 'READY') {
        b.ready += 1;
        if (b.oldestReady == null
            || r.runUpdatedAt < b.oldestReady.runUpdatedAt) {
          b.oldestReady = r;
        }
      } else {
        b.blocked += 1;
      }
    }
    return [...m.values()].sort((a, b) =>
      (b.ready + b.blocked) - (a.ready + a.blocked));
  }, [rows]);

  const byDevice = useMemo((): DeviceBreakdown[] => {
    if (rows == null) return [];
    const m = new Map<string, DeviceBreakdown>();
    for (const r of rows) {
      const key = r.ownerDeviceId ?? '__any__';
      let b = m.get(key);
      if (!b) {
        const name = r.ownerDeviceId
          ? deviceNameById.get(r.ownerDeviceId) ?? r.ownerDeviceId.slice(0, 8)
          : 'Any device (pooled)';
        b = { deviceId: r.ownerDeviceId, deviceName: name,
              ready: 0, blocked: 0, oldestReady: null };
        m.set(key, b);
      }
      if (r.readiness === 'READY') {
        b.ready += 1;
        if (b.oldestReady == null
            || r.runUpdatedAt < b.oldestReady.runUpdatedAt) {
          b.oldestReady = r;
        }
      } else {
        b.blocked += 1;
      }
    }
    return [...m.values()].sort((a, b) =>
      (b.ready + b.blocked) - (a.ready + a.blocked));
  }, [rows, deviceNameById]);

  const byStep = useMemo((): StepBreakdown[] => {
    if (rows == null) return [];
    const m = new Map<string, StepBreakdown>();
    for (const r of rows) {
      const key = r.workflowId + ':' + r.stepId;
      let b = m.get(key);
      if (!b) {
        b = { workflowId: r.workflowId, workflowName: r.workflowName,
              stepId: r.stepId, stepName: r.stepName, stepOrdinal: r.stepOrdinal,
              ready: 0, blocked: 0 };
        m.set(key, b);
      }
      if (r.readiness === 'READY') b.ready += 1;
      else b.blocked += 1;
    }
    return [...m.values()].sort((a, b) => (b.ready + b.blocked) - (a.ready + a.blocked));
  }, [rows]);

  if (rows == null && err == null) {
    return <LoadingBlock testId="wf-monitor-loading" />;
  }

  const totalReady   = rows?.filter((r) => r.readiness === 'READY').length ?? 0;
  const totalBlocked = rows?.filter((r) => r.readiness === 'BLOCKED').length ?? 0;
  const now = Date.now();
  const stale = rows?.filter((r) =>
    r.readiness === 'READY'
    && now - new Date(r.runUpdatedAt).getTime() > 24 * 3600_000).length ?? 0;

  let tone: SyncStatusTone;
  let statusLabel: string;
  if (stale > 0) {
    tone = 'danger';   statusLabel = `${stale} stuck > 24 h`;
  } else if (totalReady > 20) {
    tone = 'warning';  statusLabel = `${totalReady} ready — large backlog`;
  } else if (totalReady > 0) {
    tone = 'info';     statusLabel = `${totalReady} ready to capture`;
  } else if (totalBlocked > 0) {
    tone = 'muted';    statusLabel = `${totalBlocked} blocked`;
  } else {
    tone = 'success';  statusLabel = 'All clear';
  }

  const bold = (v: string | number): JSX.Element =>
    <strong style={{ color: 'var(--der-ink-900)' }}>{v}</strong>;

  return (
    <div className="ea-screen" data-test="wf-monitor-root">
      <SyncStatusBar
        tone={tone}
        title="Workflow monitoring"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>Ready {bold(totalReady)}</span>
            <span>·</span>
            <span>Blocked {bold(totalBlocked)}</span>
            <span>·</span>
            <span>Workflows {bold(byWorkflow.length)}</span>
            <span>·</span>
            <span>Devices {bold(byDevice.length)}</span>
            {loadedAt && (<>
              <span>·</span>
              <span>Updated {bold(fmtAgo(loadedAt))}</span>
            </>)}
          </>
        }
        actions={
          <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                   data-test="wf-monitor-refresh"
                   onClick={() => { reload().catch(() => undefined); }}>
            <UiIcon icon="refresh" size={14} />
            <span>Refresh</span>
          </button>
        }
      />

      {err && (
        <ErrorBlock title="Could not load monitoring data"
                     testId="wf-monitor-error">{err}</ErrorBlock>
      )}

      <Panel title="By workflow"
             action={<Link to="/workflows/queue" className="ea-link-btn">Open queue</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="wf-monitor-by-workflow">
            <thead>
              <tr>
                <th>Workflow</th>
                <th style={{ width: 80 }}>Ready</th>
                <th style={{ width: 80 }}>Blocked</th>
                <th style={{ width: 180 }}>Oldest ready step</th>
                <th style={{ width: 90 }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {byWorkflow.length === 0 ? (
                <tr><td colSpan={5} className="ea-text-muted"
                         style={{ textAlign: 'center', padding: 16 }}>
                  No pending work.
                </td></tr>
              ) : byWorkflow.map((b) => (
                <tr key={b.workflowId}
                     data-test={`wf-monitor-wf-${b.workflowId}`}>
                  <td style={{ fontWeight: 500 }}>
                    <Link to={`/workflows/${b.workflowId}`}>{b.workflowName}</Link>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {b.ready}
                  </td>
                  <td className="ea-text-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {b.blocked}
                  </td>
                  <td className="ea-text-muted">
                    {b.oldestReady?.stepName ?? '—'}
                  </td>
                  <td className="ea-text-muted"
                      title={b.oldestReady?.runUpdatedAt ?? undefined}>
                    {b.oldestReady ? fmtAgo(b.oldestReady.runUpdatedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="By owner device"
             action={<Link to="/devices" className="ea-link-btn">Fleet</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="wf-monitor-by-device">
            <thead>
              <tr>
                <th>Device</th>
                <th style={{ width: 80 }}>Ready</th>
                <th style={{ width: 80 }}>Blocked</th>
                <th style={{ width: 180 }}>Oldest ready step</th>
                <th style={{ width: 90 }}>Age</th>
              </tr>
            </thead>
            <tbody>
              {byDevice.length === 0 ? (
                <tr><td colSpan={5} className="ea-text-muted"
                         style={{ textAlign: 'center', padding: 16 }}>
                  No pending work.
                </td></tr>
              ) : byDevice.map((b) => {
                const now2 = Date.now();
                const ageMs = b.oldestReady
                  ? now2 - new Date(b.oldestReady.runUpdatedAt).getTime()
                  : 0;
                const warnStale = ageMs > 24 * 3600_000;
                return (
                  <tr key={b.deviceId ?? '__any__'}
                       data-test={`wf-monitor-dev-${b.deviceId ?? 'any'}`}>
                    <td style={{ fontWeight: 500 }}>
                      {b.deviceName}
                      {b.deviceId == null && (
                        <>  <Status tone="muted">pooled</Status></>
                      )}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {b.ready}
                    </td>
                    <td className="ea-text-muted"
                        style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {b.blocked}
                    </td>
                    <td className="ea-text-muted">
                      {b.oldestReady?.stepName ?? '—'}
                      {warnStale && (
                        <>  <Status tone="danger">stuck</Status></>
                      )}
                    </td>
                    <td className="ea-text-muted"
                        title={b.oldestReady?.runUpdatedAt ?? undefined}>
                      {b.oldestReady ? fmtAgo(b.oldestReady.runUpdatedAt) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Service-point pressure"
             action={<Link to="/workflows/queue" className="ea-link-btn">Operator queue</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="wf-monitor-by-step">
            <thead>
              <tr>
                <th>Service point</th>
                <th>Workflow</th>
                <th style={{ width: 80 }}>Ready</th>
                <th style={{ width: 80 }}>Blocked</th>
              </tr>
            </thead>
            <tbody>
              {byStep.length === 0 ? (
                <tr><td colSpan={4} className="ea-text-muted"
                         style={{ textAlign: 'center', padding: 16 }}>
                  No pending work.
                </td></tr>
              ) : byStep.slice(0, 12).map((s) => (
                <tr key={s.workflowId + s.stepId}>
                  <td style={{ fontWeight: 500 }}>{s.stepName}</td>
                  <td className="ea-text-muted">
                    <Link to={`/workflows/${s.workflowId}`}>{s.workflowName}</Link>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {s.ready}
                  </td>
                  <td className="ea-text-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s.blocked}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
