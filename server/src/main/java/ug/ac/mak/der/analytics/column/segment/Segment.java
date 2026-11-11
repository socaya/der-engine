package ug.ac.mak.der.analytics.column.segment;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * In-memory representation of a persisted columnar segment (SRS
 * FR-STO-001..006). A segment carries a fixed set of columns for
 * {@code rowCount} rows; once written it is immutable and
 * uniquely identified by {@link #segmentId}.
 */
public record Segment(
        UUID segmentId,
        int rowCount,
        Instant createdAt,
        List<SegmentColumn> columns) {

    public Segment {
        Objects.requireNonNull(segmentId, "segmentId");
        Objects.requireNonNull(createdAt, "createdAt");
        columns = List.copyOf(Objects.requireNonNull(columns, "columns"));
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
    }
}
