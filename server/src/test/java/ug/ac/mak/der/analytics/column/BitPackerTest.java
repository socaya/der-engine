package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class BitPackerTest {

    @Test
    void bitsRequiredCoversEdgeValues() {
        assertThat(BitPacker.bitsRequired(0L)).isZero();
        assertThat(BitPacker.bitsRequired(1L)).isEqualTo(1);
        assertThat(BitPacker.bitsRequired(7L)).isEqualTo(3);
        assertThat(BitPacker.bitsRequired(255L)).isEqualTo(8);
        assertThat(BitPacker.bitsRequired(256L)).isEqualTo(9);
        assertThat(BitPacker.bitsRequired(Long.MAX_VALUE)).isEqualTo(63);
    }

    @Test
    void negativeMaxValueRejected() {
        assertThatThrownBy(() -> BitPacker.bitsRequired(-1L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void zeroBitsRoundTrips() {
        final long[] values = { 0L, 0L, 0L, 0L };
        final byte[] packed = BitPacker.pack(values, 0);
        assertThat(packed).isEmpty();
        final long[] round = BitPacker.unpack(packed, 4, 0);
        assertThat(round).containsExactly(0L, 0L, 0L, 0L);
    }

    @Test
    void threeBitsPackTightly() {
        final long[] values = { 0, 1, 2, 3, 4, 5, 6, 7 };
        final byte[] packed = BitPacker.pack(values, 3);
        // 8 values × 3 bits = 24 bits → 3 bytes
        assertThat(packed).hasSize(3);
        final long[] round = BitPacker.unpack(packed, 8, 3);
        assertThat(round).isEqualTo(values);
    }

    @Test
    void variousWidthsRoundTrip() {
        for (int bits = 1; bits <= 20; bits++) {
            final long max = (1L << bits) - 1L;
            final long[] values = new long[31];
            for (int i = 0; i < values.length; i++) {
                values[i] = (long) (Math.random() * (max + 1));
            }
            assertThat(BitPacker.roundTripEquals(values, bits))
                    .withFailMessage("bits=%d round-trip failed", bits)
                    .isTrue();
        }
    }

    @Test
    void widthBoundaryAcrossByteEdges() {
        // 13-bit values cross byte boundaries in both directions.
        final long[] values = { 0, 1, 1023, 4095, 8191, 7, 2048, 1 };
        final byte[] packed = BitPacker.pack(values, 13);
        final long[] round = BitPacker.unpack(packed, values.length, 13);
        assertThat(round).isEqualTo(values);
    }
}
