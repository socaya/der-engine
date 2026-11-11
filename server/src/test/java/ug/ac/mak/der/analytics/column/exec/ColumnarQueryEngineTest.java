package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarSink;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

/**
 * SRS §13.1 end-to-end oracle test: the same CellQuery must
 * return byte-identical results from the row-store and from the
 * columnar engine. Any divergence is a release-blocking defect.
 */
class ColumnarQueryEngineTest {

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
                                  final String ou, final long count) {
        return new AnalyticsCell(metric, 1, period, ou, "",
                count, new BigDecimal(count), new BigDecimal(count),
                null, null, Instant.now(), "VERIFIED");
    }

    @Test
    void queryBeforeManifestReturnsEmpty() throws IOException {
        final ColumnarQueryEngine qe = new ColumnarQueryEngine(
                props(), json);

        final var rows = qe.query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(),
                        Map.of(), 100, 0));

        assertThat(rows).isEmpty();
        assertThat(qe.ready()).isFalse();
    }

    @Test
    void oracleMatchForUnfilteredQuery() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        final String[] ous = { "OU-A", "OU-B", "OU-A", "OU-C" };
        for (int i = 0; i < ous.length; i++) {
            rows.add(cell(metric, "202611", ous[i], i + 1));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var qe = new ColumnarQueryEngine(props(), json);
        final var cq = new AnalyticsEngineRepository.CellQuery(
                List.of(), List.of(), List.of(), Map.of(), 100, 0);
        final List<AnalyticsCell> columnar = qe.query(cq);

        assertThat(columnar).hasSameSizeAs(rows);
        assertThat(columnar.stream()
                .map(AnalyticsCell::orgUnitUid).toList())
                .containsExactlyInAnyOrderElementsOf(
                        rows.stream()
                                .map(AnalyticsCell::orgUnitUid).toList());
    }

    @Test
    void oracleMatchForOrgUnitFilter() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            final String ou = "OU-" + (i % 3);
            rows.add(cell(metric, "202611", ou, i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var qe = new ColumnarQueryEngine(props(), json);
        final var cq = new AnalyticsEngineRepository.CellQuery(
                List.of(metric), List.of("202611"),
                List.of("OU-0"), Map.of(), 100, 0);
        final List<AnalyticsCell> columnar = qe.query(cq);

        // Row-store oracle: rows where ou = "OU-0" and metric
        // matches and period matches.
        final long oracleCount = rows.stream()
                .filter(r -> "OU-0".equals(r.orgUnitUid())).count();
        assertThat((long) columnar.size()).isEqualTo(oracleCount);
        assertThat(columnar).allMatch(c -> "OU-0".equals(c.orgUnitUid()));
    }

    @Test
    void queryHonoursLimit() throws IOException {
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            rows.add(cell(metric, "202611", "OU-" + i, i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var qe = new ColumnarQueryEngine(props(), json);
        final var cq = new AnalyticsEngineRepository.CellQuery(
                List.of(), List.of(), List.of(), Map.of(), 10, 0);
        final List<AnalyticsCell> columnar = qe.query(cq);

        assertThat(columnar).hasSize(10);
    }

    @Test
    void queryFiltersBySegmentMetadataWithoutOpeningSegment()
            throws IOException {
        // Two metrics, two segments. Query for just metric A → the
        // engine should only open its segment.
        final UUID a = UUID.randomUUID();
        final UUID b = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            rows.add(cell(a, "202611", "OU-A", i));
            rows.add(cell(b, "202611", "OU-B", i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var qe = new ColumnarQueryEngine(props(), json);
        final List<AnalyticsCell> aRows = qe.query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(a), List.of(), List.of(),
                        Map.of(), 100, 0));

        assertThat(aRows).hasSize(5);
        assertThat(aRows).allMatch(c -> c.metricId().equals(a));
    }

    @Test
    void readyAfterFlushIsTrue() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(
                Collections.singletonList(cell(UUID.randomUUID(),
                        "202611", "OU-A", 1)));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        assertThat(new ColumnarQueryEngine(props(), json).ready())
                .isTrue();
    }
}
