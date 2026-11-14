package ug.ac.mak.der.analytics.column.preagg;

import java.time.Instant;
import java.util.Objects;

/**
 * Single proposal emitted by {@link PreaggregationProposer} for the
 * Gate 8 self-optimisation loop (SRS FR-INC-013). PHI-safe — the shape
 * key is the same SHA-256 hash the planner feedback store uses, so
 * proposals can be surfaced to operators without redaction.
 *
 * <p>No decision authority: a proposal is an advisory candidate. The
 * materialisation state machine (slice 8.3) is what actually accepts,
 * rejects, or retires it.</p>
 */
public record PreaggregationProposal(
        String shapeKey,
        long observations,
        double avgElapsedMillis,
        double score,
        long estimatedBytes,
        Instant firstObservedAt,
        Instant lastObservedAt,
        String rationale) {

    public PreaggregationProposal {
        Objects.requireNonNull(shapeKey, "shapeKey");
        Objects.requireNonNull(firstObservedAt, "firstObservedAt");
        Objects.requireNonNull(lastObservedAt, "lastObservedAt");
        rationale = rationale == null ? "" : rationale;
        if (observations < 0L) {
            throw new IllegalArgumentException(
                    "observations must be non-negative");
        }
        if (estimatedBytes < 0L) {
            throw new IllegalArgumentException(
                    "estimatedBytes must be non-negative");
        }
    }
}
