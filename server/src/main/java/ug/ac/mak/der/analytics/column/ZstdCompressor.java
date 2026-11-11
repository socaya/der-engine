package ug.ac.mak.der.analytics.column;

import com.github.luben.zstd.Zstd;

/**
 * Zstandard compressor binding. Level 3 is the Zstd default — the
 * compression/speed sweet spot for the analytics workload. A
 * per-segment level override lands in Gate 5 when we have measured
 * evidence.
 */
public final class ZstdCompressor implements Compressor {

    private static final int DEFAULT_LEVEL = 3;

    private final int level;

    public ZstdCompressor() {
        this(DEFAULT_LEVEL);
    }

    public ZstdCompressor(final int level) {
        this.level = level;
    }

    @Override
    public String id() {
        return "zstd-l" + level;
    }

    @Override
    public byte[] compress(final byte[] raw) {
        return Zstd.compress(raw, level);
    }

    @Override
    public byte[] decompress(final byte[] compressed,
                                final int uncompressedLen) {
        final byte[] out = new byte[uncompressedLen];
        final long n = Zstd.decompress(out, compressed);
        if (Zstd.isError(n)) {
            throw new IllegalStateException("zstd decompress failed: "
                    + Zstd.getErrorName(n));
        }
        if ((int) n != uncompressedLen) {
            throw new IllegalStateException(
                    "zstd produced " + n + " bytes; expected "
                    + uncompressedLen);
        }
        return out;
    }
}
