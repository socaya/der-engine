package ug.ac.mak.der.analytics.column;

/**
 * Resolve a codec id (plain, structural or wrapped-in-compression)
 * into a usable {@link Codec} instance. The registry
 * {@link BuiltinCodecs} knows the base codecs; wrapped ids of the
 * form {@code "<compressor>+<inner>"} are handled here by
 * re-constructing a {@link CompressedCodec}.
 *
 * <p>This is the inverse of what {@link CompressedCodec#codecId}
 * produces. Readers call this once per segment column so they can
 * decode without carrying the writer's codec instance.</p>
 */
public final class CodecResolver {

    private CodecResolver() {
    }

    public static Codec resolve(final String codecId) {
        if (codecId == null || codecId.isEmpty()) {
            return null;
        }
        final int plus = codecId.indexOf('+');
        if (plus < 0) {
            return BuiltinCodecs.lookup(codecId);
        }
        final String compressorId = codecId.substring(0, plus);
        final String innerId = codecId.substring(plus + 1);
        final Codec inner = BuiltinCodecs.lookup(innerId);
        if (inner == null) {
            return null;
        }
        final Compressor compressor = resolveCompressor(compressorId);
        if (compressor == null) {
            return null;
        }
        return new CompressedCodec(compressor, inner,
                BuiltinCodecs::lookup);
    }

    private static Compressor resolveCompressor(final String id) {
        if ("lz4".equals(id)) {
            return new Lz4Compressor();
        }
        // zstd level encoded as "zstd-l<level>".
        if (id.startsWith("zstd-l")) {
            try {
                final int level = Integer.parseInt(id.substring(6));
                return new ZstdCompressor(level);
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }
}
