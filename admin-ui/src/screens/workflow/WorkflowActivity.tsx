import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as edgeApi from '../../api/edgeApi';
import { Panel, SyncStatusBar, Status,
         type SyncStatusTone, fmtAgo } from '../shared';
import { ErrorBlock, LoadingBlock } from '../../components/ScreenStates';
import { UiIcon } from '../../components/UiIcon';

/**
 * §2.3.58/59 — admin-side Workflow activity overview, matching the
 * standard DER dashboard idiom (SyncStatusBar on top, Panel bodies,
 * .ea-table--dense for tabular detail) used by DHIS2 Overview and
 * Sync Overview.
 */

interface Counts {
  workflows: number;
  enabledWorkflows: number;
  queueReady: number;
  queueBlocked: number;
  approvals: number;
  referrals: number;
}

export interface WorkflowActivityProps {
  api?: Pick<typeof edgeApi, 'workflowQueue' | 'listPendingApprovals'
                               | 'listWorkflows'>;
}

export function WorkflowActivity({ api = edgeApi }:
    WorkflowActivityProps = {}): JSX.Element {
  const [c, setC] = useState<Counts | null>(null);
  const [workflows, setWorkflows] = useState<edgeApi.CaptureWorkflowSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  async function reload(): Promise<void> {
    try {
      const [wfRes, qRes, aRes, rRes] = await Promise.allSettled([
        api.listWorkflows(),
        api.workflowQueue({ allDevices: true }),
        api.listPendingApprovals(),
        fetch('/edge-api/v1/referral/inbox?limit=500',
              { credentials: 'include', headers: { Accept: 'application/json' } })
          .then((r) => r.ok ? r.json() : { rows: [] }),
      ]);
      const next: Counts = {
        workflows: 0, enabledWorkflows: 0,
        queueReady: 0, queueBlocked: 0,
        approvals: 0, referrals: 0,
      };
      if (wfRes.status === 'fulfilled') {
        setWorkflows(wfRes.value.workflows);
        next.workflows = wfRes.value.workflows.length;
        next.enabledWorkflows = wfRes.value.workflows.filter((w) => w.enabled).length;
      }
      if (qRes.status === 'fulfilled') {
        next.queueReady = qRes.value.rows.filter((r) => r.readiness === 'READY').length;
        next.queueBlocked = qRes.value.rows.filter((r) => r.readiness === 'BLOCKED').length;
      }
      if (aRes.status === 'fulfilled') next.approvals = aRes.value.rows.length;
      if (rRes.status === 'fulfilled') {
        const body = rRes.value as { rows?: unknown[] };
        next.referrals = body.rows?.length ?? 0;
      }
      setC(next);
      setLoadedAt(new Date().toISOString());
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }
  // Why: reload is a stable closure; run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload().catch(() => undefined); }, []);

  if (c == null && err == null) return <LoadingBlock testId="wf-activity-loading" />;

  const attention = c ? (c.approvals + c.referrals) : 0;
  const waiting = c ? c.queueBlocked : 0;
  let tone: SyncStatusTone;
  let statusLabel: string;
  if (c == null) {
    tone = 'muted'; statusLabel = 'Unknown';
  } else if (attention > 0) {
    tone = 'danger'; statusLabel = `${attention} need${attention === 1 ? 's' : ''} attention`;
  } else if (c.queueReady > 0) {
    tone = 'info'; statusLabel = `${c.queueReady} ready to capture`;
  } else if (waiting > 0) {
    tone = 'muted'; statusLabel = `${waiting} blocked`;
  } else {
    tone = 'success'; statusLabel = 'All clear';
  }

  const bold = (v: string | number): JSX.Element =>
    <strong>{v}</strong>;

  return (
    <div className="ea-screen" data-test="wf-activity-root">
      <SyncStatusBar
        tone={tone}
        title="Workflows"
        statusLabel={statusLabel}
        subtitle={
          <>
            <span>Catalogue {bold(c?.workflows ?? 0)}
              {c && c.enabledWorkflows < c.workflows
                && <> · {bold(c.enabledWorkflows)} enabled</>}</span>
            <span>·</span>
            <span>Queue ready {bold(c?.queueReady ?? 0)}</span>
            <span>·</span>
            <span>Queue blocked {bold(c?.queueBlocked ?? 0)}</span>
            <span>·</span>
            <span>Approvals pending {bold(c?.approvals ?? 0)}</span>
            <span>·</span>
            <span>Referrals pending {bold(c?.referrals ?? 0)}</span>
            {loadedAt && (<>
              <span>·</span>
              <span>Updated {bold(fmtAgo(loadedAt))}</span>
            </>)}
          </>
        }
        actions={
          <>
            <button type="button" className="ea-btn ea-btn--ghost ea-btn--sm"
                     data-test="wf-activity-refresh"
                     onClick={() => { reload().catch(() => undefined); }}>
              <UiIcon icon="refresh" size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/workflows/new"
                   className="ea-btn ea-btn--primary ea-btn--sm"
                   data-test="wf-activity-new">
              <UiIcon icon="plus" size={14} />
              <span>New workflow</span>
            </Link>
          </>
        }
      />

      {err && (
        <ErrorBlock title="Could not load activity"
                     testId="wf-activity-error">{err}</ErrorBlock>
      )}

      <Panel title="Workflow catalogue"
             action={<Link to="/workflows/manage" className="ea-link-btn">Manage</Link>}>
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense" data-test="wf-activity-catalogue">
            <thead>
              <tr>
                <th>Workflow</th>
                <th style={{ width: 140 }}>Bound to</th>
                <th style={{ width: 100 }}>Steps</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 160 }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {workflows.slice(0, 8).map((w) => (
                <tr key={w.workflowId}
                     data-test={`wf-activity-row-${w.workflowId}`}>
                  <td style={{ fontWeight: 500 }}>
                    <Link to={`/workflows/${w.workflowId}`}>{w.displayName}</Link>
                  </td>
                  <td className="ea-text-muted ea-mono"
                      style={{ fontSize: 12 }}>
                    {w.boundMetadataKind}
                  </td>
                  <td className="ea-text-muted">{w.steps?.length ?? 0}</td>
                  <td>
                    <Status tone={w.enabled ? 'success' : 'muted'}>
                      {w.enabled ? 'Enabled' : 'Disabled'}
                    </Status>
                  </td>
                  <td className="ea-text-muted"
                      title={w.updatedAt}>
                    {w.updatedAt ? fmtAgo(w.updatedAt) : '—'}
                  </td>
                </tr>
              ))}
              {workflows.length === 0 && (
                <tr>
                  <td colSpan={5} className="ea-text-muted"
                       style={{ textAlign: 'center', padding: 16 }}>
                    No workflows defined. Create one from the <Link to="/workflows/manage">Manage</Link> screen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Operational queues">
        <div className="ea-table-wrap">
          <table className="ea-table ea-table--dense"
                 data-test="wf-activity-queues">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Queue</th>
                <th style={{ width: 90 }}>Depth</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              <QueueRow icon="data-queue" label="Capture queue — ready"
                         to="/workflows/monitoring"
                         value={c?.queueReady ?? 0}
                         status={c && c.queueReady > 0
                           ? { tone: 'info', text: 'Awaiting operator' }
                           : { tone: 'success', text: 'Drained' }} />
              <QueueRow icon="data-queue" label="Capture queue — blocked"
                         to="/workflows/monitoring"
                         value={c?.queueBlocked ?? 0}
                         status={c && c.queueBlocked > 0
                           ? { tone: 'muted', text: 'Waiting on predecessor' }
                           : { tone: 'success', text: 'Clear' }} />
              <QueueRow icon="attention" label="Approvals pending"
                         to="/workflows/monitoring"
                         value={c?.approvals ?? 0}
                         status={c && c.approvals > 0
                           ? { tone: 'warning', text: 'Reviewer sign-off needed' }
                           : { tone: 'success', text: 'Clear' }} />
              <QueueRow icon="activity" label="Referrals pending intake"
                         to="/workflows/monitoring"
                         value={c?.referrals ?? 0}
                         status={c && c.referrals > 0
                           ? { tone: 'warning', text: 'Patients waiting' }
                           : { tone: 'success', text: 'Clear' }} />
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function QueueRow({ icon, label, to, value, status }: {
  icon: 'data-queue' | 'attention' | 'activity';
  label: string;
  to: string;
  value: number;
  status: { tone: 'success' | 'info' | 'warning' | 'danger' | 'muted'; text: string };
}): JSX.Element {
  return (
    <tr>
      <td style={{ textAlign: 'center', color: 'var(--der-ink-500)' }} aria-hidden="true">
        <UiIcon icon={icon} size={18} />
      </td>
      <td style={{ fontWeight: 500 }}>
        <Link to={to}>{label}</Link>
      </td>
      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {value}
      </td>
      <td>
        <Status tone={status.tone}>{status.text}</Status>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Link to={to} className="ea-link-btn">Open →</Link>
      </td>
    </tr>
  );
}
