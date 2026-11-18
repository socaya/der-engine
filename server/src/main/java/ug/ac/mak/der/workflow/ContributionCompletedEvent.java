package ug.ac.mak.der.workflow;

import java.util.Objects;
import java.util.UUID;

/**
 * Spring {@code ApplicationEventPublisher} event fired by
 * {@link WorkflowRunCoordinator} immediately after a contribution
 * row persists + the readiness recomputation picks the next step.
 *
 * <p>Carries just enough context for a subscriber to decide whether
 * to fan the baton out over the P2P mesh via DPP/1 (ADR-0038):
 * {@code nextOwner} is the {@code capture_workflow_step
 * .owner_device_id} the next step is pinned to; subscribers compare
 * against their active mesh sessions and either push
 * {@code workflow.run-advance} directly or queue for later drain.</p>
 */
public record ContributionCompletedEvent(
        UUID runId,
        UUID workflowId,
        UUID completedStep,
        UUID nextStep,
        UUID nextOwner,
        String businessKey,
        UUID contributedBy,
        UUID submittedDeviceId) {

    public ContributionCompletedEvent {
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(workflowId, "workflowId");
        Objects.requireNonNull(completedStep, "completedStep");
    }
}
