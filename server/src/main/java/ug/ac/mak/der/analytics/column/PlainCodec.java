package ug.ac.mak.der.analytics.column;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * Reference (plain / uncompressed) codec family — one implementation
 * per {@link ColumnType}. Plain means: write every value verbatim in
 * a fixed layout, no compression, no dictionary. These codecs are
 * the oracle every compressed codec in Gate 2.2–2.5 must match on a
 * round-trip test; they also serve as the fallback when a measurement
 * step decides compression saves fewer bytes than the header cost.
 *
 * <p>Layout for every type:</p>
 * <pre>
 *   [ rowCount:int32 ] [ null-bitmap-words:int32 ] [ null-bitmap:longs ]
 *   [ null-count:int32 ] [ payload ]
 * </pre>
 *
 * <p>Payload shape per type:</p>
 * <ul>
 *   <li>INT64 — {@code long[rowCount]}</li>
 *   <li>DECIMAL — {@code repeated (scale:int32, unscaled-length:int32, unscaled-bytes)}</li>
 *   <li>STRING — {@code repeated (utf8-length:int32, utf8-bytes)}</li>
 *   <li>BOOL — bit-packed long words covering rowCount bits</li>
 *   <li>DATE — {@code int[rowCount]} days-since-epoch</li>
 * </ul>
 */
public final class PlainCodec {

    private PlainCodec() {
    }

    public static Codec forType(final ColumnType type) {
        return switch (type) {
            case INT64 -> new PlainInt64();
            case DECIMAL -> new PlainDecimal();
            case STRING -> new PlainString();
            case BOOL -> new PlainBool();
            case DATE -> new PlainDate();
        };
    }

    /* ───── Header helpers ───── */

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

    private static PlainCodecHeader readHeader(final byte[] blob) {
        return PlainCodecHeader.read(blob);
    }

    /* ───── INT64 ───── */

    public static final class PlainInt64 implements Codec {
        @Override
        public String codecId() {
            return "plain-i64";
        }

        @Override
        public ColumnType columnType() {
            return ColumnType.INT64;
        }

        @Override
        public byte[] encode(final ColumnBatch batch) {
            final ColumnBatch.Int64 b = cast(batch, ColumnBatch.Int64.class);
            final int payload = b.rowCount() * 8;
            final ByteBuffer buf = writeHeader(b, payload);
            for (final long v : b.values()) {
                buf.putLong(v);
            }
            return buf.array();
        }

        @Override
        public ColumnBatch decode(final byte[] blob, final int rowCount) {
            final PlainCodecHeader h = readHeader(blob);
            final long[] values = new long[rowCount];
            for (int i = 0; i < rowCount; i++) {
                values[i] = h.buf().getLong();
            }
            final ColumnBatch.Int64 out = new ColumnBatch.Int64(values, h.nulls());
            out.seal();
            return out;
        }
    }

    /* ───── DECIMAL ───── */

    public static final class PlainDecimal implements Codec {
        @Override
        public String codecId() {
            return "plain-dec";
        }

        @Override
        public ColumnType columnType() {
            return ColumnType.DECIMAL;
        }

        @Override
        public byte[] encode(final ColumnBatch batch) {
            final ColumnBatch.Decimal b = cast(batch, ColumnBatch.Decimal.class);
            // Two-pass: size first, then encode.
            int payload = 0;
            for (int i = 0; i < b.rowCount(); i++) {
                if (b.nulls().isNull(i)) {
                    payload += 4 + 4;
                    continue;
                }
                final BigDecimal v = b.get(i);
                payload += 4 + 4 + v.unscaledValue().toByteArray().length;
            }
            final ByteBuffer buf = writeHeader(b, payload);
            for (int i = 0; i < b.rowCount(); i++) {
                if (b.nulls().isNull(i)) {
                    buf.putInt(0);
                    buf.putInt(0);
                    continue;
                }
                final BigDecimal v = b.get(i);
                final byte[] unscaled = v.unscaledValue().toByteArray();
                buf.putInt(v.scale());
                buf.putInt(unscaled.length);
                buf.put(unscaled);
            }
            return buf.array();
        }

        @Override
        public ColumnBatch decode(final byte[] blob, final int rowCount) {
            final PlainCodecHeader h = readHeader(blob);
            final BigDecimal[] values = new BigDecimal[rowCount];
            for (int i = 0; i < rowCount; i++) {
                final int scale = h.buf().getInt();
                final int len = h.buf().getInt();
                if (h.nulls().isNull(i)) {
                    values[i] = null;
                    continue;
                }
                final byte[] unscaled = new byte[len];
                h.buf().get(unscaled);
                values[i] = new BigDecimal(
                        new java.math.BigInteger(unscaled), scale);
            }
            final ColumnBatch.Decimal out = new ColumnBatch.Decimal(values, h.nulls());
            out.seal();
            return out;
        }
    }

