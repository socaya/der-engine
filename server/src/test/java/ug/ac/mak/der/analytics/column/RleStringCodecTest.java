package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RleStringCodecTest {

    @Test
    void clusteredValuesRoundTrip() {
        final ColumnBatch.Str b = new ColumnBatch.Str(8);
        b.set(0, "OU-A");
        b.set(1, "OU-A");
        b.set(2, "OU-A");
        b.set(3, "OU-B");
        b.set(4, "OU-B");
        b.set(5, "OU-C");
        b.set(6, "OU-C");
        b.set(7, "OU-C");
        b.seal();
        final Codec codec = new RleStringCodec();
        final ColumnBatch.Str out = (ColumnBatch.Str)
                codec.decode(codec.encode(b), 8);
        for (int i = 0; i < 8; i++) {
            assertThat(out.get(i)).isEqualTo(b.get(i));
        }
    }

    @Test
    void clusteredValuesBeatPlain() {
        final ColumnBatch.Str b = new ColumnBatch.Str(64);
        for (int i = 0; i < 64; i++) {
            b.set(i, i < 32 ? "repeat-left" : "repeat-right");
        }
        b.seal();
        final Codec rle = new RleStringCodec();
        final Codec plain = PlainCodec.forType(ColumnType.STRING);
        assertThat(rle.encode(b).length)
                .isLessThan(plain.encode(b).length);
    }

    @Test
    void nullsPreservedAcrossRoundTrip() {
        final ColumnBatch.Str b = new ColumnBatch.Str(7);
        b.set(0, "x");
        b.set(1, "x");
        b.set(2, null);
        b.set(3, "y");
        b.set(4, null);
        b.set(5, "y");
        b.set(6, "y");
        b.seal();
        final Codec codec = new RleStringCodec();
        final ColumnBatch.Str out = (ColumnBatch.Str)
                codec.decode(codec.encode(b), 7);
        assertThat(out.get(0)).isEqualTo("x");
        assertThat(out.get(1)).isEqualTo("x");
        assertThat(out.nulls().isNull(2)).isTrue();
        assertThat(out.get(3)).isEqualTo("y");
        assertThat(out.nulls().isNull(4)).isTrue();
        assertThat(out.get(5)).isEqualTo("y");
        assertThat(out.get(6)).isEqualTo("y");
    }

    @Test
    void allNullsRoundTrips() {
        final ColumnBatch.Str b = new ColumnBatch.Str(3);
        b.set(0, null);
        b.set(1, null);
        b.set(2, null);
        b.seal();
        final Codec codec = new RleStringCodec();
        final ColumnBatch.Str out = (ColumnBatch.Str)
                codec.decode(codec.encode(b), 3);
        assertThat(out.nulls().nullCount()).isEqualTo(3);
    }

    @Test
    void utf8BytesPreserved() {
        final ColumnBatch.Str b = new ColumnBatch.Str(4);
        b.set(0, "Kampala-Mulago — ɐʍ");
        b.set(1, "Kampala-Mulago — ɐʍ");
        b.set(2, "Entebbe — ɐʍ");
        b.set(3, "Entebbe — ɐʍ");
        b.seal();
        final Codec codec = new RleStringCodec();
        final ColumnBatch.Str out = (ColumnBatch.Str)
                codec.decode(codec.encode(b), 4);
        assertThat(out.get(0)).isEqualTo("Kampala-Mulago — ɐʍ");
        assertThat(out.get(3)).isEqualTo("Entebbe — ɐʍ");
    }

    @Test
    void encodeIsDeterministic() {
        final ColumnBatch.Str b1 = new ColumnBatch.Str(4);
        final ColumnBatch.Str b2 = new ColumnBatch.Str(4);
        for (int i = 0; i < 4; i++) {
            b1.set(i, i < 2 ? "a" : "b");
            b2.set(i, i < 2 ? "a" : "b");
        }
        b1.seal();
        b2.seal();
        final Codec codec = new RleStringCodec();
        assertThat(codec.encode(b1)).isEqualTo(codec.encode(b2));
    }

    @Test
    void codecIdMatchesBuiltinRegistry() {
        final Codec c = new RleStringCodec();
        assertThat(BuiltinCodecs.lookup(c.codecId())).isNotNull();
        assertThat(c.columnType()).isEqualTo(ColumnType.STRING);
    }
}
