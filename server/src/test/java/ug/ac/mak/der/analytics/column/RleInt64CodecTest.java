package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RleInt64CodecTest {

    @Test
    void repeatedValuesRoundTrip() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(10);
        for (int i = 0; i < 5; i++) {
            b.set(i, 1L);
        }
        for (int i = 5; i < 10; i++) {
            b.set(i, 2L);
        }
        b.seal();
        final Codec codec = new RleInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 10);
        for (int i = 0; i < 5; i++) {
            assertThat(out.get(i)).isEqualTo(1L);
        }
        for (int i = 5; i < 10; i++) {
            assertThat(out.get(i)).isEqualTo(2L);
        }
    }

    @Test
    void repeatedValuesBeatPlain() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(256);
        for (int i = 0; i < 256; i++) {
            b.set(i, i < 128 ? 0L : 1L);
        }
        b.seal();
        final Codec rle = new RleInt64Codec();
        final Codec plain = PlainCodec.forType(ColumnType.INT64);
        assertThat(rle.encode(b).length)
                .isLessThan(plain.encode(b).length);
    }

    @Test
    void nullsPreservedAcrossRoundTrip() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 10L);
        b.set(1, 10L);
        b.setNull(2);
        b.set(3, 20L);
        b.setNull(4);
        b.set(5, 20L);
        b.seal();
        final Codec codec = new RleInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 6);
        assertThat(out.get(0)).isEqualTo(10L);
        assertThat(out.get(1)).isEqualTo(10L);
        assertThat(out.nulls().isNull(2)).isTrue();
        assertThat(out.get(3)).isEqualTo(20L);
        assertThat(out.nulls().isNull(4)).isTrue();
        assertThat(out.get(5)).isEqualTo(20L);
    }

    @Test
    void allNullsRoundTrips() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(3);
        b.setNull(0);
        b.setNull(1);
        b.setNull(2);
        b.seal();
        final Codec codec = new RleInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 3);
        assertThat(out.nulls().nullCount()).isEqualTo(3);
    }

    @Test
    void alternatingValuesStillRoundTrip() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(6);
        b.set(0, 1L);
        b.set(1, 2L);
        b.set(2, 1L);
        b.set(3, 2L);
        b.set(4, 1L);
        b.set(5, 2L);
        b.seal();
        final Codec codec = new RleInt64Codec();
        final ColumnBatch.Int64 out = (ColumnBatch.Int64)
                codec.decode(codec.encode(b), 6);
        for (int i = 0; i < 6; i++) {
            assertThat(out.get(i)).isEqualTo(b.get(i));
        }
    }

    @Test
    void encodeIsDeterministic() {
        final ColumnBatch.Int64 b1 = new ColumnBatch.Int64(4);
        final ColumnBatch.Int64 b2 = new ColumnBatch.Int64(4);
        for (int i = 0; i < 4; i++) {
            b1.set(i, i < 2 ? 5L : 9L);
            b2.set(i, i < 2 ? 5L : 9L);
        }
        b1.seal();
        b2.seal();
        final Codec codec = new RleInt64Codec();
        assertThat(codec.encode(b1)).isEqualTo(codec.encode(b2));
    }

    @Test
    void codecIdMatchesBuiltinRegistry() {
        final Codec c = new RleInt64Codec();
        assertThat(BuiltinCodecs.lookup(c.codecId())).isNotNull();
        assertThat(c.columnType()).isEqualTo(ColumnType.INT64);
    }
}
