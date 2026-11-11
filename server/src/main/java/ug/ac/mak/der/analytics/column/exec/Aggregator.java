package ug.ac.mak.der.analytics.column.exec;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.Objects;

import ug.ac.mak.der.analytics.column.ColumnBatch;

/**
 * Column-batch aggregator (SRS FR-QRY-005 + FR-INC-003). Takes a
 * {@link ColumnBatch} and a {@link SelectionBitmap} and produces
 * a single aggregated value. Null rows and deselected rows both
 * contribute nothing; a cell that aggregates zero rows is signalled
 * by the implementation (COUNT returns 0; SUM / MIN / MAX / AVG
 * return null so a caller can distinguish "no data" from "data
 * summed to zero").
 */
public sealed interface Aggregator
        permits Aggregator.Count, Aggregator.Sum,
                Aggregator.Min, Aggregator.Max, Aggregator.Average {

    /** @return result of the aggregation; see per-impl docs. */
    Object apply(ColumnBatch batch, SelectionBitmap selection);

    /* ───── COUNT ───── */

    /** Returns the number of selected non-null rows as a
     *  {@code long}. */
    record Count() implements Aggregator {
        @Override
        public Object apply(final ColumnBatch batch,
                              final SelectionBitmap selection) {
            Objects.requireNonNull(batch, "batch");
            Objects.requireNonNull(selection, "selection");
            long count = 0;
            for (int i = 0; i < batch.rowCount(); i++) {
                if (selection.isSelected(i)
                        && !batch.nulls().isNull(i)) {
                    count++;
                }
            }
            return count;
        }
    }

    /* ───── SUM ───── */

    /** Sum of selected non-null values. Returns {@code BigDecimal}
     *  for DECIMAL and INT64 columns; returns {@code null} when no
     *  rows contribute. */
    record Sum() implements Aggregator {
        @Override
        public Object apply(final ColumnBatch batch,
                              final SelectionBitmap selection) {
            Objects.requireNonNull(batch, "batch");
            Objects.requireNonNull(selection, "selection");
            if (batch instanceof ColumnBatch.Int64 l) {
                boolean any = false;
                long sum = 0L;
                for (int i = 0; i < l.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !l.nulls().isNull(i)) {
                        sum += l.get(i);
                        any = true;
                    }
                }
                return any ? BigDecimal.valueOf(sum) : null;
            }
            if (batch instanceof ColumnBatch.Decimal d) {
                BigDecimal sum = null;
                for (int i = 0; i < d.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !d.nulls().isNull(i)
                            && d.get(i) != null) {
                        sum = sum == null ? d.get(i) : sum.add(d.get(i));
                    }
                }
                return sum;
            }
            throw new IllegalArgumentException(
                    "SUM not applicable to " + batch.type());
        }
    }

    /* ───── MIN ───── */

    record Min() implements Aggregator {
        @Override
        public Object apply(final ColumnBatch batch,
                              final SelectionBitmap selection) {
            Objects.requireNonNull(batch, "batch");
            Objects.requireNonNull(selection, "selection");
            if (batch instanceof ColumnBatch.Int64 l) {
                boolean any = false;
                long min = Long.MAX_VALUE;
                for (int i = 0; i < l.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !l.nulls().isNull(i)) {
                        if (l.get(i) < min) {
                            min = l.get(i);
                        }
                        any = true;
                    }
                }
                return any ? BigDecimal.valueOf(min) : null;
            }
            if (batch instanceof ColumnBatch.Decimal d) {
                BigDecimal min = null;
                for (int i = 0; i < d.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !d.nulls().isNull(i)
                            && d.get(i) != null) {
                        if (min == null
                                || d.get(i).compareTo(min) < 0) {
                            min = d.get(i);
                        }
                    }
                }
                return min;
            }
            throw new IllegalArgumentException(
                    "MIN not applicable to " + batch.type());
        }
    }

    /* ───── MAX ───── */

    record Max() implements Aggregator {
        @Override
        public Object apply(final ColumnBatch batch,
                              final SelectionBitmap selection) {
            Objects.requireNonNull(batch, "batch");
            Objects.requireNonNull(selection, "selection");
            if (batch instanceof ColumnBatch.Int64 l) {
                boolean any = false;
                long max = Long.MIN_VALUE;
                for (int i = 0; i < l.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !l.nulls().isNull(i)) {
                        if (l.get(i) > max) {
                            max = l.get(i);
                        }
                        any = true;
                    }
                }
                return any ? BigDecimal.valueOf(max) : null;
            }
            if (batch instanceof ColumnBatch.Decimal d) {
                BigDecimal max = null;
                for (int i = 0; i < d.rowCount(); i++) {
                    if (selection.isSelected(i)
                            && !d.nulls().isNull(i)
                            && d.get(i) != null) {
                        if (max == null
                                || d.get(i).compareTo(max) > 0) {
                            max = d.get(i);
                        }
                    }
                }
                return max;
            }
            throw new IllegalArgumentException(
                    "MAX not applicable to " + batch.type());
        }
    }

    /* ───── AVERAGE ───── */

    /** Returns {@code sum / count} as {@link BigDecimal} using
     *  {@link MathContext#DECIMAL64}. Multiset-aware per
     *  SRS FR-INC-003 — reads the current batch + selection on
     *  every call rather than maintaining a cached divisor that
     *  could stale under retraction. */
    record Average() implements Aggregator {
        @Override
        public Object apply(final ColumnBatch batch,
                              final SelectionBitmap selection) {
            final Object sum = new Sum().apply(batch, selection);
            if (sum == null) {
                return null;
            }
            final long n = (long) new Count().apply(batch, selection);
            if (n == 0L) {
                return null;
            }
            return ((BigDecimal) sum).divide(BigDecimal.valueOf(n),
                    MathContext.DECIMAL64);
        }
    }
}
