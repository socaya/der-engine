package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AnalyticsLiveIngesterTest {

    private AnalyticsEngineRepository engineRepo;
    private AnalyticsMaterializer materializer;
    private AnalyticsPeriodEnumerator periods;
    private AnalyticsLiveIngester ingester;

    private final UUID eventMetricId = UUID.randomUUID();
    private final AnalyticsDefinition eventDef = new AnalyticsDefinition(
            eventMetricId, null, AnalyticsSeed.EVENT_COUNT_CODE,
            "Tracker events — count by month", 1, "h", "EVENT", "COUNT",
            null, List.of(), "EVENT_DATE", "EVENT_ORG_UNIT",
            "READY", null, null, null, null);

    @BeforeEach
    void setUp() {
        engineRepo = mock(AnalyticsEngineRepository.class);
        materializer = mock(AnalyticsMaterializer.class);
        periods = new AnalyticsPeriodEnumerator();
        // Phase 3c — jdbc + jsonMapper are nulls here; applyOperator-
        // Definitions early-returns when either is null so the built-in
        // path still exercises every pre-existing scenario.
        ingester = new AnalyticsLiveIngester(engineRepo, materializer,
                periods, null, null);
    }

    @Test
    void appliesContributionForEligibleEvent() {
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-1", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "ACTIVE"));
        verify(materializer).applyContribution(eq(eventDef),
                any(AnalyticsContribution.class));
        assertThat(ingester.stats().applied()).isEqualTo(1L);
        assertThat(ingester.stats().failed()).isEqualTo(0L);
    }

    @Test
    void skippedEventIsStillTrackedAsIneligibleButApplied() {
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-2", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "SKIPPED"));
        // Still applied (counter bumps), but materializer sees a
        // contribution with eligibility=false — captured implicitly
        // by the mock, we assert on stats here.
        assertThat(ingester.stats().applied()).isEqualTo(1L);
    }

    @Test
    void missingDefinitionBumpsSkippedCounter() {
        when(engineRepo.findDefinitionByCode(anyString()))
                .thenReturn(Optional.empty());
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-3", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "ACTIVE"));
        verify(materializer, never()).applyContribution(any(), any());
        assertThat(ingester.stats().skipped()).isEqualTo(1L);
        assertThat(ingester.stats().applied()).isEqualTo(0L);
    }

    @Test
    void failurePropagatesToFailedCounterWithoutThrowing() {
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));
        org.mockito.Mockito.doThrow(new RuntimeException("db down"))
                .when(materializer).applyContribution(any(), any());
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-4", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "ACTIVE"));
        assertThat(ingester.stats().failed()).isEqualTo(1L);
        assertThat(ingester.stats().applied()).isEqualTo(0L);
    }

    @Test
    void tombstoneRetractsAllContributionsForSource() {
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));

        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-gone", 1, LocalDate.of(2026, 11, 10), "OU-A",
                AnalyticsSourceEvent.TOMBSTONE_STATUS));

        verify(materializer).retractSource(eq(eventDef),
                eq(eventMetricId), eq(1), eq("ev-gone"));
        verify(materializer, never()).applyContribution(any(), any());
        assertThat(ingester.stats().applied()).isEqualTo(1L);
    }

    @Test
    void restorationFromSoftDeleteFlipsEligibilityBack() {
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));

        // Soft-delete first: status SKIPPED → eligibility=false
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-restored", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "SKIPPED"));
        final org.mockito.ArgumentCaptor<AnalyticsContribution> cap =
                org.mockito.ArgumentCaptor.forClass(AnalyticsContribution.class);
        verify(materializer).applyContribution(eq(eventDef), cap.capture());
        assertThat(cap.getValue().eligibility()).isFalse();

        // Restore: status ACTIVE → eligibility=true, same source key
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-restored", 2, LocalDate.of(2026, 11, 10), "OU-A",
                "ACTIVE"));
        verify(materializer, org.mockito.Mockito.times(2))
                .applyContribution(eq(eventDef), cap.capture());
        assertThat(cap.getAllValues().get(2).eligibility()).isTrue();
    }

    @Test
    void failureEnqueuesDeadLetterWhenDlqWired() {
        final var dlq = org.mockito.Mockito.mock(
                ug.ac.mak.der.analytics.dlq.AnalyticsLiveDlqRepository.class);
        ingester.setDeadLetterQueue(dlq);
        when(engineRepo.findDefinitionByCode(AnalyticsSeed.EVENT_COUNT_CODE))
                .thenReturn(Optional.of(eventDef));
        org.mockito.Mockito.doThrow(new RuntimeException("db down"))
                .when(materializer).applyContribution(any(), any());

        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-fail", 1, LocalDate.of(2026, 11, 10), "OU-A",
                "ACTIVE"));

        verify(dlq, org.mockito.Mockito.times(1)).enqueue(any());
        assertThat(ingester.stats().failed()).isEqualTo(1L);
    }

    @Test
    void enrollmentEventRoutesToEnrollmentMetric() {
        final UUID enrollMetricId = UUID.randomUUID();
        final AnalyticsDefinition enrollDef = new AnalyticsDefinition(
                enrollMetricId, null, AnalyticsSeed.ENROLLMENT_COUNT_CODE,
                "Enrollments", 1, "h", "ENROLLMENT", "COUNT",
                null, List.of(), "ENROLLMENT_DATE",
                "ENROLLMENT_ORG_UNIT", "READY", null,
                null, null, null);
        when(engineRepo.findDefinitionByCode(
                AnalyticsSeed.ENROLLMENT_COUNT_CODE))
                .thenReturn(Optional.of(enrollDef));
        ingester.handle(new AnalyticsSourceEvent(
                AnalyticsSourceEvent.SourceType.ENROLLMENT,
                "en-1", 1, LocalDate.of(2026, 11, 10), "OU-B",
                "ACTIVE"));
        verify(materializer).applyContribution(eq(enrollDef), any());
        assertThat(ingester.stats().applied()).isEqualTo(1L);
    }
}
