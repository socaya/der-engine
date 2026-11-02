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
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;

class EventPullerTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));
    private final ObjectMapper mapper = new ObjectMapper();

    private EventPuller build(final EventRepository evts,
                                final OperationJournalRepository jr,
                                final SecurityAuditRepository ar,
                                final JsonNode response) {
        final EventPuller p = new EventPuller(evts, jr, ar,
                mock(Dhis2ReferenceClient.class), mapper, clock);
        p.setFetcher((ou, since) -> response);
        return p;
    }

    private JsonNode oneEvent(final UUID eventId, final String status) throws Exception {
        return mapper.readTree("""
            {"events":[{"event":"%s","program":"prog1","programStage":"stage1",
            "orgUnit":"ou1","status":"%s","occurredAt":"2026-11-01T09:00:00Z",
            "attributeOptionCombo":"aoc1","dataValues":[{"dataElement":"de1","value":"x"}],
            "lastUpdated":"2026-11-02T09:00:00Z"}]}
            """.formatted(eventId, status));
    }

    private Event sampleLocal(final UUID id) {
        return new Event(id, null, "prog1", "stage1", "ou1",
                NOW, Event.Status.COMPLETED, "aoc1",
                UUID.randomUUID(), 1, java.util.Map.of("de1", "oldVal"), null);
    }

    private OperationJournalEntry journalRow(final OperationJournalEntry.State state,
                                                 final String ref) {
        return new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.EVENT, ref, mapper.createObjectNode(),
                state, 0, null, null, NOW, NOW, null, null);
    }

    @Test
    void absentLocalRowIsInserted() throws Exception {
        final var evts = mock(EventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final UUID id = UUID.randomUUID();
        when(jr.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(evts.findById(id)).thenReturn(Optional.empty());
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(evts, jr, ar, oneEvent(id, "COMPLETED")).pull("ou1", null);
        assertThat(r.rowsPulled()).isEqualTo(1);
        assertThat(r.conflicts()).isZero();
        verify(evts).upsert(any(Event.class));
        verify(ar, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void terminalLocalRowIsOverwrittenAndAudited() throws Exception {
        final var evts = mock(EventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final UUID id = UUID.randomUUID();
        when(jr.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(journalRow(OperationJournalEntry.State.CENTRAL_ACCEPTED,
                        id.toString())));
        when(evts.findById(id)).thenReturn(Optional.of(sampleLocal(id)));
        when(evts.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var r = build(evts, jr, ar, oneEvent(id, "COMPLETED")).pull("ou1", null);
        assertThat(r.rowsPulled()).isEqualTo(1);
        assertThat(r.conflicts()).isZero();
        verify(evts).upsert(any(Event.class));
        verify(ar).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void nonTerminalLocalRowRaisesConflict() throws Exception {
        final var evts = mock(EventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final UUID id = UUID.randomUUID();
        when(jr.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(journalRow(OperationJournalEntry.State.PENDING,
                        id.toString())));

        final var r = build(evts, jr, ar, oneEvent(id, "COMPLETED")).pull("ou1", null);
        assertThat(r.rowsPulled()).isZero();
        assertThat(r.conflicts()).isEqualTo(1);
        verify(evts, never()).upsert(any());
        verify(jr).insert(any(OperationJournalEntry.class));
    }

    @Test
    void alreadyConflictedLocalRowStaysUntouched() throws Exception {
        final var evts = mock(EventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final UUID id = UUID.randomUUID();
        when(jr.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(journalRow(OperationJournalEntry.State.CONFLICT_REVIEW,
                        id.toString())));

        final var r = build(evts, jr, ar, oneEvent(id, "COMPLETED")).pull("ou1", null);
        assertThat(r.rowsPulled()).isZero();
        assertThat(r.conflicts()).isZero();
        verify(evts, never()).upsert(any());
        verify(jr, never()).insert(any());
    }

    @Test
    void malformedCentralEventIsSkipped() throws Exception {
        final var evts = mock(EventRepository.class);
        final var jr = mock(OperationJournalRepository.class);
        final var ar = mock(SecurityAuditRepository.class);
        final JsonNode broken = mapper.readTree("""
            {"events":[{"event":"xxx"}]}
            """);
        final var r = build(evts, jr, ar, broken).pull("ou1", null);
        assertThat(r.rowsPulled()).isZero();
        assertThat(r.conflicts()).isZero();
    }
}
