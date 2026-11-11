package ug.ac.mak.der.analytics.column.sink;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class AnalyticsColumnarSinkTest {

    private AnalyticsEngineRepository engineRepo;
    private final ObjectMapper json = new ObjectMapper();

    @TempDir Path tmp;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
    }

    private AnalyticsColumnarSink sink(final boolean enabled) {
        final AnalyticsColumnarProperties props =
                new AnalyticsColumnarProperties(enabled,
                        tmp.toString(), 100_000);
        return new AnalyticsColumnarSink(engineRepo, props, json);
    }

    private AnalyticsCell cell(final UUID metric, final String period,
                                  final String ou, final long count) {
        return new AnalyticsCell(metric, 1, period, ou, "",
                count, new BigDecimal(count), new BigDecimal(count),
                null, null, Instant.now(), "VERIFIED");
    }

    @Test
    void disabledSinkReturnsEarlyWithoutTouchingDisk() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final var r = sink(false).flush();

        assertThat(r.generation()).isEqualTo(-1L);
        assertThat(r.manifestPath()).isEqualTo("disabled");
        assertThat(Files.list(tmp).count()).isZero();
    }

    @Test
    void emptyCellsStillPublishesManifest() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final var r = sink(true).flush();

        assertThat(r.generation()).isEqualTo(1L);
        assertThat(r.segmentsWritten()).isZero();
        assertThat(r.rowsWritten()).isZero();
        assertThat(Files.exists(tmp.resolve("manifests/000000001.json")))
                .isTrue();
    }

    @Test
    void segmentsGroupedByMetricAndPeriod() throws IOException {
        final UUID m1 = UUID.randomUUID();
        final UUID m2 = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        rows.add(cell(m1, "202611", "OU-A", 5));
        rows.add(cell(m1, "202611", "OU-B", 7));
        rows.add(cell(m1, "202612", "OU-A", 3));
        rows.add(cell(m2, "202611", "OU-A", 9));
        when(engineRepo.queryCells(any())).thenReturn(rows);

        final var r = sink(true).flush();

        // 3 groups: (m1,202611), (m1,202612), (m2,202611)
        assertThat(r.segmentsWritten()).isEqualTo(3);
        assertThat(r.rowsWritten()).isEqualTo(4);
        assertThat(r.generation()).isEqualTo(1L);

        final var manifest = sink(true).currentManifest()
                .orElseThrow();
        assertThat(manifest.generation()).isEqualTo(1L);
        assertThat(manifest.segments()).hasSize(3);
    }

    @Test
    void secondFlushBumpsGeneration() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final AnalyticsColumnarSink s = sink(true);
        assertThat(s.flush().generation()).isEqualTo(1L);
        assertThat(s.flush().generation()).isEqualTo(2L);
        assertThat(s.flush().generation()).isEqualTo(3L);
    }

    @Test
    void compressionRatioRecordedForRepetitiveData() throws IOException {
        // 500 rows of three repeated org units — dict + Zstd should
        // shrink this well under the plain baseline.
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        final String[] ous = { "OU-A", "OU-B", "OU-C" };
        for (int i = 0; i < 500; i++) {
            rows.add(cell(metric, "202611", ous[i % 3], i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);

        final var r = sink(true).flush();

        assertThat(r.rowsWritten()).isEqualTo(500);
        assertThat(r.compressionRatio())
                .withFailMessage("compression ratio was %f", r.compressionRatio())
                .isLessThan(1.0);
    }

    @Test
    void manifestFileIsValidAtomicJson() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(UUID.randomUUID(), "202611", "OU-A", 1)));

        sink(true).flush();

        final Path f = tmp.resolve("manifests/000000001.json");
        assertThat(Files.exists(f)).isTrue();
        assertThat(Files.size(f)).isGreaterThan(0);
        // No temp leftovers
        final long leftovers = Files.list(tmp.resolve("manifests"))
                .filter(p -> p.getFileName().toString().startsWith("."))
                .count();
        assertThat(leftovers).isZero();
    }
}
