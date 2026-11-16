package ug.ac.mak.der.workflows.pull;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
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
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * ADR-0034 merge-semantics coverage. Every branch of the three-way
 * decision tree is exercised in isolation so a regression in one
 * branch doesn't silently break the others.
 */
class AggregatePullerTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));
    private final ObjectMapper mapper = new ObjectMapper();

    private AggregatePuller build(final AggregateDataValueRepository values,
                                    final OperationJournalRepository journal,
                                    final SecurityAuditRepository audit,
                                    final JsonNode response) {
        final AggregatePuller p = new AggregatePuller(values, journal, audit,
                mock(Dhis2ReferenceClient.class), mapper, clock);
        p.setFetcher((ou, since) -> response);
        return p;
    }

    private JsonNode oneDataValue(final String de, final String val,
                                     final String lastUpdated) throws Exception {
        return mapper.readTree("""
            {"dataValues":[{"dataElement":"%s","orgUnit":"ou1","period":"2026W44",
            "categoryOptionCombo":"coc1","attributeOptionCombo":"aoc1",
            "value":"%s","comment":"","lastUpdated":"%s"}]}
            """.formatted(de, val, lastUpdated));
    }

    private AggregateDataValue existingLocal(final String de, final String val) {
        return new AggregateDataValue(UUID.randomUUID(), de, "ou1", "2026W44",
                "coc1", "aoc1", val, "", UUID.randomUUID(), NOW, 1, "ds1", null);
    }

    @Test
    void absentLocalRowIsInserted() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(values.findByCompoundKey(anyString(), anyString(), anyString(),
                anyString(), anyString())).thenReturn(Optional.empty());
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var result = build(values, journal, audit,
                oneDataValue("de1", "7", "2026-11-02T09:00:00Z"))
                .pull("ou1", null);
        assertThat(result.rowsPulled()).isEqualTo(1);
        assertThat(result.conflicts()).isZero();
        verify(values).upsert(any(AggregateDataValue.class));
        verify(audit, never()).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void terminalLocalRowIsOverwrittenAndAudited() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(terminalJournal(OperationJournalEntry.State.CENTRAL_ACCEPTED)));
        when(journal.tryLockRowForPublish(any())).thenReturn(true);
        when(values.findByCompoundKey(anyString(), anyString(), anyString(),
                anyString(), anyString()))
                .thenReturn(Optional.of(existingLocal("de1", "oldVal")));
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final var result = build(values, journal, audit,
                oneDataValue("de1", "newVal", "2026-11-02T09:00:00Z"))
                .pull("ou1", null);
        assertThat(result.rowsPulled()).isEqualTo(1);
        assertThat(result.conflicts()).isZero();
        verify(values).upsert(any(AggregateDataValue.class));
        // The overwrite audit event is the operator's one-click path
        // to answering "what did pull touch recently?"
        verify(audit).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void nonTerminalLocalRowRaisesConflictAndKeepsLocal() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(terminalJournal(OperationJournalEntry.State.PENDING)));

        final var result = build(values, journal, audit,
                oneDataValue("de1", "centralVal", "2026-11-02T09:00:00Z"))
                .pull("ou1", null);
        assertThat(result.rowsPulled()).isZero();
        assertThat(result.conflicts()).isEqualTo(1);
        verify(values, never()).upsert(any());
        verify(journal).insert(any(OperationJournalEntry.class));
    }

    @Test
    void alreadyConflictedLocalRowStaysUntouched() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(terminalJournal(OperationJournalEntry.State.CONFLICT_REVIEW)));

        final var result = build(values, journal, audit,
                oneDataValue("de1", "centralVal", "2026-11-02T09:00:00Z"))
                .pull("ou1", null);
        assertThat(result.rowsPulled()).isZero();
        assertThat(result.conflicts()).isZero();
        verify(values, never()).upsert(any());
        verify(journal, never()).insert(any());
    }

    @Test
    void malformedDataValueIsSkipped() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final JsonNode broken = mapper.readTree("""
            {"dataValues":[{"dataElement":"de1"}]}
            """);
        final var result = build(values, journal, audit, broken).pull("ou1", null);
        assertThat(result.rowsPulled()).isZero();
        assertThat(result.conflicts()).isZero();
        verify(values, never()).upsert(any());
        verify(journal, never()).insert(any());
    }

    @Test
    void watermarkAdvancesToMaxCentralLastUpdated() throws Exception {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString())).thenReturn(Optional.empty());
        when(values.findByCompoundKey(anyString(), anyString(), anyString(),
                anyString(), anyString())).thenReturn(Optional.empty());
        when(values.upsert(any())).thenAnswer(inv -> inv.getArgument(0));

        final JsonNode three = mapper.readTree("""
            {"dataValues":[
              {"dataElement":"de1","orgUnit":"ou1","period":"2026W44",
               "categoryOptionCombo":"coc1","attributeOptionCombo":"aoc1",
               "value":"1","comment":"","lastUpdated":"2026-11-02T08:00:00Z"},
              {"dataElement":"de2","orgUnit":"ou1","period":"2026W44",
               "categoryOptionCombo":"coc1","attributeOptionCombo":"aoc1",
               "value":"2","comment":"","lastUpdated":"2026-11-02T11:30:00Z"},
              {"dataElement":"de3","orgUnit":"ou1","period":"2026W44",
               "categoryOptionCombo":"coc1","attributeOptionCombo":"aoc1",
               "value":"3","comment":"","lastUpdated":"2026-11-02T09:15:00Z"}
            ]}
            """);
        final var result = build(values, journal, audit, three).pull("ou1", null);
        assertThat(result.rowsPulled()).isEqualTo(3);
        assertThat(result.watermark()).isEqualTo(Instant.parse("2026-11-02T11:30:00Z"));
    }

    @Test
    void drainHoldingLockDefersOverwriteWithoutRaisingConflict() throws Exception {
        /* ADR-0035 — a central-wins overwrite must be deferred (not
         * raised as a conflict) when the drain worker holds the row
         * lock mid-publish. The next pull tick retries; the race
         * window closes without silent drift. */
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(journal.findLatestByEntityRef(any(), anyString()))
                .thenReturn(Optional.of(terminalJournal(OperationJournalEntry.State.CENTRAL_ACCEPTED)));
        when(journal.tryLockRowForPublish(any())).thenReturn(false);

        final var result = build(values, journal, audit,
                oneDataValue("de1", "centralVal", "2026-11-02T09:00:00Z"))
                .pull("ou1", null);
        assertThat(result.rowsPulled()).isZero();
        assertThat(result.conflicts()).isZero();
        verify(values, never()).upsert(any());
        verify(journal, never()).insert(any());
        verify(audit, never()).append(any(AuditEvent.class), any(java.time.Instant.class));
    }

    @Test
    void fetcherFailureSurfacesAsRuntime() {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final AggregatePuller p = new AggregatePuller(values, journal, audit,
                mock(Dhis2ReferenceClient.class), mapper, clock);
        p.setFetcher((ou, since) -> {
            throw new RuntimeException("central responded 502");
        });
        try {
            p.pull("ou1", null);
        } catch (RuntimeException ex) {
            assertThat(ex.getMessage()).contains("502");
            return;
        }
        throw new AssertionError("pull() should have surfaced the fetcher error");
    }

    private OperationJournalEntry terminalJournal(final OperationJournalEntry.State state) {
        return new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "de1|ou1|2026W44|coc1|aoc1", mapper.createObjectNode(),
                state, 0, null, null, NOW, NOW, null, null);
    }

    // ---- FR-13-08 deletion sweep -----------------------------------

    private static AggregateDataValue dv(final String de, final String ou,
                                           final String per, final String coc,
                                           final String aoc, final String value) {
        return new AggregateDataValue(UUID.randomUUID(), de, ou, per, coc, aoc,
                value, "", UUID.randomUUID(), NOW, 1, "DS1", null);
    }

    private OperationJournalEntry journalForKey(final String compoundKey,
                                                  final OperationJournalEntry.State state) {
        return new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                compoundKey, mapper.createObjectNode(),
                state, 0, null, null, NOW, NOW, null, null);
    }

    @org.junit.jupiter.api.Test
    void sweepEmitsDeletionForCentralAcceptedRowAbsentFromCentral() {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var deleted = dv("de1", "ou1", "2026W44", "coc1", "aoc1", "42");
        when(values.findByFilter(eq("ou1"), eq("2026W44"), anyInt()))
                .thenReturn(java.util.List.of(deleted));
        when(journal.findLatestByEntityRef(any(),
                eq("de1|ou1|2026W44|coc1|aoc1"))).thenReturn(Optional.of(
                        journalForKey("de1|ou1|2026W44|coc1|aoc1",
                                OperationJournalEntry.State.CENTRAL_ACCEPTED)));
        final int emitted = build(values, journal, audit, mapper.createObjectNode())
                .sweepDeletions("ou1", "2026W44", java.util.Set.of());
        assertThat(emitted).isEqualTo(1);
        verify(audit).append(org.mockito.ArgumentMatchers.argThat(
                (AuditEvent e) ->
                        "AGGREGATE_DIVERGENCE_CENTRAL_DELETED".equals(e.eventType())
                                && "de1|ou1|2026W44|coc1|aoc1"
                                        .equals(e.detail().get("compoundKey"))
                                && "42".equals(e.detail().get("localValue"))),
                any());
    }

    @org.junit.jupiter.api.Test
    void sweepSkipsRowStillPresentOnCentral() {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var present = dv("de1", "ou1", "2026W44", "coc1", "aoc1", "5");
        when(values.findByFilter(any(), any(), anyInt()))
                .thenReturn(java.util.List.of(present));
        final int emitted = build(values, journal, audit, mapper.createObjectNode())
                .sweepDeletions("ou1", "2026W44",
                        java.util.Set.of("de1|ou1|2026W44|coc1|aoc1"));
        assertThat(emitted).isZero();
        verify(audit, never()).append(any(), any());
    }

    @org.junit.jupiter.api.Test
    void sweepSkipsRowThatNeverReachedCentral() {
        // A locally-written row that's still PENDING in the journal
        // is not a central deletion — it's just unpublished local
        // state. Must NOT emit AGGREGATE_DIVERGENCE_CENTRAL_DELETED.
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var unpublished = dv("de2", "ou1", "2026W44", "coc1", "aoc1", "9");
        when(values.findByFilter(any(), any(), anyInt()))
                .thenReturn(java.util.List.of(unpublished));
        when(journal.findLatestByEntityRef(any(),
                eq("de2|ou1|2026W44|coc1|aoc1"))).thenReturn(Optional.of(
                        journalForKey("de2|ou1|2026W44|coc1|aoc1",
                                OperationJournalEntry.State.PENDING)));
        final int emitted = build(values, journal, audit, mapper.createObjectNode())
                .sweepDeletions("ou1", "2026W44", java.util.Set.of());
        assertThat(emitted).isZero();
        verify(audit, never()).append(any(), any());
    }

    @org.junit.jupiter.api.Test
    void sweepSkipsRowWithNoJournalRow() {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        when(values.findByFilter(any(), any(), anyInt()))
                .thenReturn(java.util.List.of(
                        dv("de3", "ou1", "2026W44", "coc1", "aoc1", "x")));
        when(journal.findLatestByEntityRef(any(), any()))
                .thenReturn(Optional.empty());
        final int emitted = build(values, journal, audit, mapper.createObjectNode())
                .sweepDeletions("ou1", "2026W44", java.util.Set.of());
        assertThat(emitted).isZero();
    }

    @org.junit.jupiter.api.Test
    void sweepIgnoresNullOrEmptyOrgUnit() {
        final var values = mock(AggregateDataValueRepository.class);
        final var journal = mock(OperationJournalRepository.class);
        final var audit = mock(SecurityAuditRepository.class);
        final var p = build(values, journal, audit, mapper.createObjectNode());
        assertThat(p.sweepDeletions(null, "2026W44", java.util.Set.of())).isZero();
        assertThat(p.sweepDeletions("", "2026W44", java.util.Set.of())).isZero();
        verify(values, never()).findByFilter(any(), any(), anyInt());
    }
}
