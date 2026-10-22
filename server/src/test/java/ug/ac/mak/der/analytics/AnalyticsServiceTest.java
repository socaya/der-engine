package ug.ac.mak.der.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;

class AnalyticsServiceTest {

    @Test
    void summaryDelegates() {
        final AnalyticsRepository repo = mock(AnalyticsRepository.class);
        when(repo.summary("ou", FacilitySummaryRow.Kind.AGGREGATE)).thenReturn(List.of());
        assertThat(new AnalyticsService(repo).summary("ou", FacilitySummaryRow.Kind.AGGREGATE))
                .isEmpty();
    }

    @Test
    void rejectionsDelegates() {
        final AnalyticsRepository repo = mock(AnalyticsRepository.class);
        when(repo.recentRejections(100)).thenReturn(7);
        assertThat(new AnalyticsService(repo).rejections(100)).isEqualTo(7);
    }

    @Test
    void lastRefreshedAtDelegates() {
        final AnalyticsRepository repo = mock(AnalyticsRepository.class);
        final Instant now = Instant.now();
        when(repo.lastRefreshedAt()).thenReturn(now);
        assertThat(new AnalyticsService(repo).lastRefreshedAt()).isEqualTo(now);
    }

    @Test
    void refreshNowDelegates() {
        final AnalyticsRepository repo = mock(AnalyticsRepository.class);
        new AnalyticsService(repo).refreshNow();
        verify(repo).refresh();
    }

    @Test
    void refreshNowPropagatesExceptions() {
        final AnalyticsRepository repo = mock(AnalyticsRepository.class);
        doThrow(new RuntimeException("boom")).when(repo).refresh();
        assertThatThrownBy(() -> new AnalyticsService(repo).refreshNow())
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("boom");
    }
}
