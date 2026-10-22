package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * One row in {@code capture_workflow_step_contribution}. ADR-0025.
 * The {@code payload} is the raw JSON the caller POSTed, stored
 * verbatim so the reconciler can replay it at drain time.
 */
public record CaptureWorkflowContribution(
        UUID contributionId,
        UUID runId,
        UUID stepId,
        String payload,
        UUID submittedBy,
        UUID submittedDeviceId,
        Instant submittedAt
) {

    public CaptureWorkflowContribution {
        Objects.requireNonNull(contributionId, "contributionId");
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(payload, "payload");
        Objects.requireNonNull(submittedAt, "submittedAt");
    }
}
