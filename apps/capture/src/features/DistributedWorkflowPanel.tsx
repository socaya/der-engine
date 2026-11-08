import { useMemo } from 'react';
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
  { workflows, myDeviceId }: {
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
               className="cap-dwf__banner"
               data-test={'cap-dwf-banner-' + workflow.workflowId}>
            <span className="cap-dwf__eyebrow">Distributed workflow</span>
            <strong className="cap-dwf__banner-title">
              {workflow.displayName}
            </strong>
            <span className="cap-dwf__banner-meta">
              {' · your step '}<em>{myStepsLabel}</em>
            </span>
          </div>
        );
      })}
    </div>
  );
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
