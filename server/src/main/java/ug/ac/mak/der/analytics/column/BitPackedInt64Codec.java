package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.util.Objects;

/**
 * Frame-of-reference + bit-pack codec for INT64 columns (SRS
 * FR-STO-007). Subtracts the batch's minimum value from every
 * entry then bit-packs the resulting unsigned deltas. Effective
 * when values cluster in a narrow range — periods, counts and
 * version ids are all strong candidates.
 *
 * <p>Layout after the shared header:</p>
 * <pre>
 *   [ minValue:int64 ]
 *   [ bitsPerValue:int32 ]
 *   [ packedBytesLen:int32 ]
 *   [ packedBytes ]
 * </pre>
 *
 * <p>A null row holds a zero delta on the wire; the shared null
 * bitmap says whether the row is real or a placeholder.</p>
 */
public final class BitPackedInt64Codec implements Codec {

    @Override
    public String codecId() {
        return "bitpack-i64";
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
                    "bitpack-i64 expects Int64 batch");
        }
        final int n = b.rowCount();
        long min = Long.MAX_VALUE;
        long max = Long.MIN_VALUE;
        boolean anyReal = false;
        for (int i = 0; i < n; i++) {
            if (b.nulls().isNull(i)) {
                continue;
            }
            anyReal = true;
            final long v = b.get(i);
            if (v < min) {
                min = v;
            }
            if (v > max) {
                max = v;
            }
        }
        if (!anyReal) {
            min = 0;
            max = 0;
        }
        final long range = max - min;
        if (range < 0) {
            // Overflow — fall back to plain encoding path by signalling
            // bitsPerValue = 64 and storing raw longs. Rare.
            return encodeFullWidth(b, min);
        }
        final int bits = BitPacker.bitsRequired(range);
        final long[] deltas = new long[n];
        for (int i = 0; i < n; i++) {
            if (b.nulls().isNull(i)) {
                deltas[i] = 0L;
                continue;
            }
            deltas[i] = b.get(i) - min;
        }
        final byte[] packed = BitPacker.pack(deltas, bits);
        final int payload = 8 + 4 + 4 + packed.length;
        final ByteBuffer buf = writeHeader(b, payload);
        buf.putLong(min);
        buf.putInt(bits);
        buf.putInt(packed.length);
        buf.put(packed);
        return buf.array();
    }

    private byte[] encodeFullWidth(final ColumnBatch.Int64 b,
                                      final long min) {
        // Overflow path: 64-bit span. Serialize values verbatim so a
        // round-trip is still correct — selector will prefer the
        // plain codec in this case anyway.
        final byte[] packed = new byte[b.rowCount() * 8];
        final ByteBuffer vb = ByteBuffer.wrap(packed);
        for (int i = 0; i < b.rowCount(); i++) {
            vb.putLong(b.nulls().isNull(i) ? 0L : b.get(i));
        }
        final int payload = 8 + 4 + 4 + packed.length;
        final ByteBuffer buf = writeHeader(b, payload);
        buf.putLong(min);
        buf.putInt(-1); // sentinel for raw-longs path
        buf.putInt(packed.length);
        buf.put(packed);
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final PlainCodecHeader h = PlainCodecHeader.read(blob);
        final long min = h.buf().getLong();
        final int bits = h.buf().getInt();
        final int packedLen = h.buf().getInt();
        final byte[] packed = new byte[packedLen];
        h.buf().get(packed);
        final long[] values = new long[rowCount];
        if (bits == -1) {
            final ByteBuffer vb = ByteBuffer.wrap(packed);
            for (int i = 0; i < rowCount; i++) {
                values[i] = vb.getLong();
            }
        } else {
            final long[] deltas = BitPacker.unpack(packed, rowCount, bits);
            for (int i = 0; i < rowCount; i++) {
                values[i] = h.nulls().isNull(i) ? 0L : deltas[i] + min;
            }
        }
        final ColumnBatch.Int64 out = new ColumnBatch.Int64(values, h.nulls());
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
