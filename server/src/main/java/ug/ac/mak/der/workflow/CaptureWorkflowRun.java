package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One in-flight workflow instance. ADR-0018. */
public record CaptureWorkflowRun(
        UUID runId,
        UUID workflowId,
        int workflowVersion,
        String businessKey,
        UUID currentStepId,
        State state,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy
) {

    public CaptureWorkflowRun {
        Objects.requireNonNull(runId, "runId");
        Objects.requireNonNull(workflowId, "workflowId");
        Objects.requireNonNull(businessKey, "businessKey");
        if (businessKey.isBlank()) {
            throw new IllegalArgumentException("businessKey must not be blank");
        }
        if (workflowVersion < 1) {
            throw new IllegalArgumentException("workflowVersion must be >= 1");
        }
        Objects.requireNonNull(state, "state");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public enum State { OPEN, AWAITING, COMPLETED, REJECTED }
}
