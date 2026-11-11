package ug.ac.mak.der.analytics.replay;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class AnalyticsBaselineVerifierTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsContributionRepository contributions;
    private AnalyticsBaselineVerifier verifier;

    private final UUID metricId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        contributions = mock(AnalyticsContributionRepository.class);
        verifier = new AnalyticsBaselineVerifier(engineRepo, contributions);
    }

    private AnalyticsDefinition def(final String agg) {
        return new AnalyticsDefinition(metricId, null, "DER_X",
                "X", 1, "h", "EVENT", agg,
                null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
                "READY", null, null, null, null);
    }

    private AnalyticsCell cell(final long count, final BigDecimal value) {
        return new AnalyticsCell(metricId, 1, "202611", "OU-A", "",
                count, value, value, null, null, Instant.now(), "VERIFIED");
    }

    @Test
    void cellInAgreementIsOk() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(5L, new BigDecimal("5"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def("COUNT")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository.CellAggregate(
                        5L, new BigDecimal("5")));

        final var r = verifier.verify(10);

        assertThat(r.cellsChecked()).isEqualTo(1);
        assertThat(r.cellsOk()).isEqualTo(1);
        assertThat(r.cellsDrifted()).isZero();
    }

    @Test
    void valueDriftSurfacesDrift() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(5L, new BigDecimal("4"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def("COUNT")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository.CellAggregate(
                        5L, new BigDecimal("5")));

        final var r = verifier.verify(10);

        assertThat(r.cellsDrifted()).isEqualTo(1);
        assertThat(r.drifts().get(0).reason()).contains("value");
        assertThat(r.drifts().get(0).storedValue())
                .isEqualByComparingTo("4");
        assertThat(r.drifts().get(0).recomputedValue())
                .isEqualByComparingTo("5");
    }

    @Test
    void countDriftSurfacesDrift() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(4L, new BigDecimal("5"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def("COUNT")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository.CellAggregate(
                        5L, new BigDecimal("5")));

        final var r = verifier.verify(10);

        assertThat(r.cellsDrifted()).isEqualTo(1);
        assertThat(r.drifts().get(0).reason()).contains("count");
    }

    @Test
    void missingDefinitionIsReportedSeparately() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(5L, new BigDecimal("5"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.empty());

        final var r = verifier.verify(10);

        assertThat(r.cellsChecked()).isEqualTo(1);
        assertThat(r.cellsOk()).isZero();
        assertThat(r.cellsDrifted()).isZero();
        assertThat(r.metricsMissing()).isEqualTo(1);
    }

    @Test
    void sumAggregationUsesSumNotCount() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(3L, new BigDecimal("42"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def("SUM")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository.CellAggregate(
                        3L, new BigDecimal("42")));

        final var r = verifier.verify(10);

        assertThat(r.cellsOk()).isEqualTo(1);
    }

    @Test
    void ratioMetricUsesSumNumeratorOverSumDenominator() {
        when(engineRepo.queryCells(any()))
                .thenReturn(List.of(cell(3L,
                        new BigDecimal("0.5"))));
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def("NONE")));
        when(contributions.aggregateForCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(new AnalyticsContributionRepository.CellAggregate(
                        3L, BigDecimal.ZERO,
                        new BigDecimal("25"), new BigDecimal("50")));

        final var r = verifier.verify(10);

        // 25 / 50 = 0.5 — in agreement with stored value 0.5.
        assertThat(r.cellsOk()).isEqualTo(1);
    }

    @Test
    void jsonProjectionIncludesEveryDriftRow() {
        final var drift = new AnalyticsBaselineVerifier.Drift(
                metricId, 1, "202611", "OU-A", "",
                new BigDecimal("4"), new BigDecimal("5"),
                5L, 5L, "value drift");
        final var report = new AnalyticsBaselineVerifier.BaselineReport(
                1, 0, 1, 0, List.of(drift));

        final var out = AnalyticsBaselineVerifier.asJson(report);

        assertThat(out).containsEntry("cellsChecked", 1);
        assertThat(out).containsEntry("cellsDrifted", 1);
        @SuppressWarnings("unchecked")
        final List<java.util.Map<String, Object>> rows =
                (List<java.util.Map<String, Object>>) out.get("drifts");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)).containsEntry("reason", "value drift");
    }
}
