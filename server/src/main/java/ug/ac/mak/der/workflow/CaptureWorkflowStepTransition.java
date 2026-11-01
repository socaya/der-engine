package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * §2.3.60 — append-only step-state transition record. One row per
 * change of per-step {@link WorkflowRunCoordinator.Readiness} value.
 *
 * <p>Enables wait-time and turnaround-time percentiles for admin
 * monitoring. The run-coordinator writes a row every time it
 * recomputes readiness for a run and finds a step whose state differs
 * from the most recent row for the same (run, step).
 *
 * <p>Reads: see {@link CaptureWorkflowStepTransitionRepository} for
 * windowed aggregation queries.
 */
public record CaptureWorkflowStepTransition(
        Long transitionId,
        UUID workflowId,
        UUID runId,
        UUID stepId,
        WorkflowRunCoordinator.Readiness fromState,
        WorkflowRunCoordinator.Readiness toState,
        Instant transitionedAt,
        UUID actorDeviceId,
        UUID actorUserId
) {
    public CaptureWorkflowStepTransition {
        Objects.requireNonNull(workflowId, "workflowId");
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(toState, "toState");
        Objects.requireNonNull(transitionedAt, "transitionedAt");
    }
}
