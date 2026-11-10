package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AnalyticsMaterializerTest {

    private AnalyticsEngineRepository cells;
    private AnalyticsContributionRepository contributions;
    private AnalyticsMaterializer materializer;

    private final UUID metricId = UUID.randomUUID();
    private final AnalyticsDefinition def = new AnalyticsDefinition(
            metricId, null, "DER_EVENT_COUNT", "Event count", 1,
            "h", "EVENT", "COUNT", null, List.of(),
            "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
            null, null, null);

    @BeforeEach
    void setUp() {
        cells = mock(AnalyticsEngineRepository.class);
        contributions = mock(AnalyticsContributionRepository.class);
        materializer = new AnalyticsMaterializer(cells, contributions);
    }

    @Test
    void materializeCellWithCountAggType() {
        when(contributions.aggregateForCell(eq(metricId), eq(1),
                eq("202611"), eq("OU-A"), eq("")))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(5L, new BigDecimal("5")));
        final BigDecimal v = materializer.materializeCell(def,
                "202611", "OU-A", "");
        assertThat(v).isEqualByComparingTo("5");
        verify(cells).upsertCell(any(AnalyticsCell.class));
    }

    @Test
    void materializeCellWithSumAggType() {
        final AnalyticsDefinition sumDef = new AnalyticsDefinition(
                metricId, null, "TOTAL", "Total", 1,
                "h", "EVENT", "SUM", null, List.of(),
                "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                null, null, null);
        when(contributions.aggregateForCell(eq(metricId), eq(1),
                eq("202611"), eq("OU-A"), eq("")))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(3L, new BigDecimal("42")));
        final BigDecimal v = materializer.materializeCell(sumDef,
                "202611", "OU-A", "");
        assertThat(v).isEqualByComparingTo("42");
    }

    @Test
    void emptyAggregateDeletesTheCell() {
        when(contributions.aggregateForCell(any(), anyInt(),
                anyString(), anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(0L, BigDecimal.ZERO));
        final BigDecimal v = materializer.materializeCell(def,
                "202611", "OU-A", "");
        assertThat(v).isNull();
        verify(cells).deleteCell(metricId, 1, "202611", "OU-A", "");
    }

    @Test
    void applyContributionTouchesPriorAndNewCells() {
        // Prior: one cell at 202610. New: 202611. Both get materialised.
        when(contributions.cellsForSource(eq(metricId), eq(1), eq("ev-1")))
                .thenReturn(List.of(
                        new AnalyticsContributionRepository
                                .CellRef("202610", "OU-A", "")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(1L, BigDecimal.ONE));

        final AnalyticsContribution next = AnalyticsContribution.countOne(
                metricId, 1, "ev-1", "v2", "202611", "OU-A");
        materializer.applyContribution(def, next);

        verify(contributions).upsert(next);
        // Both periods' cells should have been materialised.
        verify(contributions).aggregateForCell(metricId, 1, "202610", "OU-A", "");
        verify(contributions).aggregateForCell(metricId, 1, "202611", "OU-A", "");
    }

    @Test
    void retractSourceClearsContributionsAndRecomputesCells() {
        when(contributions.cellsForSource(eq(metricId), eq(1), eq("ev-1")))
                .thenReturn(List.of(
                        new AnalyticsContributionRepository
                                .CellRef("202610", "OU-A", ""),
                        new AnalyticsContributionRepository
                                .CellRef("202611", "OU-B", "")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository
                        .CellAggregate(0L, BigDecimal.ZERO));

        materializer.retractSource(def, metricId, 1, "ev-1");

        verify(contributions).removeForSource(metricId, 1, "ev-1");
        verify(cells).deleteCell(metricId, 1, "202610", "OU-A", "");
        verify(cells).deleteCell(metricId, 1, "202611", "OU-B", "");
    }
}
