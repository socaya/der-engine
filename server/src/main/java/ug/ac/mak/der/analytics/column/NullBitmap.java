package ug.ac.mak.der.analytics.column;

import java.util.Arrays;

/**
 * Bit-packed null bitmap for a column batch. One bit per row; a
 * set bit means the row is null. Row count is stored outside the
 * bitmap so a mostly-non-null batch doesn't waste headers.
 *
 * <p>Allocation is zero-copy-friendly: the underlying {@code long[]}
 * is exposed to codecs so dictionary / Zstd paths can write bytes
 * directly without materialising a boolean[]. Tests still read
 * through {@link #isNull} for clarity.</p>
 */
public final class NullBitmap {

    private final long[] words;
    private final int rowCount;
    private int nullCount;

    public NullBitmap(final int rowCount) {
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
        this.rowCount = rowCount;
        this.words = new long[(rowCount + 63) >>> 6];
    }

    public NullBitmap(final long[] words, final int rowCount,
                        final int nullCount) {
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
        final int needed = (rowCount + 63) >>> 6;
        if (words == null || words.length < needed) {
            throw new IllegalArgumentException(
                    "words too short for rowCount");
        }
        this.words = Arrays.copyOf(words, needed);
        this.rowCount = rowCount;
        this.nullCount = nullCount;
    }

    public int rowCount() {
        return rowCount;
    }

    public int nullCount() {
        return nullCount;
    }

    public boolean isNull(final int row) {
        checkRow(row);
        return (words[row >>> 6] & (1L << (row & 63))) != 0L;
    }

    public void setNull(final int row) {
        checkRow(row);
        final int w = row >>> 6;
        final long m = 1L << (row & 63);
        if ((words[w] & m) == 0L) {
            words[w] |= m;
            nullCount++;
        }
    }

    /** Raw access for codecs. The returned array is the live
     *  storage — callers must not mutate it after a batch has been
     *  sealed. */
    public long[] words() {
        return words;
    }

    private void checkRow(final int row) {
        if (row < 0 || row >= rowCount) {
            throw new IndexOutOfBoundsException(
                    "row " + row + " outside [0, " + rowCount + ")");
        }
    }
}
