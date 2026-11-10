package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Projection of one {@code der.analytics_cell} row. The analytics
 * query layer and the materializer both read/write this shape.
 */
public record AnalyticsCell(
        UUID metricId,
        int definitionVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        Long countValue,
        BigDecimal sumValue,
        BigDecimal value,
        BigDecimal numeratorValue,
        BigDecimal denominatorValue,
        Instant freshnessAt,
        String qualityState) {
}
