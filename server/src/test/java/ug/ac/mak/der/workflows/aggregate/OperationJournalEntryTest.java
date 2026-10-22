package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OperationJournalEntryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    @Test
    void builds() {
        final OperationJournalEntry e = new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "k",
                new ObjectMapper().createObjectNode(),
                OperationJournalEntry.State.PENDING,
                0, null, UUID.randomUUID(), NOW, NOW);
        assertThat(e.state()).isEqualTo(OperationJournalEntry.State.PENDING);
        assertThat(e.attemptCount()).isZero();
    }

    @Test
    void rejectsNegativeAttempts() {
        assertThatThrownBy(() -> new OperationJournalEntry(
                UUID.randomUUID(), OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "k",
                new ObjectMapper().createObjectNode(),
                OperationJournalEntry.State.PENDING, -1, null, null, NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNullRequired() {
        final var node = new ObjectMapper().createObjectNode();
        assertThatThrownBy(() -> new OperationJournalEntry(null,
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "k", node,
                OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new OperationJournalEntry(UUID.randomUUID(),
                null, "k", node, OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, null, node,
                OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "k", null,
                OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE, "k", node,
                null, 0, null, null, NOW, NOW))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void enumHasAllStates() {
        assertThat(OperationJournalEntry.State.values()).hasSize(7);
        assertThat(OperationJournalEntry.EntityType.values()).hasSize(5);
    }
}
