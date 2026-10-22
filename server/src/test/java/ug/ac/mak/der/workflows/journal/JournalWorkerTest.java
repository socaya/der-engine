package ug.ac.mak.der.workflows.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class JournalWorkerTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JournalWorkerConfig.JournalWorkerSettings settings(final boolean enabled) {
        return new JournalWorkerConfig.JournalWorkerSettings(
                new AtomicBoolean(enabled), 10, 30, 3600);
    }

    private OperationJournalEntry entry(final OperationJournalEntry.State state) {
        return new OperationJournalEntry(UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "x", mapper.createObjectNode(), state, 0, null, UUID.randomUUID(),
                Instant.now(), Instant.now());
    }

    @Test
    void disabledShortCircuits() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc, settings(false));
        final var out = worker.drainBatch();
        assertThat(out.note()).isEqualTo("disabled");
    }

    @Test
    void pausedAndResumed() {
        final JournalWorker worker = new JournalWorker(mock(OperationJournalRepository.class),
                mock(JournalPublisher.class), mock(JdbcTemplate.class), settings(true));
        worker.pause();
        assertThat(worker.enabled()).isFalse();
        worker.resume();
        assertThat(worker.enabled()).isTrue();
    }

    @Test
    void acceptedTransitions() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.PENDING)));
        when(pub.publish(any())).thenReturn(new JournalPublisher.PublishResult(200, "ok",
                JournalPublisher.TerminalState.ACCEPTED));
        final var out = new JournalWorker(journal, pub, jdbc, settings(true)).drainBatch();
        assertThat(out.accepted()).isEqualTo(1);
    }

    @Test
    void rejectedTransitions() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.PENDING)));
        when(pub.publish(any())).thenReturn(new JournalPublisher.PublishResult(400, "bad",
                JournalPublisher.TerminalState.REJECTED));
        final var out = new JournalWorker(journal, pub, mock(JdbcTemplate.class),
                settings(true)).drainBatch();
        assertThat(out.rejected()).isEqualTo(1);
    }

    @Test
    void conflictTransitions() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.PENDING)));
        when(pub.publish(any())).thenReturn(new JournalPublisher.PublishResult(409, "c",
                JournalPublisher.TerminalState.CONFLICT));
        final var out = new JournalWorker(journal, pub, mock(JdbcTemplate.class),
                settings(true)).drainBatch();
        assertThat(out.conflicts()).isEqualTo(1);
    }

    @Test
    void retryableBumpsAttempt() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.PENDING)));
        when(pub.publish(any())).thenReturn(new JournalPublisher.PublishResult(500, "server err",
                JournalPublisher.TerminalState.RETRYABLE));
        final var out = new JournalWorker(journal, pub, mock(JdbcTemplate.class),
                settings(true)).drainBatch();
        assertThat(out.retryable()).isEqualTo(1);
    }

    @Test
    void skipsNonPendingRows() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.IN_FLIGHT)));
        final var out = new JournalWorker(journal, mock(JournalPublisher.class),
                mock(JdbcTemplate.class), settings(true)).drainBatch();
        assertThat(out.accepted()).isEqualTo(0);
    }

    @Test
    void computeBackoffExponentialWithJitter() {
        final JournalWorker worker = new JournalWorker(mock(OperationJournalRepository.class),
                mock(JournalPublisher.class), mock(JdbcTemplate.class), settings(true));
        for (int attempt = 1; attempt <= 20; attempt++) {
            final long value = worker.computeBackoff(attempt);
            assertThat(value).isPositive();
        }
    }

    @Test
    void lastTickAndBatchSizeExposed() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(List.of());
        final JournalWorker worker = new JournalWorker(journal, mock(JournalPublisher.class),
                mock(JdbcTemplate.class), settings(true));
        worker.drainBatch();
        assertThat(worker.lastTick()).isNotNull();
        assertThat(worker.lastBatchSize()).isEqualTo(0);
    }
}
