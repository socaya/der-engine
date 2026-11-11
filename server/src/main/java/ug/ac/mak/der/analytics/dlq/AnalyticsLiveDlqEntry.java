package ug.ac.mak.der.analytics.dlq;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import ug.ac.mak.der.analytics.engine.AnalyticsSourceEvent;

/**
 * One row of {@code der.analytics_live_dlq} — a source event the
 * live ingester couldn't apply on the hot path. The retry worker
 * reads due entries, re-dispatches the embedded
 * {@link AnalyticsSourceEvent}, and either removes the row on
 * success or applies exponential backoff.
 */
public record AnalyticsLiveDlqEntry(
        UUID dlqId,
        AnalyticsSourceEvent.SourceType sourceType,
        String sourceKey,
        long sourceVersion,
        LocalDate occurredOn,
        String orgUnitUid,
        String status,
        String errorSummary,
        int attemptCount,
        Instant nextRetryAt,
        boolean gaveUp,
        Instant createdAt,
        Instant lastAttemptedAt) {

    public AnalyticsLiveDlqEntry {
        Objects.requireNonNull(dlqId, "dlqId");
        Objects.requireNonNull(sourceType, "sourceType");
        Objects.requireNonNull(sourceKey, "sourceKey");
        Objects.requireNonNull(occurredOn, "occurredOn");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        Objects.requireNonNull(nextRetryAt, "nextRetryAt");
    }

    public AnalyticsSourceEvent asSourceEvent() {
        return new AnalyticsSourceEvent(sourceType, sourceKey,
                (int) Math.min(Integer.MAX_VALUE, sourceVersion),
                occurredOn, orgUnitUid, status);
    }
}
