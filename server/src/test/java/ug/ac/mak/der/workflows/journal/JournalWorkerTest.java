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

import java.time.Clock;
import java.time.ZoneId;
import ug.ac.mak.der.network.CentralReachabilityGate;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

class JournalWorkerTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private JournalWorkerConfig.JournalWorkerSettings settings(final boolean enabled) {
        return new JournalWorkerConfig.JournalWorkerSettings(
                new AtomicBoolean(enabled),
                new java.util.concurrent.atomic.AtomicInteger(10),
                new java.util.concurrent.atomic.AtomicLong(30),
                new java.util.concurrent.atomic.AtomicLong(3600));
    }

    /** Default-reachable gate; tests that need OFFLINE build one directly. */
    private CentralReachabilityGate reachable() {
        return new CentralReachabilityGate(Clock.systemUTC());
    }

    private CentralReachabilityGate offlineGate() {
        final CentralReachabilityGate g = new CentralReachabilityGate(
                Clock.fixed(Instant.parse("2026-11-02T00:00:00Z"), ZoneId.of("UTC")));
        g.observe(false);
        g.observe(false);
        return g;
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
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc, settings(false), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class));
        final var out = worker.drainBatch();
        assertThat(out.note()).isEqualTo("disabled");
    }

    @Test
    void pausedAndResumed() {
        final JournalWorker worker = new JournalWorker(mock(OperationJournalRepository.class),
                mock(JournalPublisher.class), mock(JdbcTemplate.class), settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class));
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
        final var out = new JournalWorker(journal, pub, jdbc, settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class)).drainBatch();
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
                settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class)).drainBatch();
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
                settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class)).drainBatch();
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
                settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class)).drainBatch();
        assertThat(out.retryable()).isEqualTo(1);
    }

    @Test
    void skipsNonPendingRows() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(
                List.of(entry(OperationJournalEntry.State.IN_FLIGHT)));
        final var out = new JournalWorker(journal, mock(JournalPublisher.class),
                mock(JdbcTemplate.class), settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class)).drainBatch();
        assertThat(out.accepted()).isEqualTo(0);
    }

    @Test
    void computeBackoffExponentialWithJitter() {
        final JournalWorker worker = new JournalWorker(mock(OperationJournalRepository.class),
                mock(JournalPublisher.class), mock(JdbcTemplate.class), settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class));
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
                mock(JdbcTemplate.class), settings(true), reachable(), mock(ug.ac.mak.der.observability.DerMetrics.class));
        worker.drainBatch();
        assertThat(worker.lastTick()).isNotNull();
        assertThat(worker.lastBatchSize()).isEqualTo(0);
    }

    @Test
    void shortCircuitsWhenReachabilityGateReportsOffline() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc, settings(true),
                offlineGate(), mock(ug.ac.mak.der.observability.DerMetrics.class));
        final var out = worker.drainBatch();
        assertThat(out.note()).isEqualTo("skipped: central unreachable");
        assertThat(out.picked()).isZero();
        assertThat(worker.skippedUnreachableTotal()).isEqualTo(1);
        // The drain path must not query the repository or call the
        // publisher when central is OFFLINE — the whole point of the
        // short-circuit.
        org.mockito.Mockito.verifyNoInteractions(pub);
        org.mockito.Mockito.verify(journal, org.mockito.Mockito.never())
                .findPendingReadyToDrain(anyInt());
    }

    // ---- FR-05-10/11/12 drift guard --------------------------------

    private static ug.ac.mak.der.metadata.MetadataDriftDetector
            detectorYielding(final boolean drift) {
        final var detector = mock(ug.ac.mak.der.metadata.MetadataDriftDetector.class);
        final var report = mock(
                ug.ac.mak.der.metadata.MetadataDriftDetector.DriftReport.class);
        when(report.hasDrift()).thenReturn(drift);
        when(report.summary()).thenReturn(
                drift ? "missing dataElement=DE_X" : "ok");
        when(detector.evaluate(any())).thenReturn(report);
        return detector;
    }

    @Test
    void driftGuardQuarantinesPendingEntryBeforePublish() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final var audit = mock(ug.ac.mak.der.security.SecurityAuditRepository.class);
        final var drifted = entry(OperationJournalEntry.State.PENDING);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(List.of(drifted));
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc,
                settings(true), reachable(),
                mock(ug.ac.mak.der.observability.DerMetrics.class));
        worker.setDriftDetector(detectorYielding(true));
        worker.setAuditRepository(audit);
        worker.setDriftGuardEnabled(true);
        final var out = worker.drainBatch();
        assertThat(out.conflicts()).isEqualTo(1);
        assertThat(worker.driftQuarantinedTotal()).isEqualTo(1);
        verify(journal).quarantine(drifted.operationId(),
                "METADATA_DRIFT: missing dataElement=DE_X");
        // Publisher is NOT called for a drifted entry.
        org.mockito.Mockito.verifyNoInteractions(pub);
        verify(audit).append(org.mockito.ArgumentMatchers.argThat(
                (ug.ac.mak.der.security.AuditEvent e) ->
                        "METADATA_DRIFT_QUARANTINED".equals(e.eventType())),
                any());
    }

    @Test
    void driftGuardDisabledLetsEntryPublish() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final var e = entry(OperationJournalEntry.State.PENDING);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(List.of(e));
        when(pub.publish(any())).thenReturn(
                new JournalPublisher.PublishResult(202, "{}",
                        JournalPublisher.TerminalState.ACCEPTED));
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc,
                settings(true), reachable(),
                mock(ug.ac.mak.der.observability.DerMetrics.class));
        // Detector would yell drift, but the guard is OFF.
        worker.setDriftDetector(detectorYielding(true));
        worker.setDriftGuardEnabled(false);
        worker.drainBatch();
        // No quarantine; publisher invoked.
        verify(journal, org.mockito.Mockito.never()).quarantine(any(), any());
        verify(pub).publish(any());
    }

    @Test
    void driftGuardCleanEntryFlowsToPublishAsBefore() {
        final OperationJournalRepository journal = mock(OperationJournalRepository.class);
        final JournalPublisher pub = mock(JournalPublisher.class);
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final var e = entry(OperationJournalEntry.State.PENDING);
        when(journal.findPendingReadyToDrain(anyInt())).thenReturn(List.of(e));
        when(pub.publish(any())).thenReturn(
                new JournalPublisher.PublishResult(202, "{}",
                        JournalPublisher.TerminalState.ACCEPTED));
        final JournalWorker worker = new JournalWorker(journal, pub, jdbc,
                settings(true), reachable(),
                mock(ug.ac.mak.der.observability.DerMetrics.class));
        worker.setDriftDetector(detectorYielding(false));
        final var out = worker.drainBatch();
        assertThat(out.accepted()).isEqualTo(1);
        assertThat(worker.driftQuarantinedTotal()).isZero();
        verify(journal, org.mockito.Mockito.never()).quarantine(any(), any());
        verify(pub).publish(any());
    }
}
