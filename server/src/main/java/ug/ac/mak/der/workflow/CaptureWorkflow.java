package ug.ac.mak.der.workflow;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** ADR-0018 slice A: a capture workflow bound to a DHIS2 metadata root. */
public record CaptureWorkflow(
        UUID workflowId,
        String displayName,
        BindingKind boundMetadataKind,
        String boundMetadataId,
        boolean enabled,
        int version,
        Instant createdAt,
        Instant updatedAt,
        UUID createdBy,
        List<CaptureWorkflowStep> steps,
        List<CaptureWorkflowDependency> dependencies
) {

    public CaptureWorkflow {
        Objects.requireNonNull(workflowId, "workflowId");
        Objects.requireNonNull(displayName, "displayName");
        if (displayName.isBlank()) {
            throw new IllegalArgumentException("displayName must not be blank");
        }
        Objects.requireNonNull(boundMetadataKind, "boundMetadataKind");
        Objects.requireNonNull(boundMetadataId, "boundMetadataId");
        if (boundMetadataId.isBlank()) {
            throw new IllegalArgumentException("boundMetadataId must not be blank");
        }
        if (version < 1) {
            throw new IllegalArgumentException("version must be >= 1");
        }
        steps = steps == null ? List.of() : List.copyOf(steps);
        dependencies = dependencies == null ? List.of() : List.copyOf(dependencies);
    }

    /** Slice A shipped only DATA_SET; slice B (ADR-0024) adds PROGRAM + PROGRAM_STAGE. */
    public enum BindingKind { DATA_SET, PROGRAM, PROGRAM_STAGE }
}
