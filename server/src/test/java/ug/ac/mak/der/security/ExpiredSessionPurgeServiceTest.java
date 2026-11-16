package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;

class ExpiredSessionPurgeServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-16T04:45:00Z");

    private static ExpiredSessionPurgeService svc(final EdgeSessionRepository sessions,
                                                      final SecurityAuditRepository audit,
                                                      final int retentionDays) {
        return new ExpiredSessionPurgeService(sessions, audit,
                Clock.fixed(NOW, ZoneOffset.UTC), retentionDays);
    }

    @Test
    void sweepDelegatesWithCutoffAndAuditsSource() {
        final var sessions = mock(EdgeSessionRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(sessions.purgeExpiredBefore(any())).thenReturn(4);
        final int rows = svc(sessions, audit, 7).sweepNow();
        assertThat(rows).isEqualTo(4);
        verify(sessions).purgeExpiredBefore(eq(NOW.minus(7, ChronoUnit.DAYS)));
        verify(audit).append(argThat((AuditEvent e) ->
                "SESSION_EXPIRED_PURGE".equals(e.eventType())
                        && "SCHEDULED".equals(e.detail().get("source"))
                        && "4".equals(e.detail().get("rowsPurged"))
                        && "7".equals(e.detail().get("olderThanDays"))),
                any());
    }

    @Test
    void operatorTriggerSetsSourceOperator() {
        final var sessions = mock(EdgeSessionRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(sessions.purgeExpiredBefore(any())).thenReturn(0);
        svc(sessions, audit, 7).runNow();
        verify(audit).append(argThat((AuditEvent e) ->
                "OPERATOR".equals(e.detail().get("source"))),
                any());
    }

    @Test
    void retentionClampsToOneDayMinimum() {
        final var sessions = mock(EdgeSessionRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(sessions.purgeExpiredBefore(any())).thenReturn(0);
        svc(sessions, audit, 0).sweepNow();
        verify(sessions).purgeExpiredBefore(eq(NOW.minus(1, ChronoUnit.DAYS)));
    }

    @Test
    void dailySweepSwallowsRepoExceptions() {
        final var sessions = mock(EdgeSessionRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        org.mockito.Mockito.doThrow(new RuntimeException("db down"))
                .when(sessions).purgeExpiredBefore(any());
        // Scheduled job must not propagate a transient DB blip —
        // otherwise a bad night leaves the worker dead.
        svc(sessions, audit, 7).dailySweep();
        verify(sessions).purgeExpiredBefore(any());
    }
}
