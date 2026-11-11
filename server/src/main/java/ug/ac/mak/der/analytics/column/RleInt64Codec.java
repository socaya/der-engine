package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.util.Objects;

/**
 * Run-length encoding codec for INT64 columns (SRS FR-STO-007
 * Gate 2.4). Collapses repeated non-null values into
 * (runLen:int32, value:int64) pairs. Wins on enum-style columns —
 * status codes, flags, approval states — where frame-of-reference
 * still spends bits per row.
 *
 * <p>Layout after the shared header (see {@link PlainCodecHeader}):</p>
 * <pre>
 *   [ runCount:int32 ]
 *   repeated × runCount:
 *     [ runLen:int32 ]
 *     [ value:int64 ]
 * </pre>
 *
 * <p>Nulls ride the shared null bitmap; decode scatters run
 * values back into non-null positions in their original order.</p>
 */
public final class RleInt64Codec implements Codec {

    @Override
    public String codecId() {
        return "rle-i64";
    }

    @Override
    public ColumnType columnType() {
        return ColumnType.INT64;
    }

    @Override
    public byte[] encode(final ColumnBatch batch) {
        Objects.requireNonNull(batch, "batch");
        if (!(batch instanceof ColumnBatch.Int64 b)) {
            throw new IllegalArgumentException(
                    "rle-i64 expects Int64 batch");
        }
        final int n = b.rowCount();
        long[] runValues = new long[Math.max(n, 1)];
        int[] runLens = new int[Math.max(n, 1)];
        int runs = 0;
        long current = 0L;
        int currentLen = 0;
        boolean inRun = false;
        for (int i = 0; i < n; i++) {
            if (b.nulls().isNull(i)) {
                continue;
            }
            final long v = b.get(i);
            if (!inRun) {
                current = v;
                currentLen = 1;
                inRun = true;
            } else if (v == current) {
                currentLen++;
            } else {
                runValues[runs] = current;
                runLens[runs] = currentLen;
                runs++;
                current = v;
                currentLen = 1;
            }
        }
        if (inRun) {
            runValues[runs] = current;
            runLens[runs] = currentLen;
            runs++;
        }
        final int payload = 4 + runs * (4 + 8);
        final ByteBuffer buf = writeHeader(b, payload);
        buf.putInt(runs);
        for (int i = 0; i < runs; i++) {
            buf.putInt(runLens[i]);
            buf.putLong(runValues[i]);
        }
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final PlainCodecHeader h = PlainCodecHeader.read(blob);
        final int runCount = h.buf().getInt();
        final long[] values = new long[rowCount];
        if (runCount == 0) {
            final ColumnBatch.Int64 empty = new ColumnBatch.Int64(values,
                    h.nulls());
            empty.seal();
            return empty;
        }
        final int[] lens = new int[runCount];
        final long[] runVals = new long[runCount];
        for (int i = 0; i < runCount; i++) {
            lens[i] = h.buf().getInt();
            runVals[i] = h.buf().getLong();
        }
        int run = 0;
        int remaining = lens[0];
        for (int i = 0; i < rowCount; i++) {
            if (h.nulls().isNull(i)) {
                values[i] = 0L;
                continue;
            }
            while (remaining == 0 && run < runCount - 1) {
                run++;
                remaining = lens[run];
            }
            if (remaining == 0) {
                break;
            }
            values[i] = runVals[run];
            remaining--;
        }
        final ColumnBatch.Int64 out = new ColumnBatch.Int64(values,
                h.nulls());
        out.seal();
        return out;
    }

    private static ByteBuffer writeHeader(final ColumnBatch batch,
                                            final int payloadBytes) {
        final NullBitmap nulls = batch.nulls();
        final int words = nulls.words().length;
        final int size = 4 + 4 + words * 8 + 4 + payloadBytes;
        final ByteBuffer buf = ByteBuffer.allocate(size);
        buf.putInt(batch.rowCount());
        buf.putInt(words);
        for (final long w : nulls.words()) {
            buf.putLong(w);
        }
        buf.putInt(nulls.nullCount());
        return buf;
    }
}
