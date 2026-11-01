package ug.ac.mak.der.workflow;

import java.util.Objects;
import java.util.UUID;

/** Per-step field scoping over the bound DHIS2 metadata. ADR-0018.
 *
 *  <p>V066 adds optional per-field handover: {@code ownerRole} +
 *  {@code ownerDeviceId} let a workflow route an individual data
 *  element / TEA to a different device than its containing step
 *  (e.g. a central ID clerk completing one field after Registration
 *  captures the rest of the enrolment). Null on either column means
 *  "inherit from the parent step". */
public record CaptureWorkflowField(
        UUID stepId,
        String fieldRef,
        Requirement requirement,
        CaptureWorkflowStep.OwnerRole ownerRole,
        UUID ownerDeviceId
) {

    public CaptureWorkflowField {
        Objects.requireNonNull(stepId, "stepId");
        Objects.requireNonNull(fieldRef, "fieldRef");
        if (fieldRef.isBlank()) {
            throw new IllegalArgumentException("fieldRef must not be blank");
        }
        Objects.requireNonNull(requirement, "requirement");
    }

    /** Legacy constructor without per-field handover — ownerRole /
     *  ownerDeviceId default to null (inherit from the step). */
    public CaptureWorkflowField(final UUID stepId,
                                 final String fieldRef,
                                 final Requirement requirement) {
        this(stepId, fieldRef, requirement, null, null);
    }

    public enum Requirement { REQUIRED, OPTIONAL, READONLY, HIDDEN }
}
