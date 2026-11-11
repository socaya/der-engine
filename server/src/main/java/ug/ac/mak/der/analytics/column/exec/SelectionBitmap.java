package ug.ac.mak.der.analytics.column.exec;

import java.util.Arrays;

/**
 * Per-batch selection mask tracking which rows pass the filter
 * pipeline (SRS §6 FR-QRY-005). One bit per row — set means
 * selected. Operators and/or against these masks and the
 * aggregate stage reads them once at commit time.
 *
 * <p>Dense bit-packed storage mirrors {@link
 * ug.ac.mak.der.analytics.column.NullBitmap} so the two can be
 * combined without a boolean[] copy.</p>
 */
public final class SelectionBitmap {

    private final long[] words;
    private final int rowCount;

    public SelectionBitmap(final int rowCount) {
        if (rowCount < 0) {
            throw new IllegalArgumentException(
                    "rowCount must be non-negative");
        }
        this.rowCount = rowCount;
        this.words = new long[(rowCount + 63) >>> 6];
    }

    public SelectionBitmap(final SelectionBitmap source) {
        this.rowCount = source.rowCount;
        this.words = Arrays.copyOf(source.words, source.words.length);
    }

    public static SelectionBitmap allSelected(final int rowCount) {
        final SelectionBitmap b = new SelectionBitmap(rowCount);
        Arrays.fill(b.words, -1L);
        // Clear tail bits beyond rowCount so popcount is exact.
        final int extra = (b.words.length * 64) - rowCount;
        if (extra > 0 && b.words.length > 0) {
            final long mask = -1L >>> extra;
            b.words[b.words.length - 1] &= mask;
        }
        return b;
    }

    public static SelectionBitmap none(final int rowCount) {
        return new SelectionBitmap(rowCount);
    }

    public int rowCount() {
        return rowCount;
    }

    public boolean isSelected(final int row) {
        checkRow(row);
        return (words[row >>> 6] & (1L << (row & 63))) != 0L;
    }

    public void select(final int row) {
        checkRow(row);
        words[row >>> 6] |= (1L << (row & 63));
    }

    public void deselect(final int row) {
        checkRow(row);
        words[row >>> 6] &= ~(1L << (row & 63));
    }

    public void and(final SelectionBitmap other) {
        checkSameShape(other);
        for (int i = 0; i < words.length; i++) {
            words[i] &= other.words[i];
        }
    }

    public void or(final SelectionBitmap other) {
        checkSameShape(other);
        for (int i = 0; i < words.length; i++) {
            words[i] |= other.words[i];
        }
    }

    /** In-place invert, honouring rowCount for the tail word. */
    public void not() {
        for (int i = 0; i < words.length; i++) {
            words[i] = ~words[i];
        }
        clearTail();
    }

    public int selectedCount() {
        int count = 0;
        for (final long w : words) {
            count += Long.bitCount(w);
        }
        return count;
    }

    /** Iterate selected row indices in ascending order. */
    public int[] selectedRows() {
        final int[] out = new int[selectedCount()];
        int k = 0;
        for (int w = 0; w < words.length; w++) {
            long bits = words[w];
            while (bits != 0L) {
                final int bit = Long.numberOfTrailingZeros(bits);
                out[k++] = (w << 6) + bit;
                bits &= bits - 1L;
            }
        }
        return out;
    }

    private void clearTail() {
        final int extra = (words.length * 64) - rowCount;
        if (extra > 0 && words.length > 0) {
            final long mask = -1L >>> extra;
            words[words.length - 1] &= mask;
        }
    }

    private void checkRow(final int row) {
        if (row < 0 || row >= rowCount) {
            throw new IndexOutOfBoundsException(
                    "row " + row + " outside [0, " + rowCount + ")");
        }
    }

    private void checkSameShape(final SelectionBitmap other) {
        if (other.rowCount != rowCount) {
            throw new IllegalArgumentException(
                    "bitmap shape mismatch: " + rowCount
                  + " vs " + other.rowCount);
        }
    }
}
