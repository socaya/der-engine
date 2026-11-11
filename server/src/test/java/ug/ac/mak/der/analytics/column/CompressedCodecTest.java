package ug.ac.mak.der.analytics.column;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CompressedCodecTest {

    @Test
    void dictionaryStringRoundTripsLowCardinality() {
        // 1 000 rows, 5 distinct org units — a realistic shape where
        // dictionary + bit-pack should beat plain by a wide margin.
        final String[] ous = {
            "OU-ALPHA", "OU-BRAVO", "OU-CHARLIE", "OU-DELTA", "OU-ECHO",
        };
        final ColumnBatch.Str batch = new ColumnBatch.Str(1000);
        for (int i = 0; i < 1000; i++) {
            batch.set(i, i % 7 == 0 ? null : ous[i % ous.length]);
        }
        batch.seal();

        final Codec dict = new DictionaryStringCodec();
        final byte[] encoded = dict.encode(batch);
        final ColumnBatch.Str round = (ColumnBatch.Str)
                dict.decode(encoded, 1000);
        for (int i = 0; i < 1000; i++) {
            if (i % 7 == 0) {
                assertThat(round.nulls().isNull(i)).isTrue();
            } else {
                assertThat(round.get(i)).isEqualTo(ous[i % ous.length]);
            }
        }
    }

    @Test
    void dictionaryStringBeatsPlainOnLowCardinality() {
        final String[] ous = {
            "OU-ALPHA", "OU-BRAVO", "OU-CHARLIE", "OU-DELTA", "OU-ECHO",
        };
        final ColumnBatch.Str batch = new ColumnBatch.Str(1000);
        for (int i = 0; i < 1000; i++) {
            batch.set(i, ous[i % ous.length]);
        }
        batch.seal();

        final byte[] plain = PlainCodec.forType(ColumnType.STRING)
                .encode(batch);
        final byte[] dict = new DictionaryStringCodec().encode(batch);

        assertThat(dict.length)
                .withFailMessage("expected dict (%d) < plain (%d)",
                        dict.length, plain.length)
                .isLessThan(plain.length);
        // Expect at least 5× compression on this shape.
        assertThat((double) dict.length / plain.length)
                .isLessThan(0.3);
    }

    @Test
    void bitPackedInt64RoundTripsClusteredValues() {
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(500);
        for (int i = 0; i < 500; i++) {
            batch.set(i, 2026_01L + (i % 12));
        }
        batch.setNull(4);
        batch.setNull(42);
        batch.seal();

        final Codec bp = new BitPackedInt64Codec();
        final byte[] encoded = bp.encode(batch);
        final ColumnBatch.Int64 round = (ColumnBatch.Int64)
                bp.decode(encoded, 500);

        for (int i = 0; i < 500; i++) {
            if (i == 4 || i == 42) {
                assertThat(round.nulls().isNull(i)).isTrue();
            } else {
                assertThat(round.get(i)).isEqualTo(2026_01L + (i % 12));
            }
        }
    }

    @Test
    void bitPackedInt64BeatsPlainWhenRangeIsSmall() {
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(1000);
        for (int i = 0; i < 1000; i++) {
            batch.set(i, 100L + (i % 16));
        }
        batch.seal();

        final byte[] plain = PlainCodec.forType(ColumnType.INT64)
                .encode(batch);
        final byte[] bp = new BitPackedInt64Codec().encode(batch);

        assertThat(bp.length).isLessThan(plain.length);
    }

    @Test
    void bitPackedInt64HandlesLargeRangeCorrectly() {
        // Values with full 64-bit span — the overflow branch must
        // still round-trip exactly.
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(4);
        batch.set(0, Long.MIN_VALUE);
        batch.set(1, Long.MAX_VALUE);
        batch.set(2, 0L);
        batch.set(3, -1L);
        batch.seal();

        final Codec bp = new BitPackedInt64Codec();
        final ColumnBatch.Int64 round = (ColumnBatch.Int64)
                bp.decode(bp.encode(batch), 4);

        assertThat(round.get(0)).isEqualTo(Long.MIN_VALUE);
        assertThat(round.get(1)).isEqualTo(Long.MAX_VALUE);
        assertThat(round.get(2)).isZero();
        assertThat(round.get(3)).isEqualTo(-1L);
    }

    @Test
    void selectorBeatsPlainOnLowCardinalityString() {
        final ColumnBatch.Str batch = new ColumnBatch.Str(100);
        for (int i = 0; i < 100; i++) {
            batch.set(i, i % 2 == 0 ? "A" : "B");
        }
        batch.seal();

        final CodecSelector.Choice choice =
                CodecSelector.defaultSelector().select(batch);

        // Any compressed codec is acceptable — dictionary, Zstd+dict,
        // Zstd+plain, LZ4-wrapped variants all qualify. Contract is
        // "measurably smaller than uncompressed", not a specific id.
        assertThat(choice.codec().codecId()).isNotEqualTo("plain-str");
        assertThat(choice.ratio()).isLessThan(0.5);
    }

    @Test
    void selectorBeatsPlainOnClusteredIntegers() {
        final ColumnBatch.Int64 batch = new ColumnBatch.Int64(200);
        for (int i = 0; i < 200; i++) {
            batch.set(i, 10L + (i % 8));
        }
        batch.seal();

        final CodecSelector.Choice choice =
                CodecSelector.defaultSelector().select(batch);

        assertThat(choice.codec().codecId()).isNotEqualTo("plain-i64");
        assertThat(choice.ratio()).isLessThan(1.0);
    }

    @Test
    void selectorHoldsRatioAtOrUnderOneEvenOnMostlyUniqueStrings() {
        // 50 all-distinct short strings. With Zstd in the mix, the
        // compressed-wrapper framing overhead can still land under
        // plain's size. The guarantee we care about is that the
        // selector never emits a larger encoding than the plain
        // codec baseline.
        final ColumnBatch.Str batch = new ColumnBatch.Str(50);
        for (int i = 0; i < 50; i++) {
            batch.set(i, "value-" + Integer.toHexString(i)
                    + "-random-" + (i * 7919));
        }
        batch.seal();

        final CodecSelector.Choice choice =
                CodecSelector.defaultSelector().select(batch);

        assertThat(choice.ratio()).isLessThanOrEqualTo(1.0);
    }

    @Test
    void selectorWinnerRoundTripsThroughItsCodec() {
        final ColumnBatch.Str batch = new ColumnBatch.Str(20);
        for (int i = 0; i < 20; i++) {
            batch.set(i, i % 3 == 0 ? "cat" : "dog");
        }
        batch.seal();

        final CodecSelector.Choice choice =
                CodecSelector.defaultSelector().select(batch);
        final ColumnBatch.Str round = (ColumnBatch.Str) choice.codec()
                .decode(choice.encoded(), 20);

        for (int i = 0; i < 20; i++) {
            assertThat(round.get(i))
                    .isEqualTo(i % 3 == 0 ? "cat" : "dog");
        }
    }
}
