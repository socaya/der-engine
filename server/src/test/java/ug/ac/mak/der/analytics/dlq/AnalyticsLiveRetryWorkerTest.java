package ug.ac.mak.der.analytics.dlq;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.analytics.engine.AnalyticsLiveIngester;
import ug.ac.mak.der.analytics.engine.AnalyticsSourceEvent;

class AnalyticsLiveRetryWorkerTest {

    private AnalyticsLiveDlqRepository repo;
    private AnalyticsLiveIngester ingester;
    private AnalyticsLiveRetryWorker worker;

    @BeforeEach
    void setUp() {
        repo = mock(AnalyticsLiveDlqRepository.class);
        ingester = mock(AnalyticsLiveIngester.class);
        worker = new AnalyticsLiveRetryWorker(repo, ingester);
    }

    private AnalyticsLiveDlqEntry entry(final int attempt) {
        return new AnalyticsLiveDlqEntry(
                UUID.randomUUID(),
                AnalyticsSourceEvent.SourceType.EVENT,
                "ev-1", 1L,
                LocalDate.of(2026, 11, 10), "OU-A", "ACTIVE",
                "RuntimeException: db down",
                attempt, Instant.now().minusSeconds(60), false,
                Instant.now().minusSeconds(120),
                Instant.now().minusSeconds(60));
    }

    @Test
    void successfulRetryRemovesEntry() {
        final AnalyticsLiveDlqEntry e = entry(1);
        when(repo.dueForRetry(any(Instant.class), anyInt()))
                .thenReturn(List.of(e));
        doNothing().when(ingester).handle(any());

        final int recovered = worker.tick();

        assertThat(recovered).isEqualTo(1);
        verify(repo).remove(e.dlqId());
        assertThat(worker.stats().recovered()).isEqualTo(1L);
    }

    @Test
    void failedRetryBumpsAttemptAndReschedules() {
        final AnalyticsLiveDlqEntry e = entry(1);
        when(repo.dueForRetry(any(Instant.class), anyInt()))
                .thenReturn(List.of(e));
        doThrow(new RuntimeException("still down"))
                .when(ingester).handle(any());

        worker.tick();

        final ArgumentCaptor<Integer> attempt =
                ArgumentCaptor.forClass(Integer.class);
        verify(repo).markRetried(eq(e.dlqId()), attempt.capture(),
                any(Instant.class), eq(false), anyString());
        assertThat(attempt.getValue()).isEqualTo(2);
    }

    @Test
    void retryBeyondCeilingFlipsGaveUp() {
        // Attempt count 5 → nextAttempt 6 → willGiveUp
        final AnalyticsLiveDlqEntry e = entry(AnalyticsLiveRetryWorker.MAX_ATTEMPTS);
        when(repo.dueForRetry(any(Instant.class), anyInt()))
                .thenReturn(List.of(e));
        doThrow(new RuntimeException("still down"))
                .when(ingester).handle(any());

        worker.tick();

        verify(repo).markRetried(eq(e.dlqId()), anyInt(),
                any(Instant.class), eq(true), anyString());
        assertThat(worker.stats().gaveUp()).isEqualTo(1L);
    }

    @Test
    void retryNowResetsNextRetryAt() {
        final AnalyticsLiveDlqEntry e = entry(2);
        when(repo.findById(e.dlqId())).thenReturn(Optional.of(e));

        final boolean ok = worker.retryNow(e.dlqId());

        assertThat(ok).isTrue();
        verify(repo).markRetried(eq(e.dlqId()), eq(2),
                any(Instant.class), eq(false), anyString());
    }

    @Test
    void retryNowOnMissingEntryReturnsFalse() {
        when(repo.findById(any())).thenReturn(Optional.empty());

        assertThat(worker.retryNow(UUID.randomUUID())).isFalse();
        verify(repo, never()).markRetried(any(), anyInt(),
                any(Instant.class), anyBoolean(), anyString());
    }

    @Test
    void emptyDueListIsNoOp() {
        when(repo.dueForRetry(any(Instant.class), anyInt()))
                .thenReturn(List.of());

        assertThat(worker.tick()).isZero();
        verify(ingester, never()).handle(any());
    }
}
