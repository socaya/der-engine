package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.util.Objects;

/**
 * Delta + zig-zag + bit-pack codec for INT64 columns (SRS
 * FR-STO-007 Gate 2.3). Stores the first non-null value verbatim
 * then encodes each subsequent non-null value as its signed delta
 * from the previous. Deltas are zig-zagged so negative drift still
 * packs with a small width. Shines on monotonic or near-monotonic
 * sequences — periods, cursors, version ids, timestamps — where
 * frame-of-reference (min-anchored) still spends bits on the
 * absolute offset.
 *
 * <p>Layout after the shared header (see {@link PlainCodecHeader}):</p>
 * <pre>
 *   [ nonNullCount:int32 ]
 *   [ firstValue:int64 ]          — omitted when nonNullCount == 0
 *   [ bitsPerDelta:int32 ]
 *   [ packedBytesLen:int32 ]
 *   [ packedBytes ]
 * </pre>
 *
 * <p>Nulls are not recorded in the RLE stream; the shared null
 * bitmap in the header is authoritative and decode re-scatters
 * values into their original positions.</p>
 */
public final class DeltaInt64Codec implements Codec {

    @Override
    public String codecId() {
        return "delta-i64";
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
                    "delta-i64 expects Int64 batch");
        }
        final int n = b.rowCount();
        int nonNull = 0;
        for (int i = 0; i < n; i++) {
            if (!b.nulls().isNull(i)) {
                nonNull++;
            }
        }
        if (nonNull == 0) {
            final int payload = 4 + 4 + 4;
            final ByteBuffer buf = writeHeader(b, payload);
            buf.putInt(0);
            buf.putInt(0);
            buf.putInt(0);
            return buf.array();
        }

        long first = 0L;
        long maxZz = 0L;
        final long[] zz = new long[nonNull - 1];
        int filled = 0;
        long prev = 0L;
        boolean seen = false;
        for (int i = 0; i < n; i++) {
            if (b.nulls().isNull(i)) {
                continue;
            }
            final long v = b.get(i);
            if (!seen) {
                first = v;
                seen = true;
                prev = v;
                continue;
            }
            final long delta = v - prev;
            final long z = zigZag(delta);
            zz[filled++] = z;
            if (z > maxZz) {
                maxZz = z;
            }
            prev = v;
        }
        final int bits;
        if (maxZz < 0L) {
            // Delta overflowed into 64 unsigned bits (worst case when
            // alternating Long.MIN_VALUE / Long.MAX_VALUE). Fall back
            // to full-width packing so round-trip stays correct.
            bits = 64;
        } else {
            bits = BitPacker.bitsRequired(maxZz);
        }
        final byte[] packed;
        if (bits == 64) {
            packed = new byte[zz.length * 8];
            final ByteBuffer vb = ByteBuffer.wrap(packed);
            for (final long z : zz) {
                vb.putLong(z);
            }
        } else {
            packed = BitPacker.pack(zz, bits);
        }
        final int payload = 4 + 8 + 4 + 4 + packed.length;
        final ByteBuffer buf = writeHeader(b, payload);
        buf.putInt(nonNull);
        buf.putLong(first);
        buf.putInt(bits);
        buf.putInt(packed.length);
        buf.put(packed);
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final PlainCodecHeader h = PlainCodecHeader.read(blob);
        final int nonNull = h.buf().getInt();
        final long[] values = new long[rowCount];
        if (nonNull == 0) {
            h.buf().getInt();
            h.buf().getInt();
            final ColumnBatch.Int64 empty = new ColumnBatch.Int64(values,
                    h.nulls());
            empty.seal();
            return empty;
        }
        final long first = h.buf().getLong();
        final int bits = h.buf().getInt();
        final int packedLen = h.buf().getInt();
        final byte[] packed = new byte[packedLen];
        h.buf().get(packed);
        final long[] zz = new long[Math.max(0, nonNull - 1)];
        if (bits == 64) {
            final ByteBuffer vb = ByteBuffer.wrap(packed);
            for (int i = 0; i < zz.length; i++) {
                zz[i] = vb.getLong();
            }
        } else {
            final long[] unpacked = BitPacker.unpack(packed, zz.length, bits);
            System.arraycopy(unpacked, 0, zz, 0, zz.length);
        }
        long prev = first;
        int zzIndex = 0;
        boolean seenFirst = false;
        for (int i = 0; i < rowCount; i++) {
            if (h.nulls().isNull(i)) {
                values[i] = 0L;
                continue;
            }
            if (!seenFirst) {
                values[i] = first;
                seenFirst = true;
                continue;
            }
            final long delta = unZigZag(zz[zzIndex++]);
            final long v = prev + delta;
            values[i] = v;
            prev = v;
        }
        final ColumnBatch.Int64 out = new ColumnBatch.Int64(values,
                h.nulls());
        out.seal();
        return out;
    }

    static long zigZag(final long v) {
        return (v << 1) ^ (v >> 63);
    }

    static long unZigZag(final long z) {
        return (z >>> 1) ^ -(z & 1L);
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
