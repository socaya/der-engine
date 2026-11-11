package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Run-length encoding codec for STRING columns (SRS FR-STO-007
 * Gate 2.4). Collapses sequences of identical non-null values into
 * (runLen, utf8) pairs. Wins when a string column is clustered —
 * org-unit UIDs within a hierarchy slice, repeated dimension keys
 * after a sort — where dictionary + bit-pack still spends per-row
 * bits that RLE avoids altogether.
 *
 * <p>Layout after the shared header (see {@link PlainCodecHeader}):</p>
 * <pre>
 *   [ runCount:int32 ]
 *   repeated × runCount:
 *     [ runLen:int32 ]
 *     [ utf8Len:int32 ]
 *     [ utf8Bytes ]
 * </pre>
 *
 * <p>Nulls are tracked through the shared null bitmap; only
 * non-null positions enter the RLE stream. Decode scatters run
 * values back into non-null positions in their original order.</p>
 */
public final class RleStringCodec implements Codec {

    @Override
    public String codecId() {
        return "rle-str";
    }

    @Override
    public ColumnType columnType() {
        return ColumnType.STRING;
    }

    @Override
    public byte[] encode(final ColumnBatch batch) {
        Objects.requireNonNull(batch, "batch");
        if (!(batch instanceof ColumnBatch.Str str)) {
            throw new IllegalArgumentException(
                    "rle-str expects Str batch");
        }
        final int n = str.rowCount();
        final List<String> runValues = new ArrayList<>();
        final List<Integer> runLens = new ArrayList<>();
        String current = null;
        int currentLen = 0;
        boolean inRun = false;
        for (int i = 0; i < n; i++) {
            if (str.nulls().isNull(i) || str.get(i) == null) {
                continue;
            }
            final String v = str.get(i);
            if (!inRun) {
                current = v;
                currentLen = 1;
                inRun = true;
            } else if (v.equals(current)) {
                currentLen++;
            } else {
                runValues.add(current);
                runLens.add(currentLen);
                current = v;
                currentLen = 1;
            }
        }
        if (inRun) {
            runValues.add(current);
            runLens.add(currentLen);
        }
        final int runCount = runValues.size();
        final byte[][] utf8 = new byte[runCount][];
        int payload = 4;
        for (int i = 0; i < runCount; i++) {
            utf8[i] = runValues.get(i).getBytes(StandardCharsets.UTF_8);
            payload += 4 + 4 + utf8[i].length;
        }
        final ByteBuffer buf = writeHeader(str, payload);
        buf.putInt(runCount);
        for (int i = 0; i < runCount; i++) {
            buf.putInt(runLens.get(i));
            buf.putInt(utf8[i].length);
            buf.put(utf8[i]);
        }
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final PlainCodecHeader h = PlainCodecHeader.read(blob);
        final int runCount = h.buf().getInt();
        final String[] values = new String[rowCount];
        if (runCount == 0) {
            final ColumnBatch.Str out = new ColumnBatch.Str(values,
                    h.nulls());
            out.seal();
            return out;
        }
        final int[] lens = new int[runCount];
        final String[] runVals = new String[runCount];
        for (int i = 0; i < runCount; i++) {
            lens[i] = h.buf().getInt();
            final int utf8Len = h.buf().getInt();
            final byte[] bytes = new byte[utf8Len];
            h.buf().get(bytes);
            runVals[i] = new String(bytes, StandardCharsets.UTF_8);
        }
        int run = 0;
        int remaining = lens[0];
        for (int i = 0; i < rowCount; i++) {
            if (h.nulls().isNull(i)) {
                values[i] = null;
                continue;
            }
            while (remaining == 0 && run < runCount - 1) {
                run++;
                remaining = lens[run];
            }
            if (remaining == 0) {
                // Defensive — would indicate a header that disagrees
                // with the null bitmap. Leave remaining slots null.
                break;
            }
            values[i] = runVals[run];
            remaining--;
        }
        final ColumnBatch.Str out = new ColumnBatch.Str(values, h.nulls());
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
