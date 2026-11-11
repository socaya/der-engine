package ug.ac.mak.der.analytics.benchmark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsLiveIngester;

class AnalyticsBenchmarkServiceTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsLiveIngester ingester;
    private AnalyticsBenchmarkRepository runs;
    private AnalyticsBenchmarkService service;

    private final UUID metricId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        ingester = mock(AnalyticsLiveIngester.class);
        runs = mock(AnalyticsBenchmarkRepository.class);
        service = new AnalyticsBenchmarkService(engineRepo, ingester, runs);
    }

    private AnalyticsDefinition def() {
        return new AnalyticsDefinition(metricId, null, "DER_X",
                "X", 1, "h", "EVENT", "COUNT", null, List.of(),
                "EVENT_DATE", "EVENT_ORG_UNIT",
                "READY", null, null, null, null);
    }

    private AnalyticsCell cell() {
        return new AnalyticsCell(metricId, 1, "202611", "OU-A", "",
                1L, BigDecimal.ONE, BigDecimal.ONE, null, null,
                Instant.now(), "VERIFIED");
    }

    @Test
    void latencyWithoutReadyMetricsReturnsEmptyRun() {
        when(engineRepo.listDefinitions("READY", 1)).thenReturn(List.of());

        final var v = service.latency(10, 2000);

        assertThat(v.nfrMet()).isFalse();
        assertThat(v.run().iterations()).isEqualTo(10);
        verify(runs).insert(any());
    }

    @Test
    void latencyRecordsPercentilesAcrossIterations() {
        when(engineRepo.listDefinitions("READY", 1))
                .thenReturn(List.of(def()));
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final var v = service.latency(10, 2000);

        final ArgumentCaptor<AnalyticsBenchmarkRun> cap =
                ArgumentCaptor.forClass(AnalyticsBenchmarkRun.class);
        verify(runs).insert(cap.capture());
        assertThat(cap.getValue().operation())
                .isEqualTo(AnalyticsBenchmarkRun.Operation.LATENCY);
        assertThat(cap.getValue().iterations()).isEqualTo(10);
        assertThat(v.operationLabel()).isEqualTo("dashboard query");
    }

    @Test
    void freshnessWithoutCellsReturnsEmptyRun() {
        when(engineRepo.queryCells(any())).thenReturn(List.of());

        final var v = service.freshness(5, 10_000);

        assertThat(v.nfrMet()).isFalse();
        assertThat(v.operationLabel()).isEqualTo("ingest latency");
        verify(runs).insert(any());
    }

    @Test
    void freshnessRecordsHandleTimings() {
        when(engineRepo.queryCells(any())).thenReturn(List.of(cell()));
        // Simulate hot-path cost ≈ 1 ms by busy-wait
        doAnswer(inv -> {
            Thread.sleep(1);
            return null;
        }).when(ingester).handle(any());

        final var v = service.freshness(5, 10_000);

        verify(ingester, times(5)).handle(any());
        assertThat(v.run().iterations()).isEqualTo(5);
        assertThat(v.operationLabel()).isEqualTo("ingest latency");
    }

    @Test
    void iterationsClampedToSaneBounds() {
        assertThat(AnalyticsBenchmarkService.clamp(0)).isEqualTo(100);
        assertThat(AnalyticsBenchmarkService.clamp(-5)).isEqualTo(100);
        assertThat(AnalyticsBenchmarkService.clamp(10_000))
                .isEqualTo(2000);
        assertThat(AnalyticsBenchmarkService.clamp(50)).isEqualTo(50);
    }

    @Test
    void percentileHelperHandlesSmallInputs() {
        assertThat(AnalyticsBenchmarkService
                .percentiles(new long[0]).p95()).isZero();
        assertThat(AnalyticsBenchmarkService
                .percentiles(new long[] { 10 }).p95()).isEqualTo(10);
        final var p = AnalyticsBenchmarkService.percentiles(
                new long[] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 });
        assertThat(p.p50()).isEqualTo(5);
        assertThat(p.p95()).isEqualTo(10);
        assertThat(p.max()).isEqualTo(10);
    }

    @Test
    void recentDelegatesToRepo() {
        when(runs.recent(AnalyticsBenchmarkRun.Operation.LATENCY, 50))
                .thenReturn(List.of());

        assertThat(service.recent(
                AnalyticsBenchmarkRun.Operation.LATENCY, 50)).isEmpty();
    }
}
