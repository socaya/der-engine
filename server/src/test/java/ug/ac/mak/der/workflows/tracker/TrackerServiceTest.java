package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * §2.3.96 R-D/tracker-svc — covers the three-method service: happy
 * path for each entity type (upsert + journal insert + audit), and
 * atomicity — a repository failure propagates up so Spring rolls
 * back the enclosing {@code @Transactional}, which the test proves
 * by asserting the journal never gets touched.
 */
class TrackerServiceTest {

    private static final Clock CLOCK = Clock.fixed(
        Instant.parse("2026-11-01T22:00:00Z"), ZoneOffset.UTC);
    private static final UUID ACTOR = UUID.fromString(
        "11111111-1111-1111-1111-111111111111");
    private static final UUID RUN = UUID.fromString(
        "22222222-2222-2222-2222-222222222222");

    private final ObjectMapper mapper = new ObjectMapper();

    private TrackerService service(final TrackedEntityRepository teis,
                                      final EnrollmentRepository en,
                                      final TrackerEventRepository ev,
                                      final OperationJournalRepository journal,
                                      final SecurityAuditRepository audit) {
        return new TrackerService(teis, en, ev, journal, audit, mapper, CLOCK);
    }

    @Test
    void upsertTeiPersistsAndJournals() {
        final TrackedEntityRepository teis = mock(TrackedEntityRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final var tei = new TrackedEntityRepository.TrackedEntity(
            "T1234567890", "TETYP00001", "OU11111111",
            Map.of("A1", "val"), ACTOR,
            Instant.now(CLOCK), Instant.now(CLOCK), 1, RUN);
        when(teis.upsert(any())).thenReturn(tei);

        service(teis, mock(EnrollmentRepository.class),
            mock(TrackerEventRepository.class), journal, audit)
                .upsertTei(tei, ACTOR, "1.2.3.4", "ua");

        verify(teis).upsert(tei);
        final ArgumentCaptor<OperationJournalEntry> cap
            = ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(cap.capture());
        assertThat(cap.getValue().entityType())
            .isEqualTo(OperationJournalEntry.EntityType.TRACKED_ENTITY);
        assertThat(cap.getValue().entityRef()).isEqualTo("T1234567890");
        assertThat(cap.getValue().workflowRunId()).isEqualTo(RUN);
        assertThat(cap.getValue().state())
            .isEqualTo(OperationJournalEntry.State.PENDING);
        verify(audit).append(any(AuditEvent.class), any());
    }

    @Test
    void upsertTeiJournalSkippedWhenRepoFails() {
        final TrackedEntityRepository teis = mock(TrackedEntityRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        doThrow(new RuntimeException("db down")).when(teis).upsert(any());

        final var tei = new TrackedEntityRepository.TrackedEntity(
            "T1234567890", "TETYP00001", "OU11111111",
            Map.of(), ACTOR, Instant.now(CLOCK),
            Instant.now(CLOCK), 1, RUN);

        assertThatThrownBy(() -> service(teis, mock(EnrollmentRepository.class),
                mock(TrackerEventRepository.class), journal, audit)
                    .upsertTei(tei, ACTOR, null, null))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("db down");

        // Spring would roll back the @Transactional; from the unit
        // test's POV we at least confirm no journal insert happened.
        verify(journal, never()).insert(any());
        verify(audit, never()).append(any(), any());
    }

    @Test
    void upsertEnrollmentPersistsAndJournals() {
        final EnrollmentRepository en = mock(EnrollmentRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final var enr = new Enrollment("E1234567890", "T1234567890",
            "PROG0000001", "OU11111111", Enrollment.Status.ACTIVE,
            LocalDate.of(2026, 11, 1), null, "svcuser", ACTOR,
            Instant.now(CLOCK), Instant.now(CLOCK), 1, RUN);
        when(en.upsert(any())).thenReturn(enr);

        service(mock(TrackedEntityRepository.class), en,
            mock(TrackerEventRepository.class), journal, audit)
                .upsertEnrollment(enr, ACTOR, null, null);

        final ArgumentCaptor<OperationJournalEntry> cap
            = ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(cap.capture());
        assertThat(cap.getValue().entityType())
            .isEqualTo(OperationJournalEntry.EntityType.ENROLLMENT);
        assertThat(cap.getValue().entityRef()).isEqualTo("E1234567890");
        assertThat(cap.getValue().workflowRunId()).isEqualTo(RUN);
    }

    @Test
    void upsertEventPersistsAndJournals() {
        final TrackerEventRepository ev = mock(TrackerEventRepository.class);
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final SecurityAuditRepository audit = mock(SecurityAuditRepository.class);
        final var tev = new TrackerEvent("V1234567890", "E1234567890",
            "PROG0000001", "STAGE000001", "OU11111111",
            TrackerEvent.Status.COMPLETED, LocalDate.of(2026, 11, 1),
            Map.of("DE1", "7"), "svcuser", ACTOR,
            Instant.now(CLOCK), Instant.now(CLOCK), 1, RUN);
        when(ev.upsert(any())).thenReturn(tev);

        service(mock(TrackedEntityRepository.class),
            mock(EnrollmentRepository.class), ev, journal, audit)
                .upsertEvent(tev, ACTOR, null, null);

        final ArgumentCaptor<OperationJournalEntry> cap
            = ArgumentCaptor.forClass(OperationJournalEntry.class);
        verify(journal).insert(cap.capture());
        assertThat(cap.getValue().entityType())
            .isEqualTo(OperationJournalEntry.EntityType.PROGRAM_STAGE_EVENT);
        assertThat(cap.getValue().entityRef()).isEqualTo("V1234567890");
        assertThat(cap.getValue().workflowRunId()).isEqualTo(RUN);
    }
}
