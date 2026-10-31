package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One in-flight workflow instance. ADR-0018 + V055 submission tracking. */
public record CaptureWorkflowRun(
        UUID runId,
        UUID workflowId,
        int workflowVersion,
        String businessKey,
        UUID currentStepId,
        State state,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        /** V055 — operation_journal.operation_id of the compiled submission
         *  that was handed off to the DHIS2 outbound queue, or null while
         *  the run is still open. */
        UUID submissionJournalOpId,
        /** V055 — error message if compile or hand-off failed; the run
         *  stays AWAITING so an operator can retry. */
        String submissionError
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

    /** Legacy 9-arg constructor (pre-V055). Submission tracking fields
     *  default to null — tests + older call sites that don't exercise
     *  the submit path keep working. */
    public CaptureWorkflowRun(final UUID runId, final UUID workflowId,
                                final int workflowVersion, final String businessKey,
                                final UUID currentStepId, final State state,
                                final Instant createdAt, final Instant updatedAt,
                                final UUID createdBy) {
        this(runId, workflowId, workflowVersion, businessKey, currentStepId,
                state, createdAt, updatedAt, createdBy, null, null);
    }

    public enum State { OPEN, AWAITING, COMPLETED, REJECTED }
}
