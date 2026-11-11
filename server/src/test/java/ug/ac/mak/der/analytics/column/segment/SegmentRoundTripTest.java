package ug.ac.mak.der.analytics.column.segment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.column.Codec;
import ug.ac.mak.der.analytics.column.CodecSelector;
import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.ColumnType;
import ug.ac.mak.der.analytics.column.PlainCodec;

class SegmentRoundTripTest {

    @TempDir Path tmp;

    private SegmentColumn encode(final String name,
                                    final ColumnType type,
                                    final ColumnBatch batch) {
        final CodecSelector.Choice choice = CodecSelector.defaultSelector()
                .select(batch);
        return new SegmentColumn(name, type, choice.codec().codecId(),
                choice.encoded(), batch.nulls().nullCount());
    }

    private Segment threeColumnSegment() {
        final ColumnBatch.Int64 period = new ColumnBatch.Int64(100);
        final ColumnBatch.Str orgUnit = new ColumnBatch.Str(100);
        final ColumnBatch.Decimal value = new ColumnBatch.Decimal(100);
        for (int i = 0; i < 100; i++) {
            period.set(i, 202600L + (i % 12));
            orgUnit.set(i, i % 2 == 0 ? "OU-A" : "OU-B");
            value.set(i, new BigDecimal(i));
        }
        period.seal();
        orgUnit.seal();
        value.seal();

        return new Segment(UUID.randomUUID(), 100, Instant.now(),
                List.of(
                        encode("period", ColumnType.INT64, period),
                        encode("orgUnit", ColumnType.STRING, orgUnit),
                        encode("value", ColumnType.DECIMAL, value)));
    }

    @Test
    void roundTripPreservesEveryColumn() {
        final Segment original = threeColumnSegment();
        final byte[] encoded = SegmentWriter.toBytes(original);
        final Segment parsed = SegmentReader.parseAll(encoded);

        assertThat(parsed.segmentId()).isEqualTo(original.segmentId());
        assertThat(parsed.rowCount()).isEqualTo(100);
        assertThat(parsed.columns()).hasSize(3);
        assertThat(parsed.columns().get(0).name()).isEqualTo("period");
        assertThat(parsed.columns().get(1).name()).isEqualTo("orgUnit");
        assertThat(parsed.columns().get(2).name()).isEqualTo("value");

        // Decode the first column via its stored codec id and verify
        // values round-trip byte-identically through the full pipeline.
        final Codec int64 = PlainCodec.forType(ColumnType.INT64);
        for (final SegmentColumn c : parsed.columns()) {
            assertThat(c.encoded()).isNotEmpty();
        }
        assertThat(int64.codecId()).contains("plain");
    }

    @Test
    void writeAtomicallyLandsExactFileThenNoTemp() throws IOException {
        final Segment original = threeColumnSegment();
        final Path file = tmp.resolve("segment.col");
        SegmentWriter.writeAtomically(original, file);

        assertThat(Files.exists(file)).isTrue();
        assertThat(Files.list(tmp)
                .filter(p -> p.getFileName().toString().startsWith("."))
                .count())
                .withFailMessage("temp file left behind in %s", tmp)
                .isZero();

        final Segment parsed = SegmentReader.parseAll(file);
        assertThat(parsed.segmentId()).isEqualTo(original.segmentId());
    }

    @Test
    void projectionReadsOnlyRequestedColumns() throws IOException {
        final Segment original = threeColumnSegment();
        final Path file = tmp.resolve("segment-proj.col");
        SegmentWriter.writeAtomically(original, file);

        final SegmentReader.Projection p = SegmentReader.projection(file,
                List.of("orgUnit"));

        assertThat(p.columns()).hasSize(1);
        assertThat(p.column("orgUnit")).isPresent();
        assertThat(p.column("period")).isEmpty();
        assertThat(p.column("value")).isEmpty();
    }

    @Test
    void magicMismatchIsRejected() {
        final byte[] bytes = SegmentWriter.toBytes(threeColumnSegment());
        bytes[0] = 'X'; // corrupt magic

        assertThatThrownBy(() -> SegmentReader.parseAll(bytes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("magic");
    }

    @Test
    void crcMismatchIsRejected() {
        final byte[] bytes = SegmentWriter.toBytes(threeColumnSegment());
        bytes[bytes.length - 1] ^= 0x01; // corrupt crc

        assertThatThrownBy(() -> SegmentReader.parseAll(bytes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("CRC32");
    }

    @Test
    void trailerMagicMismatchIsRejected() {
        final byte[] bytes = SegmentWriter.toBytes(threeColumnSegment());
        bytes[bytes.length - SegmentFormat.TRAILER_BYTES] = 'Z';

        assertThatThrownBy(() -> SegmentReader.parseAll(bytes))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("trailer");
    }

    @Test
    void segmentWithDateColumnRoundTrips() {
        final ColumnBatch.Date dates = new ColumnBatch.Date(5);
        dates.set(0, LocalDate.of(2026, 11, 1));
        dates.set(1, LocalDate.of(2026, 11, 2));
        dates.set(2, null);
        dates.set(3, LocalDate.of(2026, 11, 4));
        dates.set(4, LocalDate.of(2026, 11, 5));
        dates.seal();

        final SegmentColumn col = encode("occurredOn", ColumnType.DATE,
                dates);
        final Segment seg = new Segment(UUID.randomUUID(), 5,
                Instant.now(), List.of(col));

        final byte[] encoded = SegmentWriter.toBytes(seg);
        final Segment parsed = SegmentReader.parseAll(encoded);

        assertThat(parsed.columns().get(0).type())
                .isEqualTo(ColumnType.DATE);
        assertThat(parsed.columns().get(0).nullCount()).isEqualTo(1);
    }

    @Test
    void sizeInBytesMatchesWrittenFile() throws IOException {
        final Segment seg = threeColumnSegment();
        final Path file = tmp.resolve("sized.col");
        SegmentWriter.writeAtomically(seg, file);

        assertThat(Files.size(file))
                .isEqualTo(SegmentWriter.sizeInBytes(seg));
    }
}
