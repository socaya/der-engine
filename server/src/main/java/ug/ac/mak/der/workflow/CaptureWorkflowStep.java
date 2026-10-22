package ug.ac.mak.der.workflow;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * One step within a {@link CaptureWorkflow}. ADR-0018; the optional
 * {@code ownerDeviceId} was added by ADR-0022 (slice B) to bind a step
 * to a specific {@link ug.ac.mak.der.device.EdgeDevice}. Null means the
 * step is role-only.
 */
public record CaptureWorkflowStep(
        UUID stepId,
        UUID workflowId,
        int ordinal,
        String displayName,
        OwnerRole ownerRole,
        UUID ownerDeviceId,
        StepKind stepKind,
        List<CaptureWorkflowField> fields
) {

    public CaptureWorkflowStep {
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(workflowId, "workflowId");
        if (ordinal < 0) {
            throw new IllegalArgumentException("ordinal must be >= 0");
        }
        Objects.requireNonNull(displayName, "displayName");
        if (displayName.isBlank()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
        Objects.requireNonNull(ownerRole, "ownerRole");
        Objects.requireNonNull(stepKind, "stepKind");
        fields = fields == null ? List.of() : List.copyOf(fields);
    }

    public enum OwnerRole { ADMIN, OPERATOR, REVIEWER }

    public enum StepKind {
        /** Captures a slice of the dataset's fields. */
        CAPTURE,
        /** Read-only review pass; no field writes. */
        REVIEW,
        /** Explicit approve/reject gate. Reuses ADR-0016 mechanics in slice B. */
        APPROVE,
        /** Hands the run off to another device or role. */
        DISPATCH
    }
}
