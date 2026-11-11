package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DeltaInt64CodecTest {

    @Test
    void monotonicSequenceRoundTrips() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(8);
        for (int i = 0; i < 8; i++) {
            b.set(i, 1_000_000L + i);
        }
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final byte[] encoded = codec.encode(b);
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(encoded, 8);
        for (int i = 0; i < 8; i++) {
            assertThat(out.get(i)).isEqualTo(1_000_000L + i);
        }
    }

    @Test
    void monotonicSequenceBeatsPlain() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(128);
        for (int i = 0; i < 128; i++) {
            b.set(i, 1_000_000L + i);
        }
        b.seal();
        final Codec delta = new DeltaInt64Codec();
        final Codec plain = PlainCodec.forType(ColumnType.INT64);
        assertThat(delta.encode(b).length).isLessThan(plain.encode(b).length);
    }

    @Test
    void mixedSignDeltasRoundTrip() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 100L);
        b.set(1, 90L);
        b.set(2, 110L);
        b.set(3, 50L);
        b.set(4, 60L);
        b.set(5, 55L);
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 6);
        assertThat(out.get(0)).isEqualTo(100L);
        assertThat(out.get(1)).isEqualTo(90L);
        assertThat(out.get(2)).isEqualTo(110L);
        assertThat(out.get(3)).isEqualTo(50L);
        assertThat(out.get(4)).isEqualTo(60L);
        assertThat(out.get(5)).isEqualTo(55L);
    }

    @Test
    void nullsPreservedAcrossRoundTrip() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 10L);
        b.setNull(1);
        b.set(2, 20L);
        b.setNull(3);
        b.set(4, 25L);
        b.set(5, 30L);
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 6);
        assertThat(out.nulls().isNull(1)).isTrue();
        assertThat(out.nulls().isNull(3)).isTrue();
        assertThat(out.get(0)).isEqualTo(10L);
        assertThat(out.get(2)).isEqualTo(20L);
        assertThat(out.get(4)).isEqualTo(25L);
        assertThat(out.get(5)).isEqualTo(30L);
    }

    @Test
    void allNullsRoundTrips() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(3);
        b.setNull(0);
        b.setNull(1);
        b.setNull(2);
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 3);
        assertThat(out.nulls().nullCount()).isEqualTo(3);
    }

    @Test
    void singleValueRoundTrips() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(1);
        b.set(0, 42L);
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 1);
        assertThat(out.get(0)).isEqualTo(42L);
    }

    @Test
    void extremeDeltasFallBackToFullWidth() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(2);
        b.set(0, Long.MIN_VALUE);
        b.set(1, Long.MAX_VALUE);
        b.seal();
        final Codec codec = new DeltaInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 2);
        assertThat(out.get(0)).isEqualTo(Long.MIN_VALUE);
        assertThat(out.get(1)).isEqualTo(Long.MAX_VALUE);
    }

    @Test
    void zigZagRoundTripsSignedRange() {
        final long[] inputs = {0L, 1L, -1L, 42L, -42L,
                Long.MAX_VALUE, Long.MIN_VALUE + 1};
        for (final long v : inputs) {
            assertThat(DeltaInt64Codec.unZigZag(DeltaInt64Codec.zigZag(v)))
                    .isEqualTo(v);
        }
    }

    @Test
    void encodeIsDeterministic() {
        final ColumnBatch.Int64 b1 = new ColumnBatch.Int64(4);
        final ColumnBatch.Int64 b2 = new ColumnBatch.Int64(4);
        for (int i = 0; i < 4; i++) {
            b1.set(i, 100L + i);
            b2.set(i, 100L + i);
        }
        b1.seal();
        b2.seal();
        final Codec codec = new DeltaInt64Codec();
        assertThat(codec.encode(b1)).isEqualTo(codec.encode(b2));
    }

    @Test
    void codecIdMatchesBuiltinRegistry() {
        final Codec c = new DeltaInt64Codec();
        assertThat(BuiltinCodecs.lookup(c.codecId())).isNotNull();
        assertThat(c.columnType()).isEqualTo(ColumnType.INT64);
    }
}