    /* ───── STRING ───── */

    public static final class PlainString implements Codec {
        @Override
        public String codecId() {
            return "plain-str";
        }

        @Override
        public ColumnType columnType() {
            return ColumnType.STRING;
        }

        @Override
        public byte[] encode(final ColumnBatch batch) {
            final ColumnBatch.Str b = cast(batch, ColumnBatch.Str.class);
            int payload = 0;
            final byte[][] encoded = new byte[b.rowCount()][];
            for (int i = 0; i < b.rowCount(); i++) {
                if (b.nulls().isNull(i) || b.get(i) == null) {
                    encoded[i] = new byte[0];
                    payload += 4;
                    continue;
                }
                encoded[i] = b.get(i).getBytes(StandardCharsets.UTF_8);
                payload += 4 + encoded[i].length;
            }
            final ByteBuffer buf = writeHeader(b, payload);
            for (final byte[] bytes : encoded) {
                buf.putInt(bytes.length);
                buf.put(bytes);
            }
            return buf.array();
        }

        @Override
        public ColumnBatch decode(final byte[] blob, final int rowCount) {
            final PlainCodecHeader h = readHeader(blob);
            final String[] values = new String[rowCount];
            for (int i = 0; i < rowCount; i++) {
                final int len = h.buf().getInt();
                if (h.nulls().isNull(i)) {
                    values[i] = null;
                    continue;
                }
                final byte[] bytes = new byte[len];
                h.buf().get(bytes);
                values[i] = new String(bytes, StandardCharsets.UTF_8);
            }
            final ColumnBatch.Str out = new ColumnBatch.Str(values, h.nulls());
            out.seal();
            return out;
        }
    }

    /* ───── BOOL ───── */

    public static final class PlainBool implements Codec {
        @Override
        public String codecId() {
            return "plain-bol";
        }

        @Override
        public ColumnType columnType() {
            return ColumnType.BOOL;
        }

        @Override
        public byte[] encode(final ColumnBatch batch) {
            final ColumnBatch.Bool b = cast(batch, ColumnBatch.Bool.class);
            final long[] bits = b.bits();
            final int payload = 4 + bits.length * 8;
            final ByteBuffer buf = writeHeader(b, payload);
            buf.putInt(bits.length);
            for (final long w : bits) {
                buf.putLong(w);
            }
            return buf.array();
        }

        @Override
        public ColumnBatch decode(final byte[] blob, final int rowCount) {
            final PlainCodecHeader h = readHeader(blob);
            final int wordCount = h.buf().getInt();
            final long[] bits = new long[wordCount];
            for (int i = 0; i < wordCount; i++) {
                bits[i] = h.buf().getLong();
            }
            final ColumnBatch.Bool out = new ColumnBatch.Bool(bits,
                    rowCount, h.nulls());
            out.seal();
            return out;
        }
    }

    /* ───── DATE ───── */

    public static final class PlainDate implements Codec {
        @Override
        public String codecId() {
            return "plain-dat";
        }

        @Override
        public ColumnType columnType() {
            return ColumnType.DATE;
        }

        @Override
        public byte[] encode(final ColumnBatch batch) {
            final ColumnBatch.Date b = cast(batch, ColumnBatch.Date.class);
            final int payload = b.rowCount() * 4;
            final ByteBuffer buf = writeHeader(b, payload);
            for (final int v : b.epochDays()) {
                buf.putInt(v);
            }
            return buf.array();
        }

        @Override
        public ColumnBatch decode(final byte[] blob, final int rowCount) {
            final PlainCodecHeader h = readHeader(blob);
            final int[] values = new int[rowCount];
            for (int i = 0; i < rowCount; i++) {
                values[i] = h.buf().getInt();
            }
            final ColumnBatch.Date out = new ColumnBatch.Date(values, h.nulls());
            out.seal();
            return out;
        }
    }

    private static <T extends ColumnBatch> T cast(final ColumnBatch batch,
                                                     final Class<T> type) {
        Objects.requireNonNull(batch, "batch");
        if (!type.isInstance(batch)) {
            throw new IllegalArgumentException(
                    "codec expected " + type.getSimpleName()
                  + " but got " + batch.getClass().getSimpleName());
        }
        return type.cast(batch);
    }
}
