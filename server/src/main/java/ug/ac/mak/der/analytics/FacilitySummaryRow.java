package ug.ac.mak.der.analytics;

import java.time.Instant;
import java.util.Objects;

/** Row from the {@code analytics_facility_summary} materialised view. */
public record FacilitySummaryRow(
        String orgUnitId,
        String period,
        Kind kind,
        long n,
        Instant refreshedAt
) {

    public FacilitySummaryRow {
        Objects.requireNonNull(orgUnitId, "orgUnitId");
        Objects.requireNonNull(period, "period");
        Objects.requireNonNull(kind, "kind");
        if (n < 0) {
            throw new IllegalArgumentException("n must be >= 0");
        }
        Objects.requireNonNull(refreshedAt, "refreshedAt");
    }

    public enum Kind { AGGREGATE, EVENT }
}
