package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class JournalRetentionServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T00:00:00Z");

    private static JournalRetentionService svc(
            final OperationJournalRepository journal,
            final SecurityAuditRepository audit,
            final int retentionDays) {
        return new JournalRetentionService(journal, audit,
                Clock.fixed(NOW, ZoneOffset.UTC), retentionDays);
    }

    @Test
    void sweepDelegatesToRepoAndAuditsSource() {
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.purgeTerminalBefore(any())).thenReturn(7);
        final int purged = svc(journal, audit, 30).sweepNow();
        assertThat(purged).isEqualTo(7);
        // Cutoff is NOW - 30 days.
        verify(journal).purgeTerminalBefore(eq(NOW.minus(30, ChronoUnit.DAYS)));
        // Audit event carries source=SCHEDULED + the row count.
        verify(audit).append(argThat((AuditEvent e) ->
                "JOURNAL_RETENTION_PURGE".equals(e.eventType())
                        && "SCHEDULED".equals(e.detail().get("source"))
                        && "7".equals(e.detail().get("rowsPurged"))
                        && "30".equals(e.detail().get("olderThanDays"))),
                any());
    }

    @Test
    void retentionDaysClampsToOneMinimum() {
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.purgeTerminalBefore(any())).thenReturn(0);
        svc(journal, audit, 0).sweepNow();
        // Clamped to 1 day; verify the cutoff is NOW - 1 day.
        verify(journal).purgeTerminalBefore(eq(NOW.minus(1, ChronoUnit.DAYS)));
    }

    @Test
    void dailySweepSwallowsRepoExceptions() {
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        doThrow(new RuntimeException("db down"))
                .when(journal).purgeTerminalBefore(any());
        // Must NOT propagate — the scheduled job fires daily and
        // a transient DB blip shouldn't leave the service dead.
        svc(journal, audit, 30).dailySweep();
        verify(journal).purgeTerminalBefore(any());
    }

    @Test
    void retentionDaysExposed() {
        final var svc = svc(mock(OperationJournalRepository.class),
                mock(SecurityAuditRepository.class), 42);
        assertThat(svc.retentionDays()).isEqualTo(42);
    }

    /**
     * FR-09-10 invariant — the retention SQL MUST filter on terminal
     * states only. Unresolved states (PENDING, IN_FLIGHT, RETRYABLE,
     * UNKNOWN_OUTCOME, CONFLICT_REVIEW) must never be purged. This
     * pins the repository query shape so a future refactor can't
     * silently widen the delete.
     */
    @Test
    void repoQueryShapeIncludesOnlyTerminalStates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(any(String.class),
                any(java.sql.Timestamp.class))).thenReturn(5);
        new OperationJournalRepository(jdbc, new ObjectMapper())
                .purgeTerminalBefore(NOW);
        // Positive — the two terminal states appear.
        verify(jdbc).update(contains("'CENTRAL_ACCEPTED'"), any(java.sql.Timestamp.class));
        verify(jdbc).update(contains("'CENTRAL_REJECTED'"), any(java.sql.Timestamp.class));
        // Negative — unresolved states must NOT appear in the DELETE
        // predicate. Mockito doesn't expose the raw sql separately
        // from any() so we probe by asking "is there a call whose
        // sql contains PENDING?" — there must not be.
        verify(jdbc, never()).update(contains("'PENDING'"),
                any(java.sql.Timestamp.class));
        verify(jdbc, never()).update(contains("'IN_FLIGHT'"),
                any(java.sql.Timestamp.class));
        verify(jdbc, never()).update(contains("'CONFLICT_REVIEW'"),
                any(java.sql.Timestamp.class));
        verify(jdbc, never()).update(contains("'RETRYABLE'"),
                any(java.sql.Timestamp.class));
        verify(jdbc, never()).update(contains("'UNKNOWN_OUTCOME'"),
                any(java.sql.Timestamp.class));
    }
}
