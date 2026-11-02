package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class TrackerGraphReconcilerTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));
    private final ObjectMapper mapper = new ObjectMapper();

    private TrackerGraphReconciler build(final EnrollmentRepository en,
                                            final TrackerEventRepository ev,
                                            final OperationJournalRepository jr,
                                            final SecurityAuditRepository ar) {
        return new TrackerGraphReconciler(en, ev, jr, ar, mapper, clock);
    }

    private Enrollment orphanEnrol() {
        return new Enrollment("ENRAAAAAAAA", "TEIorphan01", "prog1", "ou1",
                Enrollment.Status.ACTIVE, LocalDate.parse("2026-10-01"), null, null,
                UUID.randomUUID(), NOW, NOW, 1, null);
    }

    private TrackerEvent orphanEvt() {
        return new TrackerEvent("EVTAAAAAAAA", "ENRorphan01", "prog1", "stage1",
                "ou1", TrackerEvent.Status.COMPLETED,
                LocalDate.parse("2026-10-01"), java.util.Map.of(), null,
                UUID.randomUUID(), NOW, NOW, 1, null);
    }

    @Test
    void cleanGraphProducesZeroCountReport() {
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(en.findOrphans(anyInt())).thenReturn(List.of());
        when(ev.findOrphans(anyInt())).thenReturn(List.of());

        final var report = build(en, ev, jr, ar).reconcile();
        assertThat(report.total()).isZero();
        verify(jr, never()).insert(any());
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void orphanEnrolmentRaisesConflictAndAuditEvent() {
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(en.findOrphans(anyInt())).thenReturn(List.of(orphanEnrol()));
        when(ev.findOrphans(anyInt())).thenReturn(List.of());

        final var report = build(en, ev, jr, ar).reconcile();
        assertThat(report.orphanEnrolments()).isEqualTo(1);
        assertThat(report.total()).isEqualTo(1);
        verify(jr).insert(any(OperationJournalEntry.class));
        verify(ar).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void orphanStageEventRaisesConflictAndAuditEvent() {
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(en.findOrphans(anyInt())).thenReturn(List.of());
        when(ev.findOrphans(anyInt())).thenReturn(List.of(orphanEvt()));

        final var report = build(en, ev, jr, ar).reconcile();
        assertThat(report.orphanEvents()).isEqualTo(1);
        assertThat(report.total()).isEqualTo(1);
        verify(jr).insert(any(OperationJournalEntry.class));
        verify(ar).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void bothFamiliesReportedIndependentlyAndAggregated() {
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(en.findOrphans(anyInt())).thenReturn(List.of(orphanEnrol(), orphanEnrol()));
        when(ev.findOrphans(anyInt())).thenReturn(List.of(orphanEvt()));

        final var report = build(en, ev, jr, ar).reconcile();
        assertThat(report.orphanEnrolments()).isEqualTo(2);
        assertThat(report.orphanEvents()).isEqualTo(1);
        assertThat(report.total()).isEqualTo(3);
        // One journal insert + one audit event per orphan
        verify(jr, times(3)).insert(any(OperationJournalEntry.class));
        verify(ar, times(3)).append(any(AuditEvent.class), any(Instant.class));
    }
}
