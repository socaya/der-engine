package ug.ac.mak.der.approval;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Service;

/** Approve/reject local-only approval decisions on journal rows. ADR-0016. */
@Service
@ConditionalOnBean(ApprovalRepository.class)
public class ApprovalService {

    private final ApprovalRepository repo;

    public ApprovalService(final ApprovalRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    public List<ApprovalRepository.PendingApprovalRow> pending(final int limit) {
        return repo.findAwaiting(limit);
    }

    public Optional<ApprovalRecord> status(final UUID operationId) {
        return repo.findById(operationId);
    }

    /**
     * Returns the outcome: APPROVED on success, NOT_FOUND when the row
     * does not exist, ALREADY_DECIDED when it has been approved or
     * rejected previously, NOT_REQUIRED when the row does not require
     * approval in the first place.
     */
    public Outcome approve(final UUID operationId, final UUID actor) {
        return decide(operationId, actor, ApprovalRecord.Decision.APPROVE, null);
    }

    public Outcome reject(final UUID operationId, final UUID actor, final String reason) {
        return decide(operationId, actor, ApprovalRecord.Decision.REJECT, reason);
    }

    private Outcome decide(final UUID operationId, final UUID actor,
                             final ApprovalRecord.Decision decision, final String reason) {
        final Optional<ApprovalRecord> current = repo.findById(operationId);
        if (current.isEmpty()) {
            return Outcome.NOT_FOUND;
        }
        final ApprovalRecord r = current.get();
        if (!r.requiresApproval()) {
            return Outcome.NOT_REQUIRED;
        }
        if (r.isApproved() || r.isRejected()) {
            return Outcome.ALREADY_DECIDED;
        }
        final int rows = switch (decision) {
            case APPROVE -> repo.approve(operationId, actor);
            case REJECT -> repo.reject(operationId, actor, reason);
        };
        return rows > 0 ? (decision == ApprovalRecord.Decision.APPROVE
                ? Outcome.APPROVED : Outcome.REJECTED)
                : Outcome.ALREADY_DECIDED;
    }

    public enum Outcome {
        APPROVED, REJECTED, NOT_FOUND, NOT_REQUIRED, ALREADY_DECIDED
    }
}
