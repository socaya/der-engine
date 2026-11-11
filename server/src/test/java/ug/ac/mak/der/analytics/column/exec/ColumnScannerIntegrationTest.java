package ug.ac.mak.der.analytics.column.exec;

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

import ug.ac.mak.der.analytics.column.ColumnBatch;
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
 * Oracle-matched integration: sink writes real segments; scanner
 * reads them back and runs vectorised filters. Compare the filtered
 * row count to the row-store cell count under the same predicate.
 */
class ColumnScannerIntegrationTest {

    private AnalyticsEngineRepository engineRepo;
    private final ObjectMapper json = new ObjectMapper();

    @TempDir Path tmp;

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
    }

    private AnalyticsCell cell(final UUID metric, final String ou,
                                  final long count) {
        return new AnalyticsCell(metric, 1, "202611", ou, "",
                count, new BigDecimal(count), new BigDecimal(count),
                null, null, Instant.now(), "VERIFIED");
    }

    @Test
    void scanAndFilterReturnsOracleMatchedRows() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        final String[] ous = { "OU-A", "OU-B", "OU-A", "OU-C",
                "OU-A", "OU-B", "OU-A" };
        for (int i = 0; i < ous.length; i++) {
            rows.add(cell(metric, ous[i], i + 1));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);

        final AnalyticsColumnarProperties props =
                new AnalyticsColumnarProperties(true, tmp.toString(),
                        100_000);
        final AnalyticsColumnarSink sink = new AnalyticsColumnarSink(
                engineRepo, props, json);
        sink.flush();

        // Open the manifest + the first segment it points at.
        final ManifestStore store = new ManifestStore(tmp,
                new ManifestReader(json), new ManifestWriter(json));
        final Manifest manifest = store.currentGeneration().orElseThrow();
        assertThat(manifest.segments()).hasSize(1);
        final SegmentRef ref = manifest.segments().get(0);
        final Path segFile = tmp.resolve(ref.file());
        assertThat(Files.exists(segFile)).isTrue();

        final ColumnScanner.ScannedSegment scanned = ColumnScanner.load(
                segFile, List.of("orgUnit", "count"));
        final SelectionBitmap sel = scanned.applyFilter(
                new Filter.Equals("orgUnit", "OU-A"));

        assertThat(sel.selectedCount()).isEqualTo(4);
        // Row-store oracle agrees: 4 rows have orgUnit = OU-A.
        final long oracleCount = rows.stream()
                .filter(c -> "OU-A".equals(c.orgUnitUid())).count();
        assertThat((long) sel.selectedCount()).isEqualTo(oracleCount);
    }

    @Test
    void scanDecodesCompressedColumnsCorrectly() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 400; i++) {
            rows.add(cell(metric, "OU-" + (i % 3), i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);

        final AnalyticsColumnarProperties props =
                new AnalyticsColumnarProperties(true, tmp.toString(),
                        100_000);
        new AnalyticsColumnarSink(engineRepo, props, json).flush();

        final ManifestStore store = new ManifestStore(tmp,
                new ManifestReader(json), new ManifestWriter(json));
        final SegmentRef ref = store.currentGeneration().orElseThrow()
                .segments().get(0);
        final ColumnScanner.ScannedSegment scanned = ColumnScanner.load(
                tmp.resolve(ref.file()),
                List.of("orgUnit", "count"));

        final ColumnBatch.Str ou =
                (ColumnBatch.Str) scanned.batches().get("orgUnit");
        final ColumnBatch.Int64 count =
                (ColumnBatch.Int64) scanned.batches().get("count");
        assertThat(ou.rowCount()).isEqualTo(400);
        // Row ordering mirrors the ledger — assert a few sample points.
        assertThat(ou.get(0)).isEqualTo("OU-0");
        assertThat(count.get(0)).isZero();
        assertThat(ou.get(399)).isEqualTo("OU-" + (399 % 3));
        assertThat(count.get(399)).isEqualTo(399);
    }
}
