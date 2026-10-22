package ug.ac.mak.der.workflow;

import java.util.Objects;
import java.util.UUID;

/** Per-step field scoping over the bound DHIS2 metadata. ADR-0018. */
public record CaptureWorkflowField(
        UUID stepId,
        String fieldRef,
        Requirement requirement
) {

    public CaptureWorkflowField {
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(fieldRef, "fieldRef");
        if (fieldRef.isBlank()) {
            throw new IllegalArgumentException("fieldRef must not be blank");
        }
        Objects.requireNonNull(requirement, "requirement");
    }

    public enum Requirement { REQUIRED, OPTIONAL, READONLY, HIDDEN }
}
