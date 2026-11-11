package ug.ac.mak.der.analytics.column.stats;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.column.ColumnBatch;
import ug.ac.mak.der.analytics.column.ColumnType;

class SegmentStatisticsTest {

    @TempDir Path tmp;

    private ColumnBatch.Str orgUnits() {
        final ColumnBatch.Str b = new ColumnBatch.Str(6);
        b.set(0, "OU-A");
        b.set(1, "OU-B");
        b.set(2, "OU-A");
        b.set(3, null);
        b.set(4, "OU-C");
        b.set(5, "OU-B");
        b.seal();
        return b;
    }

    @Test
    void columnStatisticsCaptureMinMaxAndNulls() {
        final SegmentStatistics stats = SegmentStatisticsBuilder.compute(
                UUID.randomUUID(), 6,
                Map.of("ou", orgUnits()));

        final ColumnStatistics ou = stats.column("ou");
        assertThat(ou).isNotNull();
        assertThat(ou.type()).isEqualTo(ColumnType.STRING);
        assertThat(ou.rowCount()).isEqualTo(6);
        assertThat(ou.nullCount()).isEqualTo(1);
        assertThat(ou.minValue()).isEqualTo("OU-A");
        assertThat(ou.maxValue()).isEqualTo("OU-C");
        assertThat(ou.distinctEstimate()).isEqualTo(3);
        assertThat(ou.distinctSampleExhaustive()).isTrue();
        assertThat(ou.distinctSample())
                .containsExactly("OU-A", "OU-B", "OU-C");
    }

    @Test
    void int64StatsTrackMinMaxAsLong() {
        final ColumnBatch.Int64 b = new ColumnBatch.Int64(4);
        b.set(0, 10L);
        b.set(1, -5L);
        b.set(2, 100L);
        b.setNull(3);
        b.seal();

        final SegmentStatistics stats = SegmentStatisticsBuilder.compute(
                UUID.randomUUID(), 4, Map.of("count", b));
        final ColumnStatistics c = stats.column("count");
        assertThat(c.minValue()).isEqualTo(-5L);
        assertThat(c.maxValue()).isEqualTo(100L);
        assertThat(c.nullCount()).isEqualTo(1);
    }

    @Test
    void decimalStatsTrackMinMaxAsBigDecimal() {
        final ColumnBatch.Decimal b = new ColumnBatch.Decimal(3);
        b.set(0, new BigDecimal("1.25"));
        b.set(1, new BigDecimal("10.50"));
        b.set(2, new BigDecimal("3.75"));
        b.seal();
        final SegmentStatistics stats = SegmentStatisticsBuilder.compute(
                UUID.randomUUID(), 3, Map.of("value", b));

        final ColumnStatistics c = stats.column("value");
        assertThat(c.minValue()).isEqualTo(new BigDecimal("1.25"));
        assertThat(c.maxValue()).isEqualTo(new BigDecimal("10.50"));
    }

    @Test
    void distinctSampleTruncatesAtCap() {
        final ColumnBatch.Str b = new ColumnBatch.Str(100);
        for (int i = 0; i < 100; i++) {
            b.set(i, "v-" + i); // 100 unique values
        }
        b.seal();
        final SegmentStatistics stats = SegmentStatisticsBuilder.compute(
                UUID.randomUUID(), 100, Map.of("c", b));

        final ColumnStatistics c = stats.column("c");
        assertThat(c.distinctSampleExhaustive()).isFalse();
        assertThat(c.distinctSample())
                .hasSize(ColumnStatistics.DISTINCT_SAMPLE_CAP);
    }

    @Test
    void storeRoundTripsSidecarFile() throws IOException {
        final ObjectMapper json = new ObjectMapper();
        final SegmentStatistics original = SegmentStatisticsBuilder
                .compute(UUID.randomUUID(), 6,
                        Map.of("ou", orgUnits()));
        final Path segFile = tmp.resolve("segment-x.col");
        Files.createFile(segFile);

        new SegmentStatisticsStore(json).writeAtomically(
                original, segFile);
        final SegmentStatistics round = new SegmentStatisticsStore(json)
                .read(segFile).orElseThrow();

        assertThat(round.segmentId()).isEqualTo(original.segmentId());
        assertThat(round.rowCount()).isEqualTo(6);
        assertThat(round.column("ou").minValue()).isEqualTo("OU-A");
        assertThat(round.column("ou").distinctSample())
                .containsExactly("OU-A", "OU-B", "OU-C");
    }

    @Test
    void readMissingSidecarReturnsEmpty() throws IOException {
        final ObjectMapper json = new ObjectMapper();
        final Path segFile = tmp.resolve("missing.col");
        assertThat(new SegmentStatisticsStore(json).read(segFile))
                .isEmpty();
    }
}
