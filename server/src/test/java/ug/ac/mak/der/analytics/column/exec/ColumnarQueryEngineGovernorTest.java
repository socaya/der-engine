package ug.ac.mak.der.analytics.column.exec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

import ug.ac.mak.der.analytics.column.governor.GovernorProperties;
import ug.ac.mak.der.analytics.column.governor.QueryAbortedException;
import ug.ac.mak.der.analytics.column.governor.QueryGovernor;
import ug.ac.mak.der.analytics.column.governor.QueryToken;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarProperties;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarSink;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class ColumnarQueryEngineGovernorTest {

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

    private AnalyticsCell cell(final UUID metric, final String ou) {
        return new AnalyticsCell(metric, 1, "202611", ou, "",
                1L, new BigDecimal(1), new BigDecimal(1),
                null, null, Instant.now(), "VERIFIED");
    }

    private void seedTwoSegments() throws IOException {
        final UUID a = UUID.randomUUID();
        final UUID b = UUID.randomUUID();
        final List<AnalyticsCell> rows = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            rows.add(cell(a, "OU-A"));
            rows.add(cell(b, "OU-B"));
        }
        when(engineRepo.queryCells(any())).thenReturn(rows);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();
    }

    @Test
    void nullTokenBehavesAsBeforeWithoutChecks() throws IOException {
        seedTwoSegments();
        final List<AnalyticsCell> rows = new ColumnarQueryEngine(
                props(), json).query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0),
                null);
        assertThat(rows).hasSize(10);
    }

    @Test
    void cancelDuringScanRaisesAbortedException() throws IOException {
        seedTwoSegments();
        final QueryGovernor g = new QueryGovernor(
                new GovernorProperties(4, 60_000L, 1_000_000_000L));
        final QueryToken token = g.begin("op");
        token.cancel(); // cancel before any segment scan

        assertThatThrownBy(() -> new ColumnarQueryEngine(
                props(), json).query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0),
                token))
                .isInstanceOf(QueryAbortedException.class)
                .hasMessageContaining("cancelled");
        assertThat(token.state())
                .isEqualTo(QueryToken.State.CANCELLED);
    }

    @Test
    void memoryBudgetBelowFirstSegmentAborts() throws IOException {
        seedTwoSegments();
        // Budget below 48 bytes × 5 rows = 240; first accountBytes
        // already crosses the ceiling.
        final QueryGovernor g = new QueryGovernor(
                new GovernorProperties(4, 60_000L, 100L));
        final QueryToken token = g.begin("op");

        assertThatThrownBy(() -> new ColumnarQueryEngine(
                props(), json).query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0),
                token))
                .isInstanceOf(QueryAbortedException.class)
                .hasMessageContaining("memory");
    }

    @Test
    void generousBudgetCompletesCleanly() throws IOException {
        seedTwoSegments();
        final QueryGovernor g = new QueryGovernor(
                new GovernorProperties(4, 60_000L, 1_000_000_000L));
        final QueryToken token = g.begin("op");

        final List<AnalyticsCell> rows = new ColumnarQueryEngine(
                props(), json).query(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0),
                token);

        assertThat(rows).hasSize(10);
        assertThat(token.bytesAccounted()).isPositive();
        g.complete(token);
        assertThat(token.state())
                .isEqualTo(QueryToken.State.COMPLETED);
    }
}
