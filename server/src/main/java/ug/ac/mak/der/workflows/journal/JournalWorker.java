package ug.ac.mak.der.workflows.journal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Drains PENDING {@code operation_journal} rows to central. ADR-0010.
 */
@Service
public class JournalWorker {

    private static final Logger LOG = LoggerFactory.getLogger(JournalWorker.class);

    private final OperationJournalRepository journal;
    private final JournalPublisher publisher;
    private final JdbcTemplate jdbc;
    private final JournalWorkerConfig.JournalWorkerSettings settings;

    private volatile Instant lastTick;
    private volatile int lastBatchSize;

    public JournalWorker(final OperationJournalRepository journal,
                          final JournalPublisher publisher,
                          final JdbcTemplate jdbc,
                          final JournalWorkerConfig.JournalWorkerSettings settings) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.publisher = Objects.requireNonNull(publisher, "publisher");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.settings = Objects.requireNonNull(settings, "settings");
    }

    public DrainOutcome drainBatch() {
        lastTick = Instant.now();
        if (!settings.enabled().get()) {
            lastBatchSize = 0;
            return new DrainOutcome(0, 0, 0, 0, 0, Map.of(), List.of(), "disabled");
        }
        final List<OperationJournalEntry> pending =
                journal.findPendingReadyToDrain(settings.batchSize());
        lastBatchSize = pending.size();
        int accepted = 0;
        int rejected = 0;
        int retryable = 0;
        int conflicts = 0;
        final Map<String, Integer> byType = new LinkedHashMap<>();
        final List<UUID> operationIds = new ArrayList<>();
        for (final OperationJournalEntry entry : pending) {
            byType.merge(entry.entityType().name(), 1, Integer::sum);
            operationIds.add(entry.operationId());
            if (entry.state() != OperationJournalEntry.State.PENDING) {
                continue;
            }
            flipToInFlight(entry.operationId());
            final JournalPublisher.PublishResult result = publisher.publish(entry);
            switch (result.terminal()) {
                case ACCEPTED -> {
                    terminal(entry.operationId(), OperationJournalEntry.State.CENTRAL_ACCEPTED,
                            result);
                    accepted++;
                }
                case REJECTED -> {
                    terminal(entry.operationId(), OperationJournalEntry.State.CENTRAL_REJECTED,
                            result);
                    rejected++;
                }
                case CONFLICT -> {
                    terminal(entry.operationId(), OperationJournalEntry.State.CONFLICT_REVIEW,
                            result);
                    conflicts++;
                }
                case RETRYABLE -> {
                    retry(entry.operationId(), entry.attemptCount() + 1, result);
                    retryable++;
                }
                default -> throw new IllegalStateException("unknown terminal state: "
                        + result.terminal());
            }
        }
        return new DrainOutcome(pending.size(), accepted, rejected, retryable, conflicts,
                Map.copyOf(byType), List.copyOf(operationIds), null);
    }

    public Instant lastTick() {
        return lastTick;
    }

    public int lastBatchSize() {
        return lastBatchSize;
    }

    public void pause() {
        settings.enabled().set(false);
    }

    public void resume() {
        settings.enabled().set(true);
    }

    public boolean enabled() {
        return settings.enabled().get();
    }

    private void flipToInFlight(final java.util.UUID id) {
        jdbc.update("UPDATE der.operation_journal SET state = 'IN_FLIGHT', updated_at = now() "
                + "WHERE operation_id = ?", id);
    }

    private void terminal(final java.util.UUID id, final OperationJournalEntry.State state,
                           final JournalPublisher.PublishResult result) {
        jdbc.update("UPDATE der.operation_journal SET state = ?, updated_at = now(), "
                        + "last_error = ?, last_response = CAST(? AS jsonb) "
                        + "WHERE operation_id = ?",
                state.name(), result.body(), toLastResponse(result), id);
    }

    private void retry(final java.util.UUID id, final int newAttempt,
                        final JournalPublisher.PublishResult result) {
        final long backoffSeconds = computeBackoff(newAttempt);
        final Instant next = Instant.now().plusSeconds(backoffSeconds);
        jdbc.update("UPDATE der.operation_journal SET state = 'PENDING', "
                        + "attempt_count = ?, next_attempt_at = ?, last_error = ?, "
                        + "last_response = CAST(? AS jsonb), updated_at = now() "
                        + "WHERE operation_id = ?",
                newAttempt, java.sql.Timestamp.from(next), result.body(),
                toLastResponse(result), id);
    }

    long computeBackoff(final int attempt) {
        final long base = settings.backoffBaseSeconds();
        final long cap = settings.backoffCapSeconds();
        long seconds = base * (long) Math.pow(2, Math.max(0, attempt - 1));
        if (seconds <= 0 || seconds > cap) {
            seconds = cap;
        }
        final long jitter = Math.max(1L, seconds / 10L);
        return seconds + ThreadLocalRandom.current().nextLong(jitter);
    }

    private String toLastResponse(final JournalPublisher.PublishResult r) {
        return "{\"status\":" + r.status() + ",\"terminal\":\"" + r.terminal().name() + "\"}";
    }

    public record DrainOutcome(int picked, int accepted, int rejected, int retryable,
                                int conflicts, Map<String, Integer> byType,
                                List<UUID> operationIds, String note) {

        /** Legacy constructor retained for tests. byType + operationIds default to empty. */
        public DrainOutcome(final int picked, final int accepted, final int rejected,
                             final int retryable, final int conflicts, final String note) {
            this(picked, accepted, rejected, retryable, conflicts, Map.of(), List.of(), note);
        }
    }
}
