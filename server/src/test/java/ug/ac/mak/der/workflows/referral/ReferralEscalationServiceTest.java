package ug.ac.mak.der.workflows.referral;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository.ReferralOutstandingRow;

class ReferralEscalationServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));

    private ReferralEscalationService build(final OperationJournalRepository jr,
                                              final SecurityAuditRepository ar,
                                              final Duration threshold) {
        return new ReferralEscalationService(jr, ar, clock, threshold, 100);
    }

    private ReferralOutstandingRow row(final String ou) {
        return new ReferralOutstandingRow(UUID.randomUUID(), ou,
                NOW.minus(Duration.ofHours(2)));
    }

    @Test
    void emptyScanProducesZeroEscalations() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findOutstandingReferralsPastDue(any(), anyInt())).thenReturn(List.of());
        final var r = build(jr, ar, Duration.ofMinutes(30)).escalateOnce();
        assertThat(r.scanned()).isZero();
        assertThat(r.escalated()).isZero();
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void eachRowAuditsAndFlagsEscalated() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final var r1 = row("ouA");
        final var r2 = row("ouB");
        when(jr.findOutstandingReferralsPastDue(any(), anyInt()))
                .thenReturn(List.of(r1, r2));
        when(jr.markReferralEscalated(any(UUID.class), any(Instant.class))).thenReturn(1);

        final var report = build(jr, ar, Duration.ofMinutes(30)).escalateOnce();
        assertThat(report.scanned()).isEqualTo(2);
        assertThat(report.escalated()).isEqualTo(2);
        assertThat(report.raceSkipped()).isZero();
        verify(jr).markReferralEscalated(eq(r1.operationId()), any(Instant.class));
        verify(jr).markReferralEscalated(eq(r2.operationId()), any(Instant.class));
        verify(ar, times(2)).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void raceWithAckSkipsRowWithoutAuditing() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final var r1 = row("ouA");
        when(jr.findOutstandingReferralsPastDue(any(), anyInt())).thenReturn(List.of(r1));
        /* 0 rows updated = ack endpoint stamped referral_delivered_at
         * between the scan and the UPDATE. Skip the row and do NOT
         * audit it as undelivered. */
        when(jr.markReferralEscalated(any(UUID.class), any(Instant.class))).thenReturn(0);

        final var report = build(jr, ar, Duration.ofMinutes(30)).escalateOnce();
        assertThat(report.scanned()).isEqualTo(1);
        assertThat(report.escalated()).isZero();
        assertThat(report.raceSkipped()).isEqualTo(1);
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void thresholdSubtractedFromClockForCutoff() {
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findOutstandingReferralsPastDue(any(), anyInt())).thenReturn(List.of());
        build(jr, ar, Duration.ofMinutes(30)).escalateOnce();
        verify(jr).findOutstandingReferralsPastDue(
                eq(NOW.minus(Duration.ofMinutes(30))), anyInt());
    }
}
