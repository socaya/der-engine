package ug.ac.mak.der.web;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * NFR-20: operator-visible health + last-successful-sync + queue size +
 * recent error summary. Pure read; any authenticated user.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/metrics",
        produces = MediaType.APPLICATION_JSON_VALUE)
@ConditionalOnBean(EdgeUserRepository.class)
public class OperatorMetricsController {

    private final ObjectProvider<OperationJournalRepository> journal;
    private final Clock clock;

    public OperatorMetricsController(final ObjectProvider<OperationJournalRepository> journal,
                                      final Clock clock) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * FR-14-10 / NFR-28: clock drift probe. Caller compares
     * `serverEpochMillis` against its local clock.
     */
    @GetMapping("/clock")
    public ResponseEntity<Map<String, Object>> clockProbe() {
        final Instant now = Instant.now(clock);
        return ResponseEntity.ok(Map.of(
                "serverTime", now.toString(),
                "serverEpochMillis", now.toEpochMilli(),
                "note", "Caller computes drift = abs(serverEpochMillis - callerEpochMillis). "
                        + "DER emits a WARN audit event when drift exceeds 60s."));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> metrics() {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("generatedAt", Instant.now(clock).toString());

        // Process metrics.
        final MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
        body.put("process", Map.of(
                "uptimeMillis", ManagementFactory.getRuntimeMXBean().getUptime(),
                "heapUsedMb", heap.getUsed() / (1024 * 1024),
                "heapCommittedMb", heap.getCommitted() / (1024 * 1024),
                "heapMaxMb", heap.getMax() / (1024 * 1024),
                "threadCount", ManagementFactory.getThreadMXBean().getThreadCount(),
                "availableProcessors", Runtime.getRuntime().availableProcessors()));

        // Queue / backlog metrics.
        final OperationJournalRepository jr = journal.getIfAvailable();
        if (jr != null) {
            final Map<String, Integer> byState = new LinkedHashMap<>();
            for (final OperationJournalEntry.State s : OperationJournalEntry.State.values()) {
                byState.put(s.name(), jr.countByState(s));
            }
            body.put("journal", byState);
            body.put("queueDepth", byState.getOrDefault(
                    OperationJournalEntry.State.PENDING.name(), 0)
                    + byState.getOrDefault(
                            OperationJournalEntry.State.RETRYABLE.name(), 0)
                    + byState.getOrDefault(
                            OperationJournalEntry.State.IN_FLIGHT.name(), 0));
        }
        return ResponseEntity.ok(body);
    }
}
