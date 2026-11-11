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

class ColumnarExplainerTest {

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
    void explainBeforeManifestReturnsUnavailable() throws IOException {
        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));
        assertThat(plan.generation()).isEqualTo(-1L);
        assertThat(plan.segmentsMatched()).isZero();
        assertThat(plan.engine()).contains("unavailable");
    }

    @Test
    void explainAfterFlushReportsMatchedSegments() throws IOException {
        final UUID a = UUID.randomUUID();
        final UUID b = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            rows.add(cell(a, "202611", "OU-A"));
            rows.add(cell(b, "202611", "OU-B"));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(a), List.of(), List.of(), Map.of(),
                        100, 0));

        // Metric A matches, metric B skipped.
        assertThat(plan.generation()).isEqualTo(1L);
        assertThat(plan.segmentsMatched()).isEqualTo(1);
        assertThat(plan.segmentsSkipped()).isEqualTo(1);
        assertThat(plan.skipped().get(0).decision())
                .contains("metricId not in request");
        assertThat(plan.engine()).isEqualTo("columnar");
    }

    @Test
    void explainCarriesFilterDescription() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(UUID.randomUUID(), "202611", "OU-A")));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(),
                        List.of("OU-A", "OU-B"), Map.of(), 100, 0));

        assertThat(plan.filterDescription()).contains("OU-A");
        assertThat(plan.filterDescription()).contains("orgUnit IN");
    }

    @Test
    void explainCapsEstimatedRowsByLimit() throws IOException {
        final UUID m = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            rows.add(cell(m, "202611", "OU-" + i));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        5, 0));

        // 50 rows available, limit 5 → estimate capped at 5.
        assertThat(plan.estimatedRows()).isEqualTo(5);
        assertThat(plan.rowLimit()).isEqualTo(5);
    }

    @Test
    void projectedColumnsIsStable() throws IOException {
        final var plan = new ColumnarExplainer(props(), json).explain(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));

        assertThat(plan.projectedColumns())
                .containsExactly("orgUnit", "dimensionKey", "count",
                        "sum", "value", "numerator", "denominator",
                        "freshnessAt", "qualityState");
    }
}
