package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class PlainCodecTest {

    @Test
    void int64RoundTripIncludesNulls() {
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(5);
        batch.set(0, 1L);
        batch.set(1, -42L);
        batch.setNull(2);
        batch.set(3, Long.MAX_VALUE);
        batch.set(4, Long.MIN_VALUE);
        batch.seal();

        final Codec codec = PlainCodec.forType(ColumnType.INT64);
        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Int64 decoded = (ColumnBatch.Int64)
                codec.decode(encoded, 5);

        assertThat(decoded.rowCount()).isEqualTo(5);
        assertThat(decoded.get(0)).isEqualTo(1L);
        assertThat(decoded.get(1)).isEqualTo(-42L);
        assertThat(decoded.nulls().isNull(2)).isTrue();
        assertThat(decoded.get(3)).isEqualTo(Long.MAX_VALUE);
        assertThat(decoded.get(4)).isEqualTo(Long.MIN_VALUE);
        assertThat(decoded.nulls().nullCount()).isEqualTo(1);
    }

    @Test
    void decimalRoundTripPreservesScale() {
        final ColumnBatch.Decimal batch = new ColumnBatch.Decimal(4);
        batch.set(0, new BigDecimal("3.14159"));
        batch.set(1, new BigDecimal("0.0001"));
        batch.set(2, null);
        batch.set(3, new BigDecimal("-99999999999999999999"));
        batch.seal();

        final Codec codec = PlainCodec.forType(ColumnType.DECIMAL);
        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Decimal decoded = (ColumnBatch.Decimal)
                codec.decode(encoded, 4);

        assertThat(decoded.get(0)).isEqualByComparingTo("3.14159");
        assertThat(decoded.get(0).scale()).isEqualTo(5);
        assertThat(decoded.get(1)).isEqualByComparingTo("0.0001");
        assertThat(decoded.nulls().isNull(2)).isTrue();
        assertThat(decoded.get(2)).isNull();
        assertThat(decoded.get(3))
                .isEqualByComparingTo("-99999999999999999999");
    }

    @Test
    void stringRoundTripIncludingUtf8() {
        final ColumnBatch.Str batch = new ColumnBatch.Str(4);
        batch.set(0, "OU-A");
        batch.set(1, "DER Analytics — ɐʍ");
        batch.set(2, "");
        batch.set(3, null);
        batch.seal();

        final Codec codec = PlainCodec.forType(ColumnType.STRING);
        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Str decoded = (ColumnBatch.Str)
                codec.decode(encoded, 4);

        assertThat(decoded.get(0)).isEqualTo("OU-A");
        assertThat(decoded.get(1)).isEqualTo("DER Analytics — ɐʍ");
        assertThat(decoded.get(2)).isEmpty();
        assertThat(decoded.nulls().isNull(3)).isTrue();
    }

    @Test
    void boolRoundTripPreservesBitPattern() {
        final ColumnBatch.Bool batch = new ColumnBatch.Bool(130);
        for (int i = 0; i < 130; i++) {
            batch.set(i, i % 3 == 0);
        }
        batch.seal();

        final Codec codec = PlainCodec.forType(ColumnType.BOOL);
        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Bool decoded = (ColumnBatch.Bool)
                codec.decode(encoded, 130);

        for (int i = 0; i < 130; i++) {
            assertThat(decoded.get(i)).isEqualTo(i % 3 == 0);
        }
    }

    @Test
    void dateRoundTripUsesEpochDays() {
        final ColumnBatch.Date batch = new ColumnBatch.Date(3);
        batch.set(0, LocalDate.of(1970, 1, 1));
        batch.set(1, LocalDate.of(2026, 11, 11));
        batch.set(2, null);
        batch.seal();

        final Codec codec = PlainCodec.forType(ColumnType.DATE);
        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Date decoded = (ColumnBatch.Date)
                codec.decode(encoded, 3);

        assertThat(decoded.getEpochDay(0)).isZero();
        assertThat(decoded.getLocalDate(1))
                .isEqualTo(LocalDate.of(2026, 11, 11));
        assertThat(decoded.nulls().isNull(2)).isTrue();
    }

    @Test
    void encodeIsDeterministic() {
        // Same batch twice → byte-identical output (segment checksums
        // need this per SRS FR-STO-006).
        final ColumnBatch.Int64 b1 = new ColumnBatch.Int64(3);
        b1.set(0, 10);
        b1.set(1, 20);
        b1.setNull(2);
        b1.seal();
        final ColumnBatch.Int64 b2 = new ColumnBatch.Int64(3);
        b2.set(0, 10);
        b2.set(1, 20);
        b2.setNull(2);
        b2.seal();
        final Codec codec = PlainCodec.forType(ColumnType.INT64);

        assertThat(codec.encode(b1)).isEqualTo(codec.encode(b2));
    }

    @Test
    void sealedBatchRejectsFurtherWrites() {
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(2);
        batch.set(0, 1L);
        batch.seal();

        try {
            batch.set(1, 2L);
            throw new AssertionError("expected IllegalStateException");
        } catch (IllegalStateException expected) {
            assertThat(expected).hasMessageContaining("sealed");
        }
    }

    @Test
    void codecIdsAreStableAcrossFactoryCalls() {
        for (final ColumnType t : ColumnType.values()) {
            assertThat(PlainCodec.forType(t).codecId())
                    .isEqualTo(PlainCodec.forType(t).codecId());
            assertThat(PlainCodec.forType(t).columnType()).isEqualTo(t);
        }
    }
}
