package ug.ac.mak.der.analytics.column;

import java.util.Arrays;

/**
 * Pack and unpack sequences of non-negative integers into a dense
 * byte stream using the minimum number of bits per value. Used by
 * dictionary + delta codecs.
 *
 * <p>A width of 0 bits is valid — every value must be zero, no
 * bytes consumed. Caller handles the min/offset subtraction so
 * this class only sees packed deltas.</p>
 */
public final class BitPacker {

    private BitPacker() {
    }

    /** @return minimum bits required to represent every value in
     *  {@code [0, maxValue]} inclusive. */
    public static int bitsRequired(final long maxValue) {
        if (maxValue < 0) {
            throw new IllegalArgumentException(
                    "maxValue must be non-negative");
        }
        if (maxValue == 0) {
            return 0;
        }
        return 64 - Long.numberOfLeadingZeros(maxValue);
    }

    /** Byte length needed to pack {@code count} values of
     *  {@code bits} bits each. */
    public static int packedByteCount(final int count, final int bits) {
        if (count < 0 || bits < 0 || bits > 63) {
            throw new IllegalArgumentException(
                    "count and bits must be non-negative; bits <= 63");
        }
        return (int) (((long) count * bits + 7L) / 8L);
    }

    /** Pack {@code values} into a dense byte array using
     *  {@code bits} per value. */
    public static byte[] pack(final long[] values, final int bits) {
        if (bits == 0) {
            return new byte[0];
        }
        final byte[] out = new byte[packedByteCount(values.length, bits)];
        long buffer = 0L;
        int bitsInBuffer = 0;
        int byteIndex = 0;
        final long mask = (1L << bits) - 1L;
        for (final long v : values) {
            buffer |= (v & mask) << bitsInBuffer;
            bitsInBuffer += bits;
            while (bitsInBuffer >= 8) {
                out[byteIndex++] = (byte) (buffer & 0xFF);
                buffer >>>= 8;
                bitsInBuffer -= 8;
            }
        }
        if (bitsInBuffer > 0) {
            out[byteIndex] = (byte) (buffer & 0xFF);
        }
        return out;
    }

    /** Unpack {@code count} values of {@code bits} bits each from
     *  a dense byte array. */
    public static long[] unpack(final byte[] bytes, final int count,
                                   final int bits) {
        final long[] out = new long[count];
        if (bits == 0) {
            return out;
        }
        long buffer = 0L;
        int bitsInBuffer = 0;
        int byteIndex = 0;
        final long mask = (1L << bits) - 1L;
        for (int i = 0; i < count; i++) {
            while (bitsInBuffer < bits && byteIndex < bytes.length) {
                buffer |= (bytes[byteIndex++] & 0xFFL) << bitsInBuffer;
                bitsInBuffer += 8;
            }
            out[i] = buffer & mask;
            buffer >>>= bits;
            bitsInBuffer -= bits;
        }
        return out;
    }

    /** Small helper for tests: assert byte identity after a
     *  round-trip. */
    static boolean roundTripEquals(final long[] values, final int bits) {
        final byte[] packed = pack(values, bits);
        final long[] unpacked = unpack(packed, values.length, bits);
        return Arrays.equals(values, unpacked);
    }
}
