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

class PlanSelectorTest {

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
                                  final String ou,
                                  final Instant freshness) {
        return new AnalyticsCell(metric, 1, period, ou, "",
                1L, new BigDecimal(1), new BigDecimal(1),
                null, null, freshness, "VERIFIED");
    }

    @Test
    void picksRowStoreWithoutManifest() throws IOException {
        when(engineRepo.queryCells(any())).thenReturn(List.of());
        final PlanSelector selector = new PlanSelector(
                props(), engineRepo, json);

        final var d = selector.select(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));

        assertThat(d.selected()).isEqualTo(PlanSelector.Engine.ROW_STORE);
        assertThat(d.rationale()).contains("no manifest");
    }

    @Test
    void picksColumnarWhenCheaper() throws IOException {
        // Columnar has 10 rows across one segment; row-store returns
        // 1000 rows. Columnar should win.
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> smallCells = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            smallCells.add(cell(metric, "202611", "OU-A",
                    Instant.parse("2026-11-01T00:00:00Z")));
        }
        when(engineRepo.queryCells(any())).thenReturn(smallCells);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // After flush, row-store reports 1000 rows for the same query
        // (simulating a hot write burst that hasn't flushed yet).
        final List<AnalyticsCell> largeCells = new ArrayList<>();
        for (int i = 0; i < 1000; i++) {
            largeCells.add(cell(metric, "202611", "OU-A",
                    Instant.parse("2026-11-01T00:00:00Z")));
        }
        when(engineRepo.queryCells(any())).thenReturn(largeCells);

        final var d = new PlanSelector(props(), engineRepo, json).select(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));

        assertThat(d.selected()).isEqualTo(PlanSelector.Engine.COLUMNAR);
        assertThat(d.columnarCost()).isLessThan(d.rowStoreCost());
    }

    @Test
    void picksRowStoreWhenManifestIsStale() throws IOException {
        final UUID metric = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(metric, "202611", "OU-A",
                        Instant.parse("2026-11-01T00:00:00Z"))));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // Row-store now returns a cell whose freshnessAt post-dates
        // the manifest — selector should refuse the columnar path.
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(metric, "202611", "OU-A", Instant.now().plusSeconds(
                        3600))));

        final var d = new PlanSelector(props(), engineRepo, json).select(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(), List.of(), List.of(), Map.of(),
                        100, 0));

        assertThat(d.selected()).isEqualTo(PlanSelector.Engine.ROW_STORE);
        assertThat(d.manifestStale()).isTrue();
        assertThat(d.rationale()).contains("stale");
    }

    @Test
    void picksRowStoreWhenNoSegmentsMatchFilter() throws IOException {
        final UUID a = UUID.randomUUID();
        when(engineRepo.queryCells(any())).thenReturn(List.of(
                cell(a, "202611", "OU-A",
                        Instant.parse("2026-11-01T00:00:00Z"))));
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();

        // Query for a different metric — no segment matches.
        when(engineRepo.queryCells(any())).thenReturn(List.of());
        final var d = new PlanSelector(props(), engineRepo, json).select(
                new AnalyticsEngineRepository.CellQuery(
                        List.of(UUID.randomUUID()),
                        List.of(), List.of(), Map.of(),
                        100, 0));

        assertThat(d.selected()).isEqualTo(PlanSelector.Engine.ROW_STORE);
        assertThat(d.rationale()).contains("no columnar segments match");
    }

    @Test
    void pickHelperHandlesTieToColumnar() {
        assertThat(PlanSelector.pick(100.0, 100.0))
                .isEqualTo(PlanSelector.Engine.COLUMNAR);
        assertThat(PlanSelector.pick(200.0, 100.0))
                .isEqualTo(PlanSelector.Engine.ROW_STORE);
        assertThat(PlanSelector.pick(50.0, 100.0))
                .isEqualTo(PlanSelector.Engine.COLUMNAR);
    }

    @Test
    void feedbackLowersColumnarCostWhenHistoricalSelectivityIsLow()
            throws IOException {
        // Seed one segment so columnar is a candidate.
        final UUID metric = UUID.randomUUID();
        final List<AnalyticsCell> smallCells = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            smallCells.add(cell(metric, "202611", "OU-A",
                    Instant.parse("2026-11-01T00:00:00Z")));
        }
        when(engineRepo.queryCells(any())).thenReturn(smallCells);
        new AnalyticsColumnarSink(engineRepo, props(), json).flush();
        when(engineRepo.queryCells(any())).thenReturn(smallCells);

        final var cq = new AnalyticsEngineRepository.CellQuery(
                List.of(), List.of(), List.of(), java.util.Map.of(),
                100, 0);

        // Baseline — no feedback wired.
        final var baselineSelector = new PlanSelector(props(),
                engineRepo, json);
        final var baseline = baselineSelector.select(cq);

        // With-feedback — record that this shape returns only 10 %
        // of the estimated rows.
        final var feedbackSelector = new PlanSelector(props(),
                engineRepo, json);
        final var feedback = new ug.ac.mak.der.analytics.column.feedback
                .PlanFeedbackStore(
                new ug.ac.mak.der.analytics.column.feedback
                        .PlanFeedbackProperties(10));
        feedback.record(new ug.ac.mak.der.analytics.column.feedback
                .PlanFeedback(Instant.now(), "columnar",
                ug.ac.mak.der.analytics.column.feedback
                        .PlanFeedbackStore.shapeKeyFor(cq),
                1000L, 100L, 1000.0, 50L));
        feedbackSelector.setFeedbackStore(feedback);
        final var adjusted = feedbackSelector.select(cq);

        // Feedback scales selectivity down (ratio 0.1), so columnar
        // cost shrinks — strictly smaller than baseline for the
        // same query.
        assertThat(adjusted.columnarCost())
                .isLessThan(baseline.columnarCost());
    }
}
