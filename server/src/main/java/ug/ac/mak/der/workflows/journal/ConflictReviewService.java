package ug.ac.mak.der.workflows.journal;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Transitions CONFLICT_REVIEW rows via admin action. ADR-0009.
 *
 * <p>Resolve: transition CONFLICT_REVIEW to CENTRAL_ACCEPTED or CENTRAL_REJECTED
 * with rationale + resolver uid.</p>
 *
 * <p>Re-journal: clone the row to a new PENDING entry referencing the original
 * via {@code supersedes} so Phase 04's worker retries without losing audit.</p>
 */
@Service
public class ConflictReviewService {

    private final OperationJournalRepository journal;
    private final JdbcTemplate jdbc;

    public ConflictReviewService(final OperationJournalRepository journal, final JdbcTemplate jdbc) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public List<OperationJournalEntry> listConflicts(final int limit) {
        final int capped = Math.max(1, Math.min(500, limit));
        return journal.findByState(OperationJournalEntry.State.CONFLICT_REVIEW, capped);
    }

    @Transactional
    public Optional<OperationJournalEntry> resolve(final UUID operationId, final Outcome outcome,
                                                    final UUID resolver, final String rationale) {
        Objects.requireNonNull(operationId, "operationId");
        Objects.requireNonNull(outcome, "outcome");
        final Optional<OperationJournalEntry> existing = journal.findById(operationId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        if (existing.get().state() != OperationJournalEntry.State.CONFLICT_REVIEW) {
            throw new IllegalStateException("operation " + operationId
                    + " is not in CONFLICT_REVIEW (current=" + existing.get().state() + ")");
        }
        jdbc.update("UPDATE der.operation_journal SET state = ?, resolved_at = now(), "
                        + "resolved_by = ?, resolution_rationale = ?, updated_at = now() "
                        + "WHERE operation_id = ?",
                outcome.toTerminal().name(), resolver, rationale, operationId);
        return journal.findById(operationId);
    }

    @Transactional
    public Optional<OperationJournalEntry> reJournal(final UUID operationId, final UUID resolver) {
        Objects.requireNonNull(operationId, "operationId");
        final Optional<OperationJournalEntry> existing = journal.findById(operationId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        final OperationJournalEntry original = existing.get();
        final UUID newId = UUID.randomUUID();
        jdbc.update("INSERT INTO der.operation_journal (operation_id, entity_type, entity_ref, "
                        + "payload_json, state, attempt_count, submitted_by, created_at, updated_at, "
                        + "supersedes) VALUES (?, ?, ?, CAST(? AS jsonb), 'PENDING', 0, ?, now(), now(), ?)",
                newId, original.entityType().name(), original.entityRef(),
                original.payload() == null ? "{}" : original.payload().toString(),
                resolver, operationId);
        return journal.findById(newId);
    }

    public enum Outcome {
        ACCEPTED(OperationJournalEntry.State.CENTRAL_ACCEPTED),
        REJECTED(OperationJournalEntry.State.CENTRAL_REJECTED);

        private final OperationJournalEntry.State terminal;

        Outcome(final OperationJournalEntry.State terminal) {
            this.terminal = terminal;
        }

        OperationJournalEntry.State toTerminal() {
            return terminal;
        }
    }
}
