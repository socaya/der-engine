package ug.ac.mak.der.analytics.column;

/**
 * Strategy interface for the generic page-level compression wrappers
 * (SRS FR-STO-007). An implementation knows how to compress + de-
 * compress an opaque byte array. Used by {@link CompressedCodec} so
 * Zstd and LZ4 share the integrity framing + length prefix logic.
 */
public interface Compressor {

    String id();

    byte[] compress(byte[] raw);

    byte[] decompress(byte[] compressed, int uncompressedLen);
}
