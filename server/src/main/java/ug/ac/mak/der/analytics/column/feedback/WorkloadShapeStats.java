package ug.ac.mak.der.analytics.column.feedback;

import java.time.Instant;
import java.util.Objects;

/**
 * Per-shape workload summary accumulated by {@link WorkloadStatsStore}
 * (SRS FR-INC-013 preaggregation proposer input, Gate 8). The shape key
 * is the same PHI-safe SHA-256 hash produced by
 * {@link PlanFeedbackStore#shapeKeyFor}, so these summaries stay safe to
 * surface to operators.
 *
 * <p>The {@link #score()} is the proposer's ranking signal: frequency
 * times average latency, so "both common and expensive" shapes dominate
 * — the ones materialisation would help most.</p>
 */
public record WorkloadShapeStats(
        String shapeKey,
        long observations,
        long sumElapsedMillis,
        double sumEstimatedCost,
        long sumActualRows,
        Instant firstObservedAt,
        Instant lastObservedAt) {

    public WorkloadShapeStats {
        Objects.requireNonNull(shapeKey, "shapeKey");
        Objects.requireNonNull(firstObservedAt, "firstObservedAt");
        Objects.requireNonNull(lastObservedAt, "lastObservedAt");
    }

    public double avgElapsedMillis() {
        return observations == 0L ? 0.0
                : (double) sumElapsedMillis / (double) observations;
    }

    public double avgEstimatedCost() {
        return observations == 0L ? 0.0
                : sumEstimatedCost / (double) observations;
    }

    public long avgActualRows() {
        return observations == 0L ? 0L
                : sumActualRows / observations;
    }

    public double score() {
        return (double) observations * avgElapsedMillis();
    }
}
