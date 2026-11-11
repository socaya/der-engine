package ug.ac.mak.der.analytics.column.stats;

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
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.column.exec.ColumnarExplainer;
import ug.ac.mak.der.analytics.column.exec.ColumnarQueryEngine;
import ug.ac.mak.der.analytics.column.manifest.Manifest;
import ug.ac.mak.der.analytics.column.manifest.ManifestReader;
import ug.ac.mak.der.analytics.column.manifest.ManifestStore;
import ug.ac.mak.der.analytics.column.manifest.ManifestWriter;
import ug.ac.mak.der.analytics.column.manifest.SegmentRef;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarSink;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * End-to-end verification that zone-map pruning actually skips
 * segments whose orgUnit band doesn't contain the requested value.
 */
class ZoneMapPruningTest {

    private AnalyticsEngineRepository engineRepo;
    private final ObjectMapper json = new ObjectMapper();

    @TempDir Path tmp;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
    }

    private AnalyticsColumnarProperties props() {
        return new AnalyticsColumnarProperties(true, tmp.toString(),
                100_000);
    }

    private AnalyticsCell cell(final UUID metric, final String period,
                                  final String ou) {
        return new AnalyticsCell(metric, 1, period, ou, "",
                1L, new BigDecimal(1), new BigDecimal(1),
                null, null, Instant.now(), "VERIFIED");
    }

    @Test
    void sidecarIsWrittenAlongsideSegment() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(UUID.randomUUID(), "202611", "OU-A")));

        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // Locate the segment file via the manifest + assert the
        // sidecar landed.
        final ManifestStore store = new ManifestStore(tmp,
                new ManifestReader(json), new ManifestWriter(json));
        final Manifest manifest = store.currentGeneration().orElseThrow();
        final SegmentRef ref = manifest.segments().get(0);
        final Path segFile = tmp.resolve(ref.file());
        final Path statsFile = SegmentStatisticsStore.sidecar(segFile);
        assertThat(Files.exists(statsFile)).isTrue();
    }

    @Test
    void explainMarksPrunedSegmentsForNonMatchingOrgUnit()
            throws IOException {
        // Two metrics so the sink writes two segments — one with
        // only OU-A rows, the other with only OU-B rows.
        final UUID ma = UUID.randomUUID();
        final UUID mb = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            rows.add(cell(ma, "202611", "OU-A"));
            rows.add(cell(mb, "202611", "OU-B"));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-A"),
                        Map.of(), 100, 0));

        // Only the OU-A segment matches; the OU-B one is zone-map-
        // pruned.
        assertThat(plan.segmentsMatched()).isEqualTo(1);
        assertThat(plan.skipped())
                .anyMatch(s -> s.decision().contains("zone map"));
    }

    @Test
    void queryEngineHonoursPruningAndReturnsOracleRows()
            throws IOException {
        final UUID ma = UUID.randomUUID();
        final UUID mb = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            rows.add(cell(ma, "202611", "OU-A"));
            rows.add(cell(mb, "202611", "OU-B"));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final List<AnalyticsCell> result =
                new ColumnarQueryEngine(props(), json).query(
                        new AnalyticsEngineRepository.CellQuery(
                                List.of(), List.of(),
                                List.of("OU-A"), Map.of(), 100, 0));

        // Pruner skips the OU-B segment; result is only OU-A rows,
        // and the count matches the oracle.
        assertThat(result).hasSize(5);
        assertThat(result).allMatch(c -> "OU-A".equals(c.orgUnitUid()));
    }
}
