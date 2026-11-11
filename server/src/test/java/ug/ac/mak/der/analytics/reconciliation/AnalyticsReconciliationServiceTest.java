package ug.ac.mak.der.analytics.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;

class AnalyticsReconciliationServiceTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsReconciliationRepository reconRepo;
    private AnalyticsReconciliationService service;

    private final UUID metricId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        reconRepo = mock(AnalyticsReconciliationRepository.class);
        when(reconRepo.upsert(any())).thenAnswer(inv -> UUID.randomUUID());
        service = new AnalyticsReconciliationService(engineRepo, reconRepo);
    }

    private AnalyticsDefinition def() {
        return new AnalyticsDefinition(metricId, null, "DER_EVENT_COUNT",
                "Event count", 1, "h", "EVENT", "COUNT",
                null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
                "READY", null, null, null, null);
    }

    private AnalyticsCell cell(final BigDecimal value) {
        return new AnalyticsCell(metricId, 1, "202611", "OU-A", "",
                1L, value, value, null, null, Instant.now(), "VERIFIED");
    }

    private AnalyticsReconciliationService.CentralSample sample(
            final BigDecimal centralValue) {
        return new AnalyticsReconciliationService.CentralSample(
                metricId, "202611", "OU-A", "",
                centralValue, 1, Instant.parse("2026-11-10T00:00:00Z"),
                true, true, true, true,
                false, false, false,
                Instant.parse("2026-11-09T00:00:00Z"));
    }

    @Test
    void emptyBatchYieldsZeroRows() {
        final var r = service.compare(List.of());
        assertThat(r.samplesConsidered()).isZero();
        assertThat(r.rowsUpserted()).isZero();
        assertThat(r.byClassification())
                .containsEntry("REAL_MISMATCH", 0);
    }

    @Test
    void agreementUpsertsOneClassifiedRow() {
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def()));
        when(engineRepo.findCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.of(cell(new BigDecimal("42"))));

        final var r = service.compare(List.of(
                sample(new BigDecimal("42"))));

        assertThat(r.rowsUpserted()).isEqualTo(1);
        assertThat(r.byClassification()).containsEntry("IN_AGREEMENT", 1);

        final ArgumentCaptor<AnalyticsReconciliation> cap =
                ArgumentCaptor.forClass(AnalyticsReconciliation.class);
        verify(reconRepo).upsert(cap.capture());
        assertThat(cap.getValue().classification())
                .isEqualTo(ReconciliationClassifier.Classification.IN_AGREEMENT);
        assertThat(cap.getValue().localValue()).isEqualByComparingTo("42");
    }

    @Test
    void metricNotFoundSkipsSample() {
        when(engineRepo.findDefinition(metricId)).thenReturn(Optional.empty());

        final var r = service.compare(List.of(
                sample(new BigDecimal("42"))));

        assertThat(r.samplesConsidered()).isEqualTo(1);
        assertThat(r.rowsUpserted()).isZero();
    }

    @Test
    void missingLocalCellStillClassifies() {
        when(engineRepo.findDefinition(metricId))
                .thenReturn(Optional.of(def()));
        when(engineRepo.findCell(any(), anyInt(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.empty());

        // central returned 42; local has no cell — classifier treats
        // this as REAL_MISMATCH (delta = 42), which the operator can
        // then investigate.
        final var r = service.compare(List.of(
                sample(new BigDecimal("42"))));

        assertThat(r.rowsUpserted()).isEqualTo(1);
        assertThat(r.byClassification())
                .containsEntry("REAL_MISMATCH", 1);
    }

    @Test
    void summaryExposesClassificationHistogram() {
        when(reconRepo.classificationCounts()).thenReturn(
                java.util.Map.of("IN_AGREEMENT", 3, "REAL_MISMATCH", 1));

        final var out = service.summary();

        assertThat(out).containsKey("totalRows");
        assertThat(out.get("totalRows")).isEqualTo(4);
        assertThat(out).containsKey("byClassification");
    }
}
