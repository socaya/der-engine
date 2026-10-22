package ug.ac.mak.der.workflow;

import java.util.Objects;
import java.util.UUID;

/** Cross-step dependency. Slice A only ships {@code COMPLETES_BEFORE}. */
public record CaptureWorkflowDependency(
        UUID stepId,
        UUID dependsOnStepId,
        Kind kind
) {

    public CaptureWorkflowDependency {
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(dependsOnStepId, "dependsOnStepId");
        if (stepId.equals(dependsOnStepId)) {
            throw new IllegalArgumentException("step cannot depend on itself");
        }
        Objects.requireNonNull(kind, "kind");
    }

    public enum Kind { COMPLETES_BEFORE }
}
