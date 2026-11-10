package ug.ac.mak.der.analytics.publication;

import java.math.BigDecimal;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Tunables for the analytics publication subsystem — the auto-approve
 * threshold used by {@code AUTO_APPROVE_UNDER_THRESHOLD} mappings and
 * the drain worker's polling cadence. Spec §4.5 / §8.
 */
@ConfigurationProperties(prefix = "der.analytics.publication")
public record PublicationProperties(
        BigDecimal autoApproveThreshold,
        long drainIntervalMillis,
        int drainBatchSize,
        boolean drainEnabled) {

    public PublicationProperties {
        if (autoApproveThreshold == null) {
            autoApproveThreshold = BigDecimal.ZERO;
        }
        if (drainIntervalMillis <= 0L) {
            drainIntervalMillis = 30_000L;
        }
        if (drainBatchSize <= 0) {
            drainBatchSize = 200;
        }
    }
}
