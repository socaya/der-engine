package ug.ac.mak.der.analytics.column.stats;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Roll-up of per-column statistics for one segment. Written as
 * a sidecar {@code .stats.json} next to the segment file so
 * readers can prune without opening the segment.
 */
public record SegmentStatistics(
        UUID segmentId,
        Instant computedAt,
        int rowCount,
        Map<String, ColumnStatistics> columns) {

    public SegmentStatistics {
        Objects.requireNonNull(segmentId, "segmentId");
        Objects.requireNonNull(computedAt, "computedAt");
        columns = columns == null
                ? Map.of()
                : Map.copyOf(columns);
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
    }

    /** Return the stats for {@code columnName} or null if the
     *  segment never recorded that column. */
    public ColumnStatistics column(final String columnName) {
        return columns.get(columnName);
    }

    public List<String> columnNames() {
        return List.copyOf(columns.keySet());
    }
}
