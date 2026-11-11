package ug.ac.mak.der.analytics.column;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Objects;

/**
 * A fixed-size vector of values for a single column (SRS §6
 * FR-QRY-005). Sealed over the five primitive types so vectorised
 * operators can pattern-match on the subtype and get primitive-
 * array access without boxing.
 *
 * <p>Row count is set at construction; subsequent setters mutate
 * in place until {@link #seal()} is called. A sealed batch is
 * immutable from Java's perspective (the runtime still permits
 * writes to the backing arrays, but the engine's contract is that
 * no further setter runs after seal).</p>
 */
public sealed interface ColumnBatch
        permits ColumnBatch.Int64, ColumnBatch.Decimal,
                ColumnBatch.Str, ColumnBatch.Bool, ColumnBatch.Date {

    ColumnType type();

    int rowCount();

    NullBitmap nulls();

    /** Seal the batch — subsequent set* calls throw. */
    void seal();

    /** Throw if {@link #seal} has been called. */
    void checkMutable();

    /* ───── INT64 ───── */

    final class Int64 implements ColumnBatch {
        private final long[] values;
        private final NullBitmap nulls;
        private boolean sealed;

        public Int64(final int rowCount) {
            this.values = new long[rowCount];
            this.nulls = new NullBitmap(rowCount);
        }

        public Int64(final long[] values, final NullBitmap nulls) {
            this.values = Objects.requireNonNull(values, "values");
            this.nulls = Objects.requireNonNull(nulls, "nulls");
            if (values.length != nulls.rowCount()) {
                throw new IllegalArgumentException(
                        "values length != nulls rowCount");
            }
        }

        public long get(final int row) {
            return values[row];
        }

        public void set(final int row, final long value) {
            checkMutable();
            values[row] = value;
        }

        public void setNull(final int row) {
            checkMutable();
            values[row] = 0L;
            nulls.setNull(row);
        }

        /** Raw storage for codecs. Zero-copy. */
        public long[] values() {
            return values;
        }

        @Override
        public ColumnType type() {
            return ColumnType.INT64;
        }

        @Override
        public int rowCount() {
            return values.length;
        }

        @Override
        public NullBitmap nulls() {
            return nulls;
        }

        @Override
        public void seal() {
            sealed = true;
        }

        @Override
        public void checkMutable() {
            if (sealed) {
                throw new IllegalStateException("batch is sealed");
            }
        }
    }

    /* ───── DECIMAL ───── */

    final class Decimal implements ColumnBatch {
        private final BigDecimal[] values;
        private final NullBitmap nulls;
        private boolean sealed;

        public Decimal(final int rowCount) {
            this.values = new BigDecimal[rowCount];
            this.nulls = new NullBitmap(rowCount);
        }

        public Decimal(final BigDecimal[] values, final NullBitmap nulls) {
            this.values = Objects.requireNonNull(values, "values");
            this.nulls = Objects.requireNonNull(nulls, "nulls");
            if (values.length != nulls.rowCount()) {
                throw new IllegalArgumentException(
                        "values length != nulls rowCount");
            }
        }

        public BigDecimal get(final int row) {
            return values[row];
        }

        public void set(final int row, final BigDecimal value) {
            checkMutable();
            if (value == null) {
                values[row] = null;
                nulls.setNull(row);
            } else {
                values[row] = value;
            }
        }

        public BigDecimal[] values() {
            return values;
        }

        @Override
        public ColumnType type() {
            return ColumnType.DECIMAL;
        }

        @Override
        public int rowCount() {
            return values.length;
        }

        @Override
        public NullBitmap nulls() {
            return nulls;
        }

        @Override
        public void seal() {
            sealed = true;
        }

        @Override
        public void checkMutable() {
            if (sealed) {
                throw new IllegalStateException("batch is sealed");
            }
        }
    }

    /* ───── STRING ───── */

    final class Str implements ColumnBatch {
        private final String[] values;
        private final NullBitmap nulls;
        private boolean sealed;

        public Str(final int rowCount) {
            this.values = new String[rowCount];
            this.nulls = new NullBitmap(rowCount);
        }

        public Str(final String[] values, final NullBitmap nulls) {
            this.values = Objects.requireNonNull(values, "values");
            this.nulls = Objects.requireNonNull(nulls, "nulls");
            if (values.length != nulls.rowCount()) {
                throw new IllegalArgumentException(
                        "values length != nulls rowCount");
            }
        }

        public String get(final int row) {
            return values[row];
        }

        public void set(final int row, final String value) {
            checkMutable();
            if (value == null) {
                values[row] = null;
                nulls.setNull(row);
            } else {
                values[row] = value;
            }
        }

        public String[] values() {
            return values;
        }

        @Override
        public ColumnType type() {
            return ColumnType.STRING;
        }

        @Override
        public int rowCount() {
            return values.length;
        }

        @Override
        public NullBitmap nulls() {
            return nulls;
        }

        @Override
        public void seal() {
            sealed = true;
        }

        @Override
        public void checkMutable() {
            if (sealed) {
                throw new IllegalStateException("batch is sealed");
            }
        }
    }

    /* ───── BOOL ───── */

    final class Bool implements ColumnBatch {
        private final long[] bits;
        private final int rowCount;
        private final NullBitmap nulls;
        private boolean sealed;

        public Bool(final int rowCount) {
            this.rowCount = rowCount;
            this.bits = new long[(rowCount + 63) >>> 6];
            this.nulls = new NullBitmap(rowCount);
        }

        public Bool(final long[] bits, final int rowCount,
                      final NullBitmap nulls) {
            this.rowCount = rowCount;
            if (bits == null
                    || bits.length < ((rowCount + 63) >>> 6)) {
                throw new IllegalArgumentException(
                        "bits too short for rowCount");
            }
            this.bits = Arrays.copyOf(bits, (rowCount + 63) >>> 6);
            this.nulls = Objects.requireNonNull(nulls, "nulls");
        }

        public boolean get(final int row) {
            return (bits[row >>> 6] & (1L << (row & 63))) != 0L;
        }

        public void set(final int row, final boolean value) {
            checkMutable();
            final int w = row >>> 6;
            final long m = 1L << (row & 63);
            if (value) {
                bits[w] |= m;
            } else {
                bits[w] &= ~m;
            }
        }

        public long[] bits() {
            return bits;
        }

        @Override
        public ColumnType type() {
            return ColumnType.BOOL;
        }

        @Override
        public int rowCount() {
            return rowCount;
        }

        @Override
        public NullBitmap nulls() {
            return nulls;
        }

        @Override
        public void seal() {
            sealed = true;
        }

        @Override
        public void checkMutable() {
            if (sealed) {
                throw new IllegalStateException("batch is sealed");
            }
        }
    }

    /* ───── DATE ───── */

    final class Date implements ColumnBatch {
        private final int[] epochDays;
        private final NullBitmap nulls;
        private boolean sealed;

        public Date(final int rowCount) {
            this.epochDays = new int[rowCount];
            this.nulls = new NullBitmap(rowCount);
        }

        public Date(final int[] epochDays, final NullBitmap nulls) {
            this.epochDays = Objects.requireNonNull(epochDays,
                    "epochDays");
            this.nulls = Objects.requireNonNull(nulls, "nulls");
            if (epochDays.length != nulls.rowCount()) {
                throw new IllegalArgumentException(
                        "epochDays length != nulls rowCount");
            }
        }

        public int getEpochDay(final int row) {
            return epochDays[row];
        }

        public java.time.LocalDate getLocalDate(final int row) {
            return java.time.LocalDate.ofEpochDay(epochDays[row]);
        }

        public void set(final int row, final java.time.LocalDate value) {
            checkMutable();
            if (value == null) {
                epochDays[row] = 0;
                nulls.setNull(row);
            } else {
                epochDays[row] = Math.toIntExact(value.toEpochDay());
            }
        }

        public int[] epochDays() {
            return epochDays;
        }

        @Override
        public ColumnType type() {
            return ColumnType.DATE;
        }

        @Override
        public int rowCount() {
            return epochDays.length;
        }

        @Override
        public NullBitmap nulls() {
            return nulls;
        }

        @Override
        public void seal() {
            sealed = true;
        }

        @Override
        public void checkMutable() {
            if (sealed) {
                throw new IllegalStateException("batch is sealed");
            }
        }
    }
}
