package ug.ac.mak.der.analytics.column.stats;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * Per-column statistics captured at segment-write time (SRS
 * FR-QRY-008). Zone-map pruning (FR-STO-008) uses min/max to
 * decide whether a segment can match a filter before any decode
 * work. Distinct-estimate + null-count feed Gate 4.2 selectivity
 * cost estimates.
 *
 * <p>min / max are typed to the column's native shape:</p>
 * <ul>
 *   <li>INT64 / DATE → {@link Long}</li>
 *   <li>DECIMAL → {@link BigDecimal}</li>
 *   <li>STRING → {@link String} (lex-sorted)</li>
 *   <li>BOOL — not tracked; selectivity is at most 2 values</li>
 * </ul>
 *
 * <p>distinctSample is the first {@code N} unique non-null values
 * observed in the batch (capped at {@value #DISTINCT_SAMPLE_CAP}).
 * When size &lt; cap the sample is exhaustive and callers can
 * use it as an exact set for IN-list membership tests.</p>
 */
public record ColumnStatistics(
        String name,
        ColumnType type,
        int rowCount,
        int nullCount,
        int distinctEstimate,
        boolean distinctSampleExhaustive,
        List<Object> distinctSample,
        Object minValue,
        Object maxValue) {

    /** Cap on the distinct sample list. Beyond this the sample is
     *  truncated and distinctSampleExhaustive = false. */
    public static final int DISTINCT_SAMPLE_CAP = 64;

    public ColumnStatistics {
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(type, "type");
        if (rowCount < 0 || nullCount < 0 || distinctEstimate < 0) {
            throw new IllegalArgumentException(
                    "counts must be non-negative");
        }
        distinctSample = distinctSample == null
                ? List.of()
                : List.copyOf(distinctSample);
    }
}
