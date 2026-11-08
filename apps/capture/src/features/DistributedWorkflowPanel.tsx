import { useMemo, useState } from 'react';
import type { CaptureApi } from '../shared/types';

interface WorkflowSummary {
  readonly workflowId: string;
  readonly displayName: string;
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
 * Distributed-workflow mode entry. When at least one workflow on
 * this DER edge is assigned to the currently-enrolled device (via
 * {@code defaultDeviceId} or any {@code step.ownerDeviceId}), the
 * Capture shell hands over the screen to this panel instead of
 * showing the plain tracker/event capture — the operator sees
 * only what their device is meant to capture (user ask).
 *
 * <p>Slice G9-28a ships the recognition + selection surface. The
 * embedded run UI with the step's form + upstream context lands
 * in G9-28b (plugs the existing {@code getCaptureRunForm /
 * getCaptureRunData / advanceCaptureRun} endpoints into this
 * panel). Until then, clicking a workflow deep-links into
 * {@code /apps/workflow-capture}.</p>
 */
export function DistributedWorkflowPanel(
  { api: _api, workflows, myDeviceId }: {
    api: CaptureApi;
    workflows: ReadonlyArray<WorkflowSummary>;
    myDeviceId: string;
  },
): JSX.Element {
  // Group each workflow with the specific step(s) assigned to
  // this device so the operator sees exactly what they capture.
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
      <header className="cap-dwf__head">
        <span className="cap-dwf__eyebrow">Distributed workflow</span>
        <h2 className="cap-dwf__title">
          {assignments.length === 1
            ? 'Your assigned step'
            : `${assignments.length} workflows assigned to this device`}
        </h2>
        <p className="cap-dwf__sub">
          Capture below contributes to the running workflow; the
          DER server stamps each write with the step lineage so a
          complete record is assembled across all service points.
        </p>
      </header>

      <ul className="cap-dwf__list">
        {assignments.map(({ workflow, mySteps, wholeWorkflow }) => (
          <li key={workflow.workflowId} className="cap-dwf__row"
              data-test={'cap-dwf-row-' + workflow.workflowId}>
            <div className="cap-dwf__row-head">
              <strong className="cap-dwf__row-name">
                {workflow.displayName}
              </strong>
              <span className="cap-dwf__row-meta">
                {wholeWorkflow
                  ? 'all steps'
                  : mySteps.length + ' step'
                    + (mySteps.length === 1 ? '' : 's')
                    + ' of ' + workflow.steps.length}
              </span>
            </div>
            <ol className="cap-dwf__steps">
              {workflow.steps.map((s) => {
                const mine = s.ownerDeviceId === myDeviceId
                  || wholeWorkflow;
                return (
                  <li key={s.stepId}
                      className={'cap-dwf__step'
                        + (mine ? ' cap-dwf__step--mine' : '')}>
                    <span className="cap-dwf__step-ord">
                      {s.ordinal + 1}
                    </span>
                    <span className="cap-dwf__step-name">
                      {s.displayName}
                    </span>
                    {mine && (
                      <span className="cap-dwf__step-flag">
                        this device
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="cap-dwf__actions">
              <a href={'/apps/workflow-capture#/'
                    + encodeURIComponent(workflow.workflowId)}
                 target="_blank" rel="noopener"
                 className="cap-btn cap-btn--primary"
                 style={{ padding: '6px 14px', fontSize: 13,
                   textDecoration: 'none', display: 'inline-block' }}
                 data-test={'cap-dwf-open-' + workflow.workflowId}>
                Open workflow
              </a>
              <span className="cap-dwf__defer">
                Embedded run UI lands in the next slice (G9-28b);
                clicking opens Workflow Capture for now.
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
