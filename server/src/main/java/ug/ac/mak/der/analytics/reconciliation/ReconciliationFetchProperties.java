package ug.ac.mak.der.analytics.reconciliation;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the central-side half of reconciliation — the
 * scheduled worker that polls DHIS2 {@code /api/analytics} for
 * each PUBLISHED cell DER has pushed, then feeds the response to
 * {@link AnalyticsReconciliationService} for classification.
 */
@ConfigurationProperties(prefix = "der.analytics.reconciliation")
public record ReconciliationFetchProperties(
        long fetchIntervalMillis,
        int lookbackDays,
        int batchSize,
        boolean fetchEnabled) {

    public ReconciliationFetchProperties {
        if (fetchIntervalMillis <= 0L) {
            fetchIntervalMillis = 300_000L;
        }
        if (lookbackDays <= 0) {
            lookbackDays = 7;
        }
        if (batchSize <= 0) {
            batchSize = 100;
        }
    }
}
