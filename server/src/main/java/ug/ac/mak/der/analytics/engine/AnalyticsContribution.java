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
        Instant updatedAt) {

    /** Convenience factory for the common COUNT=1 case. */
    public static AnalyticsContribution countOne(
            final UUID metricId, final int definitionVersion,
            final String sourceKey, final String sourceVersion,
            final String periodKey, final String orgUnitUid) {
        return new AnalyticsContribution(metricId, definitionVersion,
                sourceKey, sourceVersion, periodKey, orgUnitUid,
                "", BigDecimal.ONE, true, "COMMITTED", null, null);
    }
}
