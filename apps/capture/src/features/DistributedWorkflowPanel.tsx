import { useEffect, useMemo, useState } from 'react';
import type { CaptureApi } from '../shared/types';

export interface WorkflowAssignment {
  readonly workflowId: string;
  readonly displayName: string;
  readonly boundMetadataKind: string;
  readonly boundMetadataId: string | null;
  readonly defaultDeviceId: string | null;
  readonly steps: ReadonlyArray<{
    readonly stepId: string;
    readonly ordinal: number;
    readonly displayName: string;
    readonly ownerRole: string | null;
    readonly ownerDeviceId: string | null;
  }>;
}

/**
 * Distributed-workflow banner — when the DER server has assigned
 * this device to specific workflow step(s), show a slim strip
 * naming the workflow + the operator's step so they know what
 * they're capturing for. The actual <em>form</em> is rendered
 * by the normal tracker/event capture components below (the
 * workflow's program is auto-selected in {@code CaptureAppInner}),
 * per the user: 'the form according to the workflow is displayed
 * NOT the workflow runs itself'.
 */
export function DistributedWorkflowPanel(
  { api, workflows, myDeviceId }: {
    api: CaptureApi;
    workflows: ReadonlyArray<WorkflowAssignment>;
    myDeviceId: string;
  },
): JSX.Element {
  const assignments = useMemo(() =>
    workflows.map((w) => ({
      workflow: w,
      mySteps: w.steps.filter((s) => s.ownerDeviceId === myDeviceId),
      wholeWorkflow: w.defaultDeviceId === myDeviceId,
    })).filter((a) => a.wholeWorkflow || a.mySteps.length > 0),
  [workflows, myDeviceId]);

  if (assignments.length === 0) return <></>;

  return (
    <div className="cap-dwf" data-test="cap-dwf">
      {assignments.map(({ workflow, mySteps, wholeWorkflow }) => {
        const myStepsLabel = wholeWorkflow
          ? 'all steps'
          : mySteps.map((s) => s.displayName).join(' · ');
        return (
          <div key={workflow.workflowId}
               data-test={'cap-dwf-banner-' + workflow.workflowId}>
            <div className="cap-dwf__banner">
              <span className="cap-dwf__eyebrow">
                Distributed workflow
              </span>
              <strong className="cap-dwf__banner-title">
                {workflow.displayName}
              </strong>
              <span className="cap-dwf__banner-meta">
                {' · your step '}<em>{myStepsLabel}</em>
              </span>
            </div>
            <HandoverQueue api={api}
                           workflowId={workflow.workflowId}
                           mySteps={mySteps}
                           allSteps={workflow.steps}
                           wholeWorkflow={wholeWorkflow} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Previous-steps handover queue — runs of this workflow that have
 * advanced to a step owned by this device (or any step when the
 * whole workflow is defaultDeviceId-assigned). Operators see their
 * waiting work without digging into Workflow Capture.
 */
function HandoverQueue(
  { api, workflowId, mySteps, allSteps, wholeWorkflow }: {
    api: CaptureApi;
    workflowId: string;
    mySteps: WorkflowAssignment['steps'];
    allSteps: WorkflowAssignment['steps'];
    wholeWorkflow: boolean;
  },
): JSX.Element | null {
  const [runs, setRuns] = useState<ReadonlyArray<{ runId: string;
    businessKey: string; currentStepId: string | null;
    state: 'OPEN' | 'AWAITING' | 'COMPLETED' | 'REJECTED';
    updatedAt: string }>>([]);
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'err'>('loading');

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const r = await api.listCaptureRuns({ workflowId });
        if (cancelled) return;
        setRuns(r.runs);
        setStatus('idle');
      } catch {
        if (!cancelled) { setRuns([]); setStatus('err'); }
      }
    };
    void load();
    // Soft 30s poll so handovers from upstream devices (LAN or
    // central) appear without the operator reloading the app.
    const timer = setInterval(() => { void load(); }, 30_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [workflowId]);

  const myStepIds = useMemo(
    () => new Set(mySteps.map((s) => s.stepId)),
    [mySteps]);
  const waiting = useMemo(() => runs.filter((r) => {
    if (r.state === 'COMPLETED' || r.state === 'REJECTED') return false;
    if (wholeWorkflow) return true;
    return r.currentStepId !== null
      && myStepIds.has(r.currentStepId);
  }), [runs, myStepIds, wholeWorkflow]);

  if (status === 'loading') return null;
  return (
    <div className="cap-dwf__queue"
         data-test={'cap-dwf-queue-' + workflowId}>
      <h3 className="cap-dwf__queue-title">
        Handover queue
        <span className="cap-dwf__queue-count">
          {waiting.length === 0 ? 'nothing waiting'
            : waiting.length + ' waiting for this device'}
        </span>
      </h3>
      {waiting.length === 0 ? (
        <p className="cap-dwf__queue-empty">
          No runs are parked at your step right now. New handovers
          show up here as upstream devices finish their captures.
        </p>
      ) : (
        <ul className="cap-dwf__queue-list">
          {waiting.map((r) => {
            const step = allSteps.find(
              (s) => s.stepId === r.currentStepId);
            const stepLabel = step
              ? `#${step.ordinal + 1} ${step.displayName}`
              : (r.currentStepId
                  ? r.currentStepId.slice(0, 8) + '…'
                  : '—');
            return (
              <li key={r.runId}
                  data-test={'cap-dwf-queue-item-' + r.runId}>
                <strong className="cap-dwf__queue-key">
                  {r.businessKey}
                </strong>
                <span className="cap-dwf__queue-meta">
                  at {stepLabel}
                  {' · updated '}{relativeTime(r.updatedAt)}
                  {' · '}<em>{r.state}</em>
                </span>
                <span className="cap-dwf__queue-spacer" />
                <button type="button"
                        className="cap-btn cap-btn--secondary"
                        style={{ padding: '2px 8px', fontSize: 13 }}
                        title={'Copy the business key to the '
                          + 'clipboard — useful when handing off '
                          + 'to a colleague or admin.'}
                        data-test={'cap-dwf-queue-copy-' + r.runId}
                        disabled={typeof navigator === 'undefined'
                          || !navigator.clipboard}
                        onClick={() => {
                          navigator.clipboard
                            ?.writeText(r.businessKey)
                            .catch(() => undefined);
                        }}>
                  Copy key
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60)   return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)   return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)   return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

/** Helper for {@link CaptureAppInner}: pick the programUid the
 *  shell should auto-select so the normal tracker/event capture
 *  renders the workflow's form. Only PROGRAM-bound workflows
 *  are resolvable here; PROGRAM_STAGE / PROGRAM_STAGE_SECTION
 *  bindings require a server-side stage→program lookup (future
 *  slice). Returns {@code null} when the binding isn't a program. */
export function programFromWorkflow(
  w: WorkflowAssignment,
): string | null {
  if (w.boundMetadataKind === 'PROGRAM' && w.boundMetadataId) {
    return w.boundMetadataId;
  }
  return null;
}
