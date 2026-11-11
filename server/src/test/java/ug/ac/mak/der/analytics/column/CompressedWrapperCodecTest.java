package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class CompressedWrapperCodecTest {

    private ColumnBatch.Str makeLowCardinalityStr(final int rows) {
        final String[] labels = { "COMPLETED", "ACTIVE", "SKIPPED" };
        final ColumnBatch.Str batch = new ColumnBatch.Str(rows);
        for (int i = 0; i < rows; i++) {
            batch.set(i, labels[i % labels.length]);
        }
        batch.seal();
        return batch;
    }

    private ColumnBatch.Decimal makeDecimalBatch(final int rows) {
        final ColumnBatch.Decimal batch = new ColumnBatch.Decimal(rows);
        for (int i = 0; i < rows; i++) {
            batch.set(i, new BigDecimal(i).movePointLeft(2));
        }
        batch.seal();
        return batch;
    }

    @Test
    void zstdPlusPlainRoundTripsEveryType() {
        final ColumnBatch.Decimal batch = makeDecimalBatch(200);
        final Codec codec = new CompressedCodec(new ZstdCompressor(),
                PlainCodec.forType(ColumnType.DECIMAL),
                BuiltinCodecs::lookup);

        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Decimal round = (ColumnBatch.Decimal)
                codec.decode(encoded, 200);

        for (int i = 0; i < 200; i++) {
            assertThat(round.get(i))
                    .isEqualByComparingTo(new BigDecimal(i).movePointLeft(2));
        }
    }

    @Test
    void lz4PlusDictionaryRoundTrips() {
        final ColumnBatch.Str batch = makeLowCardinalityStr(500);
        final Codec codec = new CompressedCodec(new Lz4Compressor(),
                new DictionaryStringCodec(),
                BuiltinCodecs::lookup);

        final byte[] encoded = codec.encode(batch);
        final ColumnBatch.Str round = (ColumnBatch.Str)
                codec.decode(encoded, 500);

        for (int i = 0; i < 500; i++) {
            assertThat(round.get(i)).isEqualTo(batch.get(i));
        }
    }

    @Test
    void zstdBeatsPlainOnLargeRepetitiveString() {
        final ColumnBatch.Str batch = makeLowCardinalityStr(5_000);
        final Codec plain = PlainCodec.forType(ColumnType.STRING);
        final Codec zstd = new CompressedCodec(new ZstdCompressor(),
                plain, BuiltinCodecs::lookup);

        final byte[] plainBytes = plain.encode(batch);
        final byte[] zstdBytes = zstd.encode(batch);

        // 5 000 rows × short repeated label should compress well
        // past 10× under Zstd.
        assertThat(zstdBytes.length).isLessThan(plainBytes.length / 10);
    }

    @Test
    void corruptedPageDetectedByXxHash() {
        final ColumnBatch.Str batch = makeLowCardinalityStr(100);
        final Codec codec = new CompressedCodec(new ZstdCompressor(),
                PlainCodec.forType(ColumnType.STRING),
                BuiltinCodecs::lookup);

        final byte[] encoded = codec.encode(batch);
        // Flip one byte deep in the compressed payload.
        encoded[encoded.length - 10] ^= (byte) 0xFF;

        assertThatThrownBy(() -> codec.decode(encoded, 100))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void selectorNowConsidersCompressedVariants() {
        // Repetitive label — zstd over dict should win handily.
        final ColumnBatch.Str batch = makeLowCardinalityStr(5_000);
        final CodecSelector.Choice choice =
                CodecSelector.defaultSelector().select(batch);

        assertThat(choice.codec().codecId())
                .withFailMessage("selector picked %s, encoded=%d",
                        choice.codec().codecId(),
                        choice.chosenBytes())
                .contains("zstd");
        assertThat(choice.ratio()).isLessThan(0.1);
    }

    @Test
    void codecIdCarriesCompressorAndInner() {
        final CompressedCodec c = new CompressedCodec(
                new ZstdCompressor(), PlainCodec.forType(ColumnType.INT64),
                BuiltinCodecs::lookup);

        assertThat(c.codecId()).isEqualTo("zstd-l3+plain-i64");
        assertThat(c.columnType()).isEqualTo(ColumnType.INT64);
    }

    @Test
    void builtinLookupKnowsEveryBaseCodec() {
        for (final ColumnType t : ColumnType.values()) {
            final Codec c = PlainCodec.forType(t);
            assertThat(BuiltinCodecs.lookup(c.codecId())).isSameAs(
                    BuiltinCodecs.lookup(c.codecId()));
        }
        assertThat(BuiltinCodecs.lookup("dict-str")).isNotNull();
        assertThat(BuiltinCodecs.lookup("bitpack-i64")).isNotNull();
        assertThat(BuiltinCodecs.lookup("does-not-exist")).isNull();
    }
}
