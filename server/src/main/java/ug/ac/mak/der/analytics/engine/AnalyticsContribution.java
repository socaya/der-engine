package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row of {@code der.analytics_contribution} — a single source
 * record's typed contribution to a specific analytics cell. Spec
 * §7.3 contribution ledger and §7.4 incremental algorithm.
 *
 * <p>Immutable record so the materializer can safely stream rows
 * without defensive copies.</p>
 */
public record AnalyticsContribution(
        UUID metricId,
        int definitionVersion,
        String sourceKey,
        String sourceVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        BigDecimal contributionValue,
        boolean eligibility,
        String sourceState,
        Instant createdAt,
        Instant updatedAt,
        BigDecimal numeratorContribution,
        BigDecimal denominatorContribution) {

    /** 12-arg legacy form for Phase 1-6 call sites. */
    public AnalyticsContribution(
            final UUID metricId, final int definitionVersion,
            final String sourceKey, final String sourceVersion,
            final String periodKey, final String orgUnitUid,
            final String dimensionKey,
            final BigDecimal contributionValue,
            final boolean eligibility, final String sourceState,
            final Instant createdAt, final Instant updatedAt) {
        this(metricId, definitionVersion, sourceKey, sourceVersion,
                periodKey, orgUnitUid, dimensionKey, contributionValue,
                eligibility, sourceState, createdAt, updatedAt,
                null, null);
    }

    /** Convenience factory for the common COUNT=1 case. */
    public static AnalyticsContribution countOne(
            final UUID metricId, final int definitionVersion,
            final String sourceKey, final String sourceVersion,
            final String periodKey, final String orgUnitUid) {
        return new AnalyticsContribution(metricId, definitionVersion,
                sourceKey, sourceVersion, periodKey, orgUnitUid,
                "", BigDecimal.ONE, true, "COMMITTED", null, null);
    }

    /** Convenience factory for ratio indicators. */
    public static AnalyticsContribution ratio(
            final UUID metricId, final int definitionVersion,
            final String sourceKey, final String sourceVersion,
            final String periodKey, final String orgUnitUid,
            final String dimensionKey,
            final BigDecimal numerator, final BigDecimal denominator) {
        return new AnalyticsContribution(metricId, definitionVersion,
                sourceKey, sourceVersion, periodKey, orgUnitUid,
                dimensionKey == null ? "" : dimensionKey,
                numerator == null ? BigDecimal.ZERO : numerator,
                true, "COMMITTED", null, null,
                numerator, denominator);
    }
}
