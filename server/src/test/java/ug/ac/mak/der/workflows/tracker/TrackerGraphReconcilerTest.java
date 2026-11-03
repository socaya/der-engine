package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
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
        return new TrackerGraphReconciler(
                mock(TrackedEntityRepository.class),
                en, ev, jr, ar, mapper, clock);
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

    // -------- Phase 12.4 — orphan auto-healing ----------

    @Test
    void autoHealClosesPriorOrphanWhenParentNowExists() {
        final var teis = mock(TrackedEntityRepository.class);
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        /* A prior tick raised an orphan conflict for enrolment
         * ENRaaaaaaaa referencing TEI TEIbbbbbbbbb. On this tick,
         * the parent TEI now exists in the local mirror, AND the
         * local enrolment row still carries the same tei_uid. The
         * auto-heal pass must flip the conflict to CENTRAL_ACCEPTED
         * + emit a TRACKER_ORPHAN_AUTOHEALED audit event. */
        final var priorConflict = new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.ENROLLMENT,
                "ENRaaaaaaaa", mapper.createObjectNode(),
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0,
                "enrolment references TEI not in the local mirror",
                null, NOW, NOW, null, null);
        when(jr.findOrphanConflicts(
                org.mockito.ArgumentMatchers.eq(OperationJournalEntry.EntityType.ENROLLMENT),
                anyInt()))
                .thenReturn(List.of(priorConflict));
        when(jr.findOrphanConflicts(
                org.mockito.ArgumentMatchers.eq(
                        OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT), anyInt()))
                .thenReturn(List.of());
        when(en.findById("ENRaaaaaaaa")).thenReturn(
                java.util.Optional.of(orphanEnrol()));
        when(teis.findById(anyString()))
                .thenReturn(java.util.Optional.of(
                        new TrackedEntityRepository.TrackedEntity(
                                "TEIorphan01", "typeA", "ou1",
                                java.util.Map.of(), UUID.randomUUID(), NOW, NOW, 1, null)));
        when(jr.markOrphanAutoHealed(any(UUID.class), org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(1);
        when(en.findOrphans(anyInt())).thenReturn(List.of());
        when(ev.findOrphans(anyInt())).thenReturn(List.of());

        final var report = new TrackerGraphReconciler(teis, en, ev, jr, ar, mapper, clock)
                .reconcile();
        assertThat(report.healedEnrolments()).isEqualTo(1);
        assertThat(report.orphanEnrolments()).isZero();
        verify(jr).markOrphanAutoHealed(any(UUID.class), org.mockito.ArgumentMatchers.anyString());
        verify(ar).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "TRACKER_ORPHAN_AUTOHEALED".equals(e.eventType())),
                any(Instant.class));
    }

    @Test
    void autoHealLeavesConflictAlonewhenParentStillMissing() {
        final var teis = mock(TrackedEntityRepository.class);
        final var en = mock(EnrollmentRepository.class);
        final var ev = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final var priorConflict = new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.ENROLLMENT,
                "ENRaaaaaaaa", mapper.createObjectNode(),
                OperationJournalEntry.State.CONFLICT_REVIEW,
                0, "enrolment references TEI not in the local mirror",
                null, NOW, NOW, null, null);
        when(jr.findOrphanConflicts(
                org.mockito.ArgumentMatchers.eq(OperationJournalEntry.EntityType.ENROLLMENT),
                anyInt()))
                .thenReturn(List.of(priorConflict));
        when(jr.findOrphanConflicts(
                org.mockito.ArgumentMatchers.eq(
                        OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT), anyInt()))
                .thenReturn(List.of());
        when(en.findById("ENRaaaaaaaa")).thenReturn(
                java.util.Optional.of(orphanEnrol()));
        when(teis.findById(anyString())).thenReturn(java.util.Optional.empty());
        when(en.findOrphans(anyInt())).thenReturn(List.of());
        when(ev.findOrphans(anyInt())).thenReturn(List.of());

        final var report = new TrackerGraphReconciler(teis, en, ev, jr, ar, mapper, clock)
                .reconcile();
        assertThat(report.healedEnrolments()).isZero();
        verify(jr, never()).markOrphanAutoHealed(any(UUID.class),
                org.mockito.ArgumentMatchers.anyString());
    }
}
