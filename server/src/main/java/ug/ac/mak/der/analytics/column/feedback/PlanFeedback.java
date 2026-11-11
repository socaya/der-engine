package ug.ac.mak.der.analytics.column.feedback;

import java.time.Instant;
import java.util.Objects;

/**
 * One observation of estimate-vs-reality for a completed query
 * (SRS FR-QRY-015 adaptive optimizer feedback). Fed into
 * {@link PlanFeedbackStore} so later slices can tune selectivity
 * estimates based on observed cardinalities.
 *
 * <p>No PHI — {@link #shapeKey} is a hash of the query's filter
 * axes (metric ids, org-unit count, dimension names) without the
 * actual values, so the feedback surface is safe to expose to
 * operators.</p>
 */
public record PlanFeedback(
        Instant observedAt,
        String engine,
        String shapeKey,
        long estimatedRows,
        long actualRows,
        double estimatedCost,
        long elapsedMillis) {

    public PlanFeedback {
        Objects.requireNonNull(observedAt, "observedAt");
        Objects.requireNonNull(engine, "engine");
        Objects.requireNonNull(shapeKey, "shapeKey");
    }

    /** Observed selectivity = actual / estimated. Capped at 10×
     *  so a single wild outlier can't swamp future estimates. */
    public double observedRatio() {
        if (estimatedRows <= 0L) {
            return actualRows == 0L ? 1.0 : 10.0;
        }
        return Math.min(10.0,
                (double) actualRows / (double) estimatedRows);
    }
}
