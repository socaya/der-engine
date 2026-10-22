package ug.ac.mak.der.approval;

import java.time.Instant;
import java.util.UUID;

/**
 * Approval view over a single {@code operation_journal} row. ADR-0016.
 *
 * <p>Only one of {@link #approvedBy()} / {@link #rejectedBy()} is
 * populated at a time (enforced by the DB check constraint).</p>
 */
public record ApprovalRecord(
        UUID operationId,
        boolean requiresApproval,
        UUID approvedBy,
        Instant approvedAt,
        UUID rejectedBy,
        Instant rejectedAt,
        String rejectionReason
) {

    public boolean isApproved() {
        return approvedAt != null;
    }

    public boolean isRejected() {
        return rejectedAt != null;
    }

    public boolean isAwaiting() {
        return requiresApproval && !isApproved() && !isRejected();
    }

    public enum Decision { APPROVE, REJECT }
}
