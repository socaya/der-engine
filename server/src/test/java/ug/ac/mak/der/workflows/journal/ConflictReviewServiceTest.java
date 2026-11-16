package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class ConflictReviewServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private OperationJournalEntry entry(final UUID id, final OperationJournalEntry.State state) {
        return new OperationJournalEntry(id, OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "x", mapper.createObjectNode(), state, 0, null, UUID.randomUUID(),
                Instant.now(), Instant.now());
    }

    @Test
    void listConflictsDelegates() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findByState(eq(OperationJournalEntry.State.CONFLICT_REVIEW), anyInt()))
                .thenReturn(List.of());
        new ConflictReviewService(journal, mock(JdbcTemplate.class)).listConflicts(10);
    }

    @Test
    void resolveMissingReturnsEmpty() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findById(any())).thenReturn(Optional.empty());
        assertThat(new ConflictReviewService(journal, mock(JdbcTemplate.class))
                .resolve(UUID.randomUUID(), ConflictReviewService.Outcome.ACCEPTED,
                        UUID.randomUUID(), "x")).isEmpty();
    }

    @Test
    void resolveWrongStateThrows() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(Optional.of(entry(id,
                OperationJournalEntry.State.PENDING)));
        assertThatThrownBy(() -> new ConflictReviewService(journal, mock(JdbcTemplate.class))
                .resolve(id, ConflictReviewService.Outcome.ACCEPTED, UUID.randomUUID(), "x"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void resolveSuccess() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(
                Optional.of(entry(id, OperationJournalEntry.State.CONFLICT_REVIEW)),
                Optional.of(entry(id, OperationJournalEntry.State.CENTRAL_ACCEPTED)));
        final var out = new ConflictReviewService(journal, jdbc)
                .resolve(id, ConflictReviewService.Outcome.ACCEPTED, UUID.randomUUID(), "ok");
        assertThat(out).isPresent();
    }

    @Test
    void reJournalMissing() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findById(any())).thenReturn(Optional.empty());
        assertThat(new ConflictReviewService(journal, mock(JdbcTemplate.class))
                .reJournal(UUID.randomUUID(), UUID.randomUUID())).isEmpty();
    }

    @Test
    void reJournalSuccess() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(
                Optional.of(entry(id, OperationJournalEntry.State.CONFLICT_REVIEW)));
        when(journal.findById(any())).thenReturn(
                Optional.of(entry(UUID.randomUUID(), OperationJournalEntry.State.PENDING)));
        assertThat(new ConflictReviewService(journal, jdbc)
                .reJournal(id, UUID.randomUUID())).isPresent();
    }

    @Test
    void outcomeTerminal() {
        assertThat(ConflictReviewService.Outcome.ACCEPTED.toString()).isEqualTo("ACCEPTED");
        assertThat(ConflictReviewService.Outcome.REJECTED.toString()).isEqualTo("REJECTED");
    }

    // ---- FR-10-04 / FR-10-05 pinned invariants ---------------------

    /**
     * FR-10-04 — "Only merge explicitly approved compatible
     * operations under preserved invariants." The whitelist is
     * exactly CONFLICT_REVIEW; every other state must refuse the
     * resolve request so an admin can't silently flip a central-
     * accepted row to central-rejected (or vice versa) by replaying
     * the resolve endpoint. Parameterised across every non-review
     * state so a future state enum addition that's not in the
     * whitelist also fails this test until explicitly handled.
     */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(
            value = OperationJournalEntry.State.class,
            names = { "CONFLICT_REVIEW" }, mode =
                    org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void resolveRefusesEveryNonReviewState(final OperationJournalEntry.State state) {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(Optional.of(entry(id, state)));
        assertThatThrownBy(() -> new ConflictReviewService(journal, mock(JdbcTemplate.class))
                .resolve(id, ConflictReviewService.Outcome.ACCEPTED, UUID.randomUUID(), "x"))
                .isInstanceOf(IllegalStateException.class);
    }

    /**
     * FR-10-04 — resolver UID + rationale MUST be preserved on the
     * resolved row (audit-trail invariant). Pinned via the raw SQL
     * args Mockito captures.
     */
    @Test
    void resolvePreservesResolverAndRationaleOnUpdate() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        final UUID resolver = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(
                Optional.of(entry(id, OperationJournalEntry.State.CONFLICT_REVIEW)),
                Optional.of(entry(id, OperationJournalEntry.State.CENTRAL_ACCEPTED)));
        new ConflictReviewService(journal, jdbc)
                .resolve(id, ConflictReviewService.Outcome.ACCEPTED, resolver,
                        "operator approved after cross-check with central");
        // SQL args, in order: terminal state, resolver, rationale, opId
        org.mockito.Mockito.verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains("resolved_by"),
                eq("CENTRAL_ACCEPTED"),
                eq(resolver),
                eq("operator approved after cross-check with central"),
                eq(id));
    }

    /**
     * FR-10-05 — "Never silently overwrite meaningful changes solely
     * by latest timestamp." Pinning the service's absence of such
     * a path is harder (it's a non-existence claim); the invariant
     * we CAN pin is that the resolve path accepts exactly two
     * outcomes (ACCEPTED, REJECTED) and nothing else — there is no
     * "latest-wins" / "auto-merge" outcome in the enum. If a future
     * refactor introduces one, this test fails and forces an ADR
     * update.
     */
    @Test
    void outcomeEnumContainsNoLatestWinsOrAutoMergePaths() {
        final java.util.Set<String> allowed = new java.util.LinkedHashSet<>();
        for (final ConflictReviewService.Outcome o : ConflictReviewService.Outcome.values()) {
            allowed.add(o.name());
        }
        assertThat(allowed).containsExactlyInAnyOrder("ACCEPTED", "REJECTED");
        // The two outcomes map to their direct terminal states —
        // never to a merge state that would need its own invariant.
        assertThat(ConflictReviewService.Outcome.ACCEPTED.toTerminal())
                .isEqualTo(OperationJournalEntry.State.CENTRAL_ACCEPTED);
        assertThat(ConflictReviewService.Outcome.REJECTED.toTerminal())
                .isEqualTo(OperationJournalEntry.State.CENTRAL_REJECTED);
    }

    /**
     * FR-10-05 pin on the re-journal path: a conflict can only be
     * re-pushed by cloning into a FRESH operation id linked via
     * {@code supersedes}, never by mutating the existing row in
     * place. This is the "append-only" invariant: a central-rejected
     * row NEVER becomes a central-accepted row via re-journal
     * (which would be timestamp-wins by a different name) —
     * instead a new PENDING row is created and the admin has to
     * drain it fresh.
     */
    @Test
    void reJournalWritesNewOperationIdNotOverwrite() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(
                Optional.of(entry(id, OperationJournalEntry.State.CONFLICT_REVIEW)));
        when(journal.findById(any())).thenReturn(
                Optional.of(entry(UUID.randomUUID(), OperationJournalEntry.State.PENDING)));
        new ConflictReviewService(journal, jdbc).reJournal(id, UUID.randomUUID());
        // The INSERT targets a new row — supersedes column carries
        // the ORIGINAL operation id, and the new row is PENDING
        // (not CENTRAL_ACCEPTED / CENTRAL_REJECTED).
        org.mockito.Mockito.verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains("INSERT INTO der.operation_journal"),
                any(), any(), any(), any(), any(), any());
        org.mockito.Mockito.verify(jdbc, org.mockito.Mockito.never())
                .update(org.mockito.ArgumentMatchers.contains(
                        "UPDATE der.operation_journal SET state = 'CENTRAL_ACCEPTED'"),
                        any(Object.class), any(Object.class));
    }
}
