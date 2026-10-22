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
}
