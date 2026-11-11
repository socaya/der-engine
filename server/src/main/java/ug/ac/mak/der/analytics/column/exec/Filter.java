package ug.ac.mak.der.analytics.column.exec;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import ug.ac.mak.der.analytics.column.ColumnBatch;

/**
 * Boolean expression over column batches, evaluated vectorised
 * into a {@link SelectionBitmap} (SRS FR-QRY-005, FR-QRY-009
 * predicate pushdown). Sealed over a small, auditable set of
 * primitives — Gate 3.3 adds arithmetic composition, Gate 4
 * adds cost estimation.
 */
public sealed interface Filter
        permits Filter.Equals, Filter.In, Filter.Between,
                Filter.IsNotNull, Filter.And, Filter.Or, Filter.Not {

    SelectionBitmap evaluate(Map<String, ColumnBatch> batches,
                               int rowCount);

    /* ───── Equals ───── */

    record Equals(String column, Object value) implements Filter {
        public Equals {
            Objects.requireNonNull(column, "column");
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            final ColumnBatch batch = resolve(batches, column);
            final SelectionBitmap out = SelectionBitmap.none(rowCount);
            if (batch instanceof ColumnBatch.Str s) {
                final String target = (String) value;
                for (int i = 0; i < rowCount; i++) {
                    if (!s.nulls().isNull(i)
                            && Objects.equals(s.get(i), target)) {
                        out.select(i);
                    }
                }
            } else if (batch instanceof ColumnBatch.Int64 l) {
                final long target = ((Number) value).longValue();
                for (int i = 0; i < rowCount; i++) {
                    if (!l.nulls().isNull(i) && l.get(i) == target) {
                        out.select(i);
                    }
                }
            } else if (batch instanceof ColumnBatch.Decimal d) {
                final BigDecimal target = asDecimal(value);
                for (int i = 0; i < rowCount; i++) {
                    if (!d.nulls().isNull(i)
                            && d.get(i) != null
                            && d.get(i).compareTo(target) == 0) {
                        out.select(i);
                    }
                }
            } else if (batch instanceof ColumnBatch.Bool b) {
                final boolean target = (Boolean) value;
                for (int i = 0; i < rowCount; i++) {
                    if (!b.nulls().isNull(i) && b.get(i) == target) {
                        out.select(i);
                    }
                }
            } else {
                throw new IllegalStateException(
                        "Equals not implemented for " + batch.type());
            }
            return out;
        }
    }

    /* ───── In ───── */

    record In(String column, List<Object> values) implements Filter {
        public In {
            Objects.requireNonNull(column, "column");
            values = List.copyOf(values);
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            final ColumnBatch batch = resolve(batches, column);
            final SelectionBitmap out = SelectionBitmap.none(rowCount);
            if (batch instanceof ColumnBatch.Str s) {
                final Set<String> set = new HashSet<>();
                for (final Object v : values) {
                    set.add((String) v);
                }
                for (int i = 0; i < rowCount; i++) {
                    if (!s.nulls().isNull(i) && set.contains(s.get(i))) {
                        out.select(i);
                    }
                }
                return out;
            }
            // Fallback: delegate per value through Equals.
            for (final Object v : values) {
                out.or(new Equals(column, v).evaluate(batches, rowCount));
            }
            return out;
        }
    }

    /* ───── Between ───── */

    record Between(String column, Object low, Object high) implements Filter {
        public Between {
            Objects.requireNonNull(column, "column");
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            final ColumnBatch batch = resolve(batches, column);
            final SelectionBitmap out = SelectionBitmap.none(rowCount);
            if (batch instanceof ColumnBatch.Int64 l) {
                final long lo = ((Number) low).longValue();
                final long hi = ((Number) high).longValue();
                for (int i = 0; i < rowCount; i++) {
                    if (!l.nulls().isNull(i)) {
                        final long v = l.get(i);
                        if (v >= lo && v <= hi) {
                            out.select(i);
                        }
                    }
                }
            } else if (batch instanceof ColumnBatch.Decimal d) {
                final BigDecimal lo = asDecimal(low);
                final BigDecimal hi = asDecimal(high);
                for (int i = 0; i < rowCount; i++) {
                    if (!d.nulls().isNull(i) && d.get(i) != null
                            && d.get(i).compareTo(lo) >= 0
                            && d.get(i).compareTo(hi) <= 0) {
                        out.select(i);
                    }
                }
            } else if (batch instanceof ColumnBatch.Date dd) {
                final int lo = ((Number) low).intValue();
                final int hi = ((Number) high).intValue();
                for (int i = 0; i < rowCount; i++) {
                    if (!dd.nulls().isNull(i)) {
                        final int v = dd.getEpochDay(i);
                        if (v >= lo && v <= hi) {
                            out.select(i);
                        }
                    }
                }
            } else {
                throw new IllegalStateException(
                        "Between not implemented for " + batch.type());
            }
            return out;
        }
    }

    /* ───── IsNotNull ───── */

    record IsNotNull(String column) implements Filter {
        public IsNotNull {
            Objects.requireNonNull(column, "column");
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            final ColumnBatch batch = resolve(batches, column);
            final SelectionBitmap out = SelectionBitmap.none(rowCount);
            for (int i = 0; i < rowCount; i++) {
                if (!batch.nulls().isNull(i)) {
                    out.select(i);
                }
            }
            return out;
        }
    }

    /* ───── Boolean composition ───── */

    record And(List<Filter> parts) implements Filter {
        public And {
            parts = List.copyOf(parts);
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            if (parts.isEmpty()) {
                return SelectionBitmap.allSelected(rowCount);
            }
            final SelectionBitmap out = new SelectionBitmap(
                    parts.get(0).evaluate(batches, rowCount));
            for (int i = 1; i < parts.size(); i++) {
                out.and(parts.get(i).evaluate(batches, rowCount));
            }
            return out;
        }
    }

    record Or(List<Filter> parts) implements Filter {
        public Or {
            parts = List.copyOf(parts);
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            if (parts.isEmpty()) {
                return SelectionBitmap.none(rowCount);
            }
            final SelectionBitmap out = new SelectionBitmap(
                    parts.get(0).evaluate(batches, rowCount));
            for (int i = 1; i < parts.size(); i++) {
                out.or(parts.get(i).evaluate(batches, rowCount));
            }
            return out;
        }
    }

    record Not(Filter inner) implements Filter {
        public Not {
            Objects.requireNonNull(inner, "inner");
        }

        @Override
        public SelectionBitmap evaluate(
                final Map<String, ColumnBatch> batches,
                final int rowCount) {
            final SelectionBitmap out = new SelectionBitmap(
                    inner.evaluate(batches, rowCount));
            out.not();
            return out;
        }
    }

    /* ───── helpers ───── */

    static ColumnBatch resolve(final Map<String, ColumnBatch> batches,
                                 final String column) {
        final ColumnBatch batch = batches.get(column);
        if (batch == null) {
            throw new IllegalArgumentException(
                    "filter references absent column '" + column
                  + "'; available: " + Arrays.toString(
                          batches.keySet().toArray()));
        }
        return batch;
    }

    static BigDecimal asDecimal(final Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof BigDecimal b) {
            return b;
        }
        if (v instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        return new BigDecimal(v.toString());
    }
}
