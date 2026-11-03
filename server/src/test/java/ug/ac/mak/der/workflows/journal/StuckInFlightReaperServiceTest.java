package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class StuckInFlightReaperServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-03T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));

    @Test
    void zeroReapedDoesNotAudit() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.requeueStuckInFlight(any())).thenReturn(0);
        final int n = new StuckInFlightReaperService(jr, ar, clock, Duration.ofMinutes(10), mock(ug.ac.mak.der.observability.DerMetrics.class))
                .reapOnce();
        assertThat(n).isZero();
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void nonZeroReapedAuditsCount() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.requeueStuckInFlight(any())).thenReturn(3);
        final int n = new StuckInFlightReaperService(jr, ar, clock, Duration.ofMinutes(10), mock(ug.ac.mak.der.observability.DerMetrics.class))
                .reapOnce();
        assertThat(n).isEqualTo(3);
        verify(ar).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "JOURNAL_INFLIGHT_STUCK_REAPED".equals(e.eventType())
                                && "3".equals(e.detail().get("rowsReaped"))),
                any(Instant.class));
    }

    @Test
    void cutoffIsClockMinusThreshold() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.requeueStuckInFlight(any())).thenReturn(0);
        new StuckInFlightReaperService(jr, ar, clock, Duration.ofMinutes(10), mock(ug.ac.mak.der.observability.DerMetrics.class)).reapOnce();
        verify(jr).requeueStuckInFlight(eq(NOW.minus(Duration.ofMinutes(10))));
    }
}
