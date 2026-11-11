package ug.ac.mak.der.analytics.column.segment;

import java.util.Objects;

import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * One column entry inside a persisted segment — name + type +
 * codec id + the already-encoded bytes. Used by both the writer
 * (to compute the segment layout) and the reader (to carry a
 * decoded column back to the caller).
 */
public record SegmentColumn(
        String name,
        ColumnType type,
        String codecId,
        byte[] encoded,
        int nullCount) {

    public SegmentColumn {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(codecId, "codecId");
        Objects.requireNonNull(encoded, "encoded");
        if (nullCount < 0) {
            throw new IllegalArgumentException(
                    "nullCount must be non-negative");
        }
    }
}
