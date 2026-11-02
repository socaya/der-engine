package ug.ac.mak.der.workflows.pull;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.Enrollment;
import ug.ac.mak.der.workflows.tracker.EnrollmentRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository;
import ug.ac.mak.der.workflows.tracker.TrackedEntityRepository.TrackedEntity;
import ug.ac.mak.der.workflows.tracker.TrackerEvent;
import ug.ac.mak.der.workflows.tracker.TrackerEventRepository;

class TrackerPullerTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));
    private final ObjectMapper mapper = new ObjectMapper();

    private TrackerPuller build(final TrackedEntityRepository teis,
                                   final EnrollmentRepository enrols,
                                   final TrackerEventRepository evts,
                                   final OperationJournalRepository jr,
                                   final SecurityAuditRepository ar,
                                   final JsonNode response) {
        final TrackerPuller p = new TrackerPuller(teis, enrols, evts, jr, ar,
                mock(Dhis2ReferenceClient.class), mapper, clock);
        p.setFetcher((ou, since) -> response);
        return p;
    }

    private JsonNode bundle() throws Exception {
        /* Central returns one of each sub-family — the puller must
         * process TEI → enrol → stage event in that order and
         * independently decide insert vs overwrite vs conflict. */
        return mapper.readTree("""
            {
              "trackedEntities":[{
                "trackedEntity":"TEIAAAAAAAA","trackedEntityType":"typeA",
                "orgUnit":"ou1","lastUpdated":"2026-11-02T07:00:00Z",
                "attributes":[{"attribute":"a1","value":"v1"}]
              }],
              "enrollments":[{
                "enrollment":"ENRAAAAAAAA","trackedEntity":"TEIAAAAAAAA",
                "program":"prog1","orgUnit":"ou1","status":"ACTIVE",
                "enrolledAt":"2026-11-01","lastUpdated":"2026-11-02T08:00:00Z"
              }],
              "events":[{
                "event":"EVTAAAAAAAA","enrollment":"ENRAAAAAAAA",
                "program":"prog1","programStage":"stage1","orgUnit":"ou1",
                "status":"COMPLETED","occurredAt":"2026-11-01",
                "lastUpdated":"2026-11-02T09:00:00Z"
              }]
            }
            """);
    }

    @Test
    void allThreeFamiliesInsertedOnFreshPull() throws Exception {
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(teis.findById(anyString())).thenReturn(Optional.empty());
        when(enrols.findById(anyString())).thenReturn(Optional.empty());
        when(evts.findById(anyString())).thenReturn(Optional.empty());
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrols.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        assertThat(r.rowsPulled()).isEqualTo(3);
        assertThat(r.conflicts()).isZero();
        verify(teis).upsert(any(TrackedEntity.class));
        verify(enrols).upsert(any(Enrollment.class));
        verify(evts).upsert(any(TrackerEvent.class));
        // No overwrite happened — no DATA_PULL_OVERWRITE audit event.
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void operatorPendingEnrolmentCollisionRaisesConflictOnly() throws Exception {
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        // All three families: journal empty EXCEPT ENROLLMENT which has PENDING
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(jr.findLatestByEntityRef(
                org.mockito.ArgumentMatchers.eq(
                        OperationJournalEntry.EntityType.ENROLLMENT), anyString()))
                /* Phase 10.4 distinguishes system-origin PENDING
                 * (null submittedBy = shadow, overwrite) from
                 * operator-origin PENDING (real UUID = conflict).
                 * This case tests the operator path, so stamp a
                 * real actor UUID. */
                .thenReturn(Optional.of(new OperationJournalEntry(UUID.randomUUID(),
                        OperationJournalEntry.EntityType.ENROLLMENT, "ENRAAAAAAAA",
                        mapper.createObjectNode(),
                        OperationJournalEntry.State.PENDING,
                        0, null, UUID.randomUUID(), NOW, NOW, null, null)));
        when(teis.findById(anyString())).thenReturn(Optional.empty());
        when(evts.findById(anyString())).thenReturn(Optional.empty());
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        /* TEI + stage event still pulled; only the enrolment pumped
         * a CONFLICT_REVIEW row and left the operator's PENDING edit
         * untouched. */
        assertThat(r.rowsPulled()).isEqualTo(2);
        assertThat(r.conflicts()).isEqualTo(1);
        verify(enrols, never()).upsert(any());
        verify(jr).insert(any(OperationJournalEntry.class));
    }

    @Test
    void centralTerminalRowsAreOverwrittenAndAudited() throws Exception {
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        // All three journal rows terminal = overwrite path for every family
        when(jr.findLatestByEntityRef(any(), anyString())).thenAnswer(inv ->
                Optional.of(new OperationJournalEntry(UUID.randomUUID(),
                        inv.getArgument(0), inv.getArgument(1),
                        mapper.createObjectNode(),
                        OperationJournalEntry.State.CENTRAL_ACCEPTED,
                        0, null, null, NOW, NOW, null, null)));
        when(teis.findById(anyString())).thenReturn(Optional.of(
                new TrackedEntity("TEIAAAAAAAA", "typeA", "ou1",
                        java.util.Map.of(), UUID.randomUUID(), NOW, NOW, 1, null)));
        when(enrols.findById(anyString())).thenReturn(Optional.of(
                new Enrollment("ENRAAAAAAAA", "TEIAAAAAAAA", "prog1", "ou1",
                        Enrollment.Status.ACTIVE,
                        java.time.LocalDate.parse("2026-10-01"), null, null,
                        UUID.randomUUID(), NOW, NOW, 1, null)));
        when(evts.findById(anyString())).thenReturn(Optional.of(
                new TrackerEvent("EVTAAAAAAAA", "ENRAAAAAAAA", "prog1", "stage1", "ou1",
                        TrackerEvent.Status.COMPLETED,
                        java.time.LocalDate.parse("2026-10-01"),
                        java.util.Map.of(), null,
                        UUID.randomUUID(), NOW, NOW, 1, null)));
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrols.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        assertThat(r.rowsPulled()).isEqualTo(3);
        verify(ar, org.mockito.Mockito.times(3))
                .append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void watermarkIsMaxOfAllThreeFamilies() throws Exception {
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(teis.findById(anyString())).thenReturn(Optional.empty());
        when(enrols.findById(anyString())).thenReturn(Optional.empty());
        when(evts.findById(anyString())).thenReturn(Optional.empty());
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrols.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        /* Of the three lastUpdated timestamps in the bundle, the
         * stage event's is the newest → that must be the watermark. */
        assertThat(r.watermark()).isEqualTo(Instant.parse("2026-11-02T09:00:00Z"));
    }

    // -------- Phase 10.4 — TEI continuity across edges ----------

    private OperationJournalEntry nonTerminalJournal(final OperationJournalEntry.EntityType et,
                                                       final String ref, final UUID submittedBy) {
        return new OperationJournalEntry(UUID.randomUUID(), et, ref,
                mapper.createObjectNode(), OperationJournalEntry.State.PENDING,
                0, null, submittedBy, NOW, NOW, null, null);
    }

    @Test
    void systemOriginPendingEnrolmentIsOverwrittenAsShadow() throws Exception {
        /* Setup: enrolment has a non-terminal journal row with
         * submittedBy = null (system origin — created by referral
         * intake or an earlier central pull). The new continuity
         * logic must treat this as a shadow: central's version
         * wins; TRACKER_SHADOW_OVERWRITTEN audit fires. */
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(jr.findLatestByEntityRef(
                org.mockito.ArgumentMatchers.eq(
                        OperationJournalEntry.EntityType.ENROLLMENT), anyString()))
                .thenReturn(Optional.of(nonTerminalJournal(
                        OperationJournalEntry.EntityType.ENROLLMENT, "ENRAAAAAAAA",
                        null)));
        when(teis.findById(anyString())).thenReturn(Optional.empty());
        when(enrols.findById("ENRAAAAAAAA")).thenReturn(Optional.of(
                new Enrollment("ENRAAAAAAAA", "TEIAAAAAAAA", "prog1", "ou1",
                        Enrollment.Status.ACTIVE,
                        java.time.LocalDate.parse("2026-09-01"), null, null,
                        new UUID(0L, 0L), NOW, NOW, 1, null)));
        when(evts.findById(anyString())).thenReturn(Optional.empty());
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrols.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        /* The enrolment should be upserted (not raised as conflict),
         * so rowsPulled = 3 (TEI + enrol + stage event). Conflicts
         * stays zero because the system-origin PENDING is a shadow,
         * not an operator-pending edit. */
        assertThat(r.rowsPulled()).isEqualTo(3);
        assertThat(r.conflicts()).isZero();
        verify(enrols).upsert(any(Enrollment.class));
        verify(jr, never()).insert(any());
        /* Audit: exactly one TRACKER_SHADOW_OVERWRITTEN for the
         * enrolment. TEI + stage event were fresh inserts
         * (no existing row), so no overwrite audit fires. */
        verify(ar).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "TRACKER_SHADOW_OVERWRITTEN".equals(e.eventType())),
                any());
    }

    @Test
    void operatorOriginPendingEnrolmentStillRaisesConflict() throws Exception {
        /* Setup: enrolment has a non-terminal journal row with a
         * real operator UUID in submittedBy. The continuity logic
         * must leave the existing behaviour alone — operator-pending
         * edits still raise CONFLICT_REVIEW on central-pull. */
        final var teis = mock(TrackedEntityRepository.class);
        final var enrols = mock(EnrollmentRepository.class);
        final var evts = mock(TrackerEventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(jr.findLatestByEntityRef(
                org.mockito.ArgumentMatchers.eq(
                        OperationJournalEntry.EntityType.ENROLLMENT), anyString()))
                .thenReturn(Optional.of(nonTerminalJournal(
                        OperationJournalEntry.EntityType.ENROLLMENT, "ENRAAAAAAAA",
                        UUID.randomUUID())));
        when(teis.findById(anyString())).thenReturn(Optional.empty());
        when(evts.findById(anyString())).thenReturn(Optional.empty());
        when(teis.upsert(any())).thenAnswer(inv -> inv.getArgument(0));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(teis, enrols, evts, jr, ar, bundle()).pull("ou1", null);
        /* Operator-pending enrol => conflict raised; TEI + stage
         * event pulled normally. Matches the pre-10.4 baseline. */
        assertThat(r.rowsPulled()).isEqualTo(2);
        assertThat(r.conflicts()).isEqualTo(1);
        verify(enrols, never()).upsert(any());
        verify(jr).insert(any(OperationJournalEntry.class));
    }
}
