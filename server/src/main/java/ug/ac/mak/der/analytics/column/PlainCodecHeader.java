package ug.ac.mak.der.analytics.column;

import java.nio.ByteBuffer;

/**
 * Shared header layout used by every codec. The first bytes of
 * every encoded blob are {@code rowCount + null-bitmap-words +
 * null-bitmap + null-count}, after which each codec writes its
 * own payload. Carried as a package-private helper so plain,
 * dictionary, bit-pack and future codecs can all stage through
 * the same preamble.
 */
record PlainCodecHeader(int rowCount, NullBitmap nulls, ByteBuffer buf) {

    static PlainCodecHeader read(final byte[] blob) {
        final ByteBuffer buf = ByteBuffer.wrap(blob);
        final int rowCount = buf.getInt();
        final int wordCount = buf.getInt();
        final long[] words = new long[wordCount];
        for (int i = 0; i < wordCount; i++) {
            words[i] = buf.getLong();
        }
        final int nullCount = buf.getInt();
        final NullBitmap nulls = new NullBitmap(words, rowCount, nullCount);
        return new PlainCodecHeader(rowCount, nulls, buf);
    }
}
