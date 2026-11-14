package ug.ac.mak.der.analytics.column.preagg;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Durable form of a Gate 8 preaggregation proposal (SRS FR-INC-013,
 * V119 schema). The advisory {@link PreaggregationProposal} is the
 * transient shape coming out of the proposer; this record is what
 * the repository persists and the admin UI transitions through its
 * state machine.
 */
public record PreaggregationProposalRecord(
        UUID proposalId,
        String shapeKey,
        long observations,
        double avgElapsedMillis,
        double score,
        long estimatedBytes,
        Instant firstObservedAt,
        Instant lastObservedAt,
        String rationale,
        State state,
        String decisionReason,
        UUID decidedBy,
        Instant decidedAt,
        Instant createdAt,
        Instant updatedAt) {

    public PreaggregationProposalRecord {
        Objects.requireNonNull(proposalId, "proposalId");
        Objects.requireNonNull(shapeKey, "shapeKey");
        Objects.requireNonNull(firstObservedAt, "firstObservedAt");
        Objects.requireNonNull(lastObservedAt, "lastObservedAt");
        Objects.requireNonNull(state, "state");
        rationale = rationale == null ? "" : rationale;
    }

    /**
     * Lifecycle. Materialisation of an APPROVED proposal is a later
     * gate; this slice only takes it through decision.
     */
    public enum State {
        PROPOSED,
        APPROVED,
        REJECTED,
        RETIRED
    }
}
