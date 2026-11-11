package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;
import java.util.Objects;

import net.jpountz.xxhash.XXHashFactory;

/**
 * Generic compression wrapper (SRS FR-STO-007 + FR-STO-006
 * page-level integrity). Encodes the batch through an inner typed
 * codec, hands the result to a {@link Compressor}, and emits:
 *
 * <pre>
 *   [ uncompressed-len:int32 ]
 *   [ xxHash64 of uncompressed bytes:int64 ]
 *   [ inner-codec-id length:int8 ]
 *   [ inner-codec-id:utf8 ]
 *   [ compressed-bytes ]
 * </pre>
 *
 * <p>On decode, we decompress, verify the xxHash64, and delegate
 * to the inner codec by looking up its id. A hash mismatch throws
 * — corrupt pages are a hard failure, never silent (SRS §0).</p>
 *
 * <p>The wrapper tracks the inner codec id instead of its reference
 * so a reader can swap out concrete codec implementations without
 * rewriting segments — forward compat for Gate 5.</p>
 */
public final class CompressedCodec implements Codec {

    private static final XXHashFactory XXHASH =
            XXHashFactory.fastestInstance();
    /** Fixed non-zero seed — stability matters more than secrecy
     *  since the hash is an integrity check, not a MAC. */
    private static final long XXHASH_SEED = 0xDEA17ADEEDBEEF01L;

    private final Compressor compressor;
    private final Codec inner;
    private final java.util.function.Function<String, Codec> codecLookup;

    public CompressedCodec(final Compressor compressor,
                             final Codec inner,
                             final java.util.function.Function<String, Codec>
                                     codecLookup) {
        this.compressor = Objects.requireNonNull(compressor, "compressor");
        this.inner = Objects.requireNonNull(inner, "inner");
        this.codecLookup = Objects.requireNonNull(codecLookup,
                "codecLookup");
    }

    @Override
    public String codecId() {
        return compressor.id() + "+" + inner.codecId();
    }

    @Override
    public ColumnType columnType() {
        return inner.columnType();
    }

    @Override
    public byte[] encode(final ColumnBatch batch) {
        final byte[] raw = inner.encode(batch);
        final long hash = XXHASH.hash64().hash(raw, 0, raw.length,
                XXHASH_SEED);
        final byte[] compressed = compressor.compress(raw);
        final byte[] innerId = inner.codecId()
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (innerId.length > 0xFF) {
            throw new IllegalArgumentException(
                    "inner codec id too long: " + inner.codecId());
        }
        final int size = 4 + 8 + 1 + innerId.length + compressed.length;
        final ByteBuffer buf = ByteBuffer.allocate(size);
        buf.putInt(raw.length);
        buf.putLong(hash);
        buf.put((byte) innerId.length);
        buf.put(innerId);
        buf.put(compressed);
        return buf.array();
    }

    @Override
    public ColumnBatch decode(final byte[] blob, final int rowCount) {
        final ByteBuffer buf = ByteBuffer.wrap(blob);
        final int uncompressedLen = buf.getInt();
        final long expectedHash = buf.getLong();
        final int idLen = buf.get() & 0xFF;
        final byte[] idBytes = new byte[idLen];
        buf.get(idBytes);
        final String innerId = new String(idBytes,
                java.nio.charset.StandardCharsets.UTF_8);
        final byte[] compressed = new byte[buf.remaining()];
        buf.get(compressed);
        final byte[] raw = compressor.decompress(compressed, uncompressedLen);
        final long actualHash = XXHASH.hash64().hash(raw, 0, raw.length,
                XXHASH_SEED);
        if (actualHash != expectedHash) {
            throw new IllegalStateException(
                    "compressed page corrupt: xxHash64 mismatch (expected "
                  + Long.toHexString(expectedHash)
                  + ", actual " + Long.toHexString(actualHash) + ")");
        }
        final Codec innerCodec = codecLookup.apply(innerId);
        if (innerCodec == null) {
            throw new IllegalStateException(
                    "unknown inner codec id: " + innerId);
        }
        return innerCodec.decode(raw, rowCount);
    }
}
