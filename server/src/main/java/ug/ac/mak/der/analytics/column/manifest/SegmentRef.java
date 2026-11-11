package ug.ac.mak.der.analytics.column.manifest;

import java.util.Objects;
import java.util.UUID;

/**
 * Pointer from a manifest to a persisted segment on disk. Carries
 * enough metadata that a reader can decide whether the segment is
 * relevant to a query without opening the file (SRS FR-STO-005
 * partition pruning).
 */
public record SegmentRef(
        UUID segmentId,
        String file,
        UUID metricId,
        int definitionVersion,
        String periodKey,
        String orgUnitUid,
        String dimensionKey,
        int rowCount) {

    public SegmentRef {
        Objects.requireNonNull(segmentId, "segmentId");
        Objects.requireNonNull(file, "file");
        Objects.requireNonNull(metricId, "metricId");
        Objects.requireNonNull(periodKey, "periodKey");
        Objects.requireNonNull(orgUnitUid, "orgUnitUid");
        dimensionKey = dimensionKey == null ? "" : dimensionKey;
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
    }
}
