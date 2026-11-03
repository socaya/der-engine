package ug.ac.mak.der.workflows.journal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class JournalInFlightReaperRunnerTest {

    @Test
    void cleanBootDoesNotAuditWhenNoRowsReaped() {
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.requeueOrphanedInFlight()).thenReturn(0);
        new JournalInFlightReaperRunner(journal, audit, mock(ug.ac.mak.der.observability.DerMetrics.class)).reapOnBoot();
        verify(audit, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void postCrashBootAuditsReapedCount() {
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.requeueOrphanedInFlight()).thenReturn(5);
        new JournalInFlightReaperRunner(journal, audit, mock(ug.ac.mak.der.observability.DerMetrics.class)).reapOnBoot();
        verify(audit).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "JOURNAL_INFLIGHT_REAPED".equals(e.eventType())
                                && "5".equals(e.detail().get("rowsReaped"))),
                any(Instant.class));
    }
}
