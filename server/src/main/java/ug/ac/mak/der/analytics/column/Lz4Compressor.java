package ug.ac.mak.der.analytics.column;

import net.jpountz.lz4.LZ4Factory;
import net.jpountz.lz4.LZ4FastDecompressor;

/**
 * LZ4 compressor binding. Fast-compressor default — LZ4's whole
 * story is "decompress speed at the expense of ratio", so this is
 * the right choice when we expect scan latency to dominate over
 * disk footprint. Zstd typically ships a smaller result; the
 * selector picks whichever saves more bytes on the measured batch.
 */
public final class Lz4Compressor implements Compressor {

    private final LZ4Factory factory;

    public Lz4Compressor() {
        this.factory = LZ4Factory.fastestInstance();
    }

    @Override
    public String id() {
        return "lz4";
    }

    @Override
    public byte[] compress(final byte[] raw) {
        return factory.fastCompressor().compress(raw);
    }

    @Override
    public byte[] decompress(final byte[] compressed,
                                final int uncompressedLen) {
        final LZ4FastDecompressor dec = factory.fastDecompressor();
        final byte[] out = new byte[uncompressedLen];
        dec.decompress(compressed, 0, out, 0, uncompressedLen);
        return out;
    }
}
