package ug.ac.mak.der.analytics.reconciliation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * One row of {@code der.analytics_reconciliation} — the most recent
 * local-vs-central comparison for a specific cell.
 */
public record AnalyticsReconciliation(
        UUID reconciliationId,
        UUID metricId,
        int definitionVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        BigDecimal localValue,
        BigDecimal centralValue,
        ReconciliationClassifier.Classification classification,
        String explanation,
        Instant centralRefreshAt,
        Long localSourceCursor,
        Instant createdAt,
        Instant updatedAt) {

    public AnalyticsReconciliation {
        Objects.requireNonNull(reconciliationId, "reconciliationId");
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(periodKey, "periodKey");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(classification, "classification");
        dimensionKey = dimensionKey == null ? "" : dimensionKey;
    }
}
