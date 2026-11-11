package ug.ac.mak.der.analytics.column.stats;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS FR-QRY-008 / FR-QRY-009 — rank segments by their estimated
 * contribution cost. Uses the sidecar {@link SegmentStatistics}
 * when available, otherwise falls back to a conservative "scan
 * everything" assumption (selectivity = 1.0).
 *
 * <p>The cost model is deterministic — same inputs give same
 * output. Tuning constants live here so a future benchmark can
 * adjust them without touching callers.</p>
 */
public final class PlanCoster {

    /** Fixed per-segment open cost in abstract units — pays for
     *  manifest + sidecar + header reads. Dominates when a
     *  segment matches zero rows. */
    public static final double FIXED_OPEN_COST = 32.0;

    /** Approximate per-row bytes on the wire, averaged across the
     *  9 projected columns at typical compression ratios on the
     *  pilot workload. Revised in Gate 5 after real measurements. */
    public static final double BYTES_PER_ROW = 48.0;

    private PlanCoster() {
    }

    public record CostEstimate(
            int rowsIn,
            double selectivity,
            long estimatedRowsOut,
            long bytesScanned,
            double totalCost) {
    }

    public static CostEstimate estimate(
            final SegmentRef ref,
            final Optional<SegmentStatistics> statsOpt,
            final AnalyticsEngineRepository.CellQuery query) {
        Objects.requireNonNull(ref, "ref");
        Objects.requireNonNull(query, "query");
        final int rowsIn = ref.rowCount();
        final double selectivity = estimateSelectivity(statsOpt, query);
        final long rowsOut = Math.round(rowsIn * selectivity);
        final long bytes = Math.round(rowsIn * BYTES_PER_ROW);
        final double totalCost = FIXED_OPEN_COST
                + (bytes * Math.max(selectivity, 0.001));
        return new CostEstimate(rowsIn, selectivity, rowsOut,
                bytes, totalCost);
    }

    /** Estimate the fraction of {@code rowsIn} that the full
     *  query filter chain will admit. Multi-predicate filters
     *  multiply their selectivities under the standard
     *  independence assumption. */
    public static double estimateSelectivity(
            final Optional<SegmentStatistics> statsOpt,
            final AnalyticsEngineRepository.CellQuery query) {
        double selectivity = 1.0;
        if (query.orgUnitUids() != null && !query.orgUnitUids().isEmpty()) {
            selectivity *= orgUnitSelectivity(statsOpt,
                    query.orgUnitUids());
        }
        if (query.dimensionFilter() != null
                && !query.dimensionFilter().isEmpty()) {
            selectivity *= dimensionSelectivity(statsOpt);
        }
        if (selectivity < 0.0) {
            selectivity = 0.0;
        }
        if (selectivity > 1.0) {
            selectivity = 1.0;
        }
        return selectivity;
    }

    private static double orgUnitSelectivity(
            final Optional<SegmentStatistics> statsOpt,
            final List<String> wanted) {
        if (statsOpt.isEmpty()) {
            // No stats → assume the filter admits every row;
            // pruning only kicks in when we have evidence.
            return 1.0;
        }
        final ColumnStatistics ou = statsOpt.get().column("orgUnit");
        if (ou == null || ou.rowCount() == 0) {
            return 1.0;
        }
        if (ou.distinctSampleExhaustive()
                && !ou.distinctSample().isEmpty()) {
            long hits = 0;
            for (final Object v : ou.distinctSample()) {
                if (wanted.contains(v)) {
                    hits++;
                }
            }
            if (hits == 0) {
                return 0.0;
            }
            // Assume each distinct value contributes an equal
            // share of the segment's rows. Hits / distinctCount
            // is the fraction admitted.
            return (double) hits / (double) ou.distinctEstimate();
        }
        // Non-exhaustive: fall back to range band membership. If
        // any requested value lies within [min, max], assume
        // 1 / distinctEstimate as a lower bound.
        final String min = (String) ou.minValue();
        final String max = (String) ou.maxValue();
        if (min == null || max == null) {
            return 1.0;
        }
        for (final String w : wanted) {
            if (w.compareTo(min) >= 0 && w.compareTo(max) <= 0) {
                final double perValue = ou.distinctEstimate() == 0
                        ? 1.0 : 1.0 / ou.distinctEstimate();
                return Math.min(1.0,
                        perValue * Math.max(1, wanted.size()));
            }
        }
        return 0.0;
    }

    private static double dimensionSelectivity(
            final Optional<SegmentStatistics> statsOpt) {
        if (statsOpt.isEmpty()) {
            return 1.0;
        }
        final ColumnStatistics dim = statsOpt.get().column("dimensionKey");
        if (dim == null || dim.distinctEstimate() == 0) {
            return 1.0;
        }
        // Conservative: one of the distinct keys passes. Refined
        // in Gate 4.3 when the planner decomposes multi-axis
        // predicates.
        return 1.0 / dim.distinctEstimate();
    }
}
