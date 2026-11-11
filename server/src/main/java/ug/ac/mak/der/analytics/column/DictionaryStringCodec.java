package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Dictionary codec for STRING columns (SRS FR-STO-007). Builds a
 * unique-value dictionary from the batch, replaces each row's
 * value with its dictionary id, and bit-packs the ids using the
 * minimum width needed. Very effective for low-cardinality string
 * columns (org-unit UIDs, option codes, status).
 *
 * <p>Layout after the shared header (see {@link PlainCodec}):</p>
 * <pre>
 *   [ dictSize:int32 ]
 *   [ repeated (utf8-len:int32, utf8-bytes) × dictSize ]
 *   [ bitsPerId:int32 ]
 *   [ packedBytesLen:int32 ]
 *   [ packedBytes ]
 * </pre>
 *
 * <p>Nulls do not take a dictionary slot — the shared null bitmap
 * marks them and the corresponding packed-id slot is a zero value
 * that readers must skip.</p>
 */
public final class DictionaryStringCodec implements Codec {

    @Override
    public String codecId() {
        return "dict-str";
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
                    "dictionary-str codec expects Str batch");
        }
        // Pass 1 — build dictionary preserving first-seen order.
        final Map<String, Integer> dict = new LinkedHashMap<>();
        final long[] ids = new long[str.rowCount()];
        for (int i = 0; i < str.rowCount(); i++) {
            if (str.nulls().isNull(i) || str.get(i) == null) {
                ids[i] = 0L;
                continue;
            }
            ids[i] = dict.computeIfAbsent(str.get(i), k -> dict.size());
        }
        final int dictSize = dict.size();
        final int bitsPerId = BitPacker.bitsRequired(
                Math.max(0, dictSize - 1));
        final byte[] packed = BitPacker.pack(ids, bitsPerId);

        // Pre-compute dict payload size.
        int dictBytes = 4;
        final byte[][] utf8 = new byte[dictSize][];
        int k = 0;
        for (final String s : dict.keySet()) {
            utf8[k] = s.getBytes(StandardCharsets.UTF_8);
            dictBytes += 4 + utf8[k].length;
            k++;
        }
        final int payload = dictBytes + 4 + 4 + packed.length;
        final ByteBuffer buf = writeHeader(str, payload);
        buf.putInt(dictSize);
        for (final byte[] row : utf8) {
            buf.putInt(row.length);
            buf.put(row);
        }
        buf.putInt(bitsPerId);
        buf.putInt(packed.length);
        buf.put(packed);
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final PlainCodecHeader h = PlainCodecHeader.read(blob);
        final int dictSize = h.buf().getInt();
        final String[] dict = new String[dictSize];
        for (int i = 0; i < dictSize; i++) {
            final int len = h.buf().getInt();
            final byte[] bytes = new byte[len];
            h.buf().get(bytes);
            dict[i] = new String(bytes, StandardCharsets.UTF_8);
        }
        final int bitsPerId = h.buf().getInt();
        final int packedLen = h.buf().getInt();
        final byte[] packed = new byte[packedLen];
        h.buf().get(packed);
        final long[] ids = BitPacker.unpack(packed, rowCount, bitsPerId);
        final String[] values = new String[rowCount];
        for (int i = 0; i < rowCount; i++) {
            if (h.nulls().isNull(i)) {
                values[i] = null;
                continue;
            }
            values[i] = dict[(int) ids[i]];
        }
        final ColumnBatch.Str out = new ColumnBatch.Str(
                values, h.nulls());
        out.seal();
        return out;
    }

    private static ByteBuffer writeHeader(final ColumnBatch batch,
                                            final int payloadBytes) {
        // Mirror PlainCodec's header layout — rowCount + null-bitmap
        // words + null-bitmap + null-count — so a reader can stage
        // through either codec with the same preamble logic.
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

    /** Dictionary + bit-pack is only competitive when cardinality
     *  is a small fraction of rows. Exposed here so a selector can
     *  cheaply skip measurement when the batch is clearly wide. */
    public static int estimateDictionarySize(final ColumnBatch.Str str) {
        final HashSet<String> seen = new HashSet<>();
        for (int i = 0; i < str.rowCount(); i++) {
            if (str.nulls().isNull(i) || str.get(i) == null) {
                continue;
            }
            seen.add(str.get(i));
        }
        return seen.size();
    }
}
