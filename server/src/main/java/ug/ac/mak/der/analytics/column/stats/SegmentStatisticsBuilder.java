package ug.ac.mak.der.analytics.column.stats;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.ColumnType;

/**
 * Compute per-column statistics from live {@link ColumnBatch}es.
 * Used by the sink immediately after batches are sealed, so the
 * sidecar stats file lands in the same transaction as the segment.
 */
public final class SegmentStatisticsBuilder {

    private SegmentStatisticsBuilder() {
    }

    public static SegmentStatistics compute(
            final UUID segmentId, final int rowCount,
            final Map<String, ColumnBatch> batches) {
        Objects.requireNonNull(segmentId, "segmentId");
        Objects.requireNonNull(batches, "batches");
        final Map<String, ColumnStatistics> cols = new LinkedHashMap<>();
        for (final Map.Entry<String, ColumnBatch> e : batches.entrySet()) {
            cols.put(e.getKey(),
                    computeColumn(e.getKey(), e.getValue()));
        }
        return new SegmentStatistics(segmentId, Instant.now(),
                rowCount, cols);
    }

    private static ColumnStatistics computeColumn(final String name,
                                                     final ColumnBatch b) {
        final int n = b.rowCount();
        final int nullCount = b.nulls().nullCount();
        final Set<Object> sample = new LinkedHashSet<>();
        boolean exhaustive = true;
        Object min = null;
        Object max = null;

        if (b instanceof ColumnBatch.Str s) {
            for (int i = 0; i < n; i++) {
                if (s.nulls().isNull(i)) {
                    continue;
                }
                final String v = s.get(i);
                if (sample.size() < ColumnStatistics.DISTINCT_SAMPLE_CAP) {
                    sample.add(v);
                } else if (!sample.contains(v)) {
                    exhaustive = false;
                }
                if (min == null || ((String) min).compareTo(v) > 0) {
                    min = v;
                }
                if (max == null || ((String) max).compareTo(v) < 0) {
                    max = v;
                }
            }
        } else if (b instanceof ColumnBatch.Int64 l) {
            Long lo = null;
            Long hi = null;
            for (int i = 0; i < n; i++) {
                if (l.nulls().isNull(i)) {
                    continue;
                }
                final long v = l.get(i);
                if (sample.size() < ColumnStatistics.DISTINCT_SAMPLE_CAP) {
                    sample.add(v);
                } else if (!sample.contains(v)) {
                    exhaustive = false;
                }
                if (lo == null || v < lo) {
                    lo = v;
                }
                if (hi == null || v > hi) {
                    hi = v;
                }
            }
            min = lo;
            max = hi;
        } else if (b instanceof ColumnBatch.Decimal d) {
            BigDecimal lo = null;
            BigDecimal hi = null;
            for (int i = 0; i < n; i++) {
                if (d.nulls().isNull(i) || d.get(i) == null) {
                    continue;
                }
                final BigDecimal v = d.get(i);
                if (sample.size() < ColumnStatistics.DISTINCT_SAMPLE_CAP) {
                    sample.add(v);
                } else if (!sample.contains(v)) {
                    exhaustive = false;
                }
                if (lo == null || v.compareTo(lo) < 0) {
                    lo = v;
                }
                if (hi == null || v.compareTo(hi) > 0) {
                    hi = v;
                }
            }
            min = lo;
            max = hi;
        } else if (b instanceof ColumnBatch.Date dd) {
            Long lo = null;
            Long hi = null;
            for (int i = 0; i < n; i++) {
                if (dd.nulls().isNull(i)) {
                    continue;
                }
                final long v = dd.getEpochDay(i);
                if (sample.size() < ColumnStatistics.DISTINCT_SAMPLE_CAP) {
                    sample.add(v);
                } else if (!sample.contains(v)) {
                    exhaustive = false;
                }
                if (lo == null || v < lo) {
                    lo = v;
                }
                if (hi == null || v > hi) {
                    hi = v;
                }
            }
            min = lo;
            max = hi;
        } else if (b instanceof ColumnBatch.Bool bb) {
            for (int i = 0; i < n; i++) {
                if (bb.nulls().isNull(i)) {
                    continue;
                }
                sample.add(bb.get(i));
            }
        }
        final ColumnType type = b.type();
        final int distinctEstimate = sample.size();
        return new ColumnStatistics(name, type, n, nullCount,
                distinctEstimate, exhaustive,
                new ArrayList<>(sample), min, max);
    }
}
