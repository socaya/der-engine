package ug.ac.mak.der.web;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryUsage;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * NFR-20: operator-visible health + last-successful-sync + queue size +
 * recent error summary. Pure read; any authenticated user.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/metrics",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class OperatorMetricsController {

    /** NFR-28: drift above this threshold is "unsafe" — emits an audit
     *  event and surfaces to the operator in-UI. 60s matches the
     *  tolerance Central DHIS2 allows on pushed submissions. */
    static final long UNSAFE_DRIFT_MILLIS = 60_000L;

    private final ObjectProvider<OperationJournalRepository> journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;

    public OperatorMetricsController(final ObjectProvider<OperationJournalRepository> journal,
                                      final SecurityAuditRepository audit,
                                      final Clock clock) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * FR-14-10 / NFR-28: clock + time-zone probe.
     *
     * <p>Response discloses both the server's current instant (so the
     * caller can compute drift) and its configured time zone + the
     * operating-system time-zone ID (so the caller can detect a
     * mis-configured JVM that's running in UTC while the host is on
     * Africa/Kampala). ADR-0003: DER documents these as the two
     * authoritative time sources — operators should not depend on
     * either their browser's clock or the DHIS2 Central clock.</p>
     */
    @GetMapping("/clock")
    public ResponseEntity<Map<String, Object>> clockProbe() {
        final Instant now = Instant.now(clock);
        return ResponseEntity.ok(Map.of(
                "serverTime", now.toString(),
                "serverEpochMillis", now.toEpochMilli(),
                "serverTimeZone", clock.getZone().getId(),
                "systemTimeZone", ZoneId.systemDefault().getId(),
                "unsafeDriftMillis", UNSAFE_DRIFT_MILLIS,
                "note", "Caller computes drift = abs(serverEpochMillis - callerEpochMillis). "
                        + "Report drift > unsafeDriftMillis via POST /clock/report."));
    }

    /**
     * NFR-28: drift-report sink. Caller POSTs its local epoch-millis
     * (+ optional time-zone) and the server records a CLOCK_DRIFT_WARN
     * audit event when the absolute drift exceeds UNSAFE_DRIFT_MILLIS.
     * Benign drift (within tolerance) succeeds silently so the UI can
     * ping this endpoint on page load without filling the audit log.
     */
    @PostMapping(path = "/clock/report", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> clockReport(
            final Authentication authentication,
            @RequestBody(required = false) final ClockReport body) {
        if (body == null || body.callerEpochMillis() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "CLOCK_REPORT_INVALID",
                    "message", "callerEpochMillis is required"));
        }
        final long serverMs = Instant.now(clock).toEpochMilli();
        final long drift = Math.abs(serverMs - body.callerEpochMillis());
        final boolean unsafe = drift > UNSAFE_DRIFT_MILLIS;
        if (unsafe && authentication instanceof EdgeUserPrincipal principal) {
            final Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("driftMillis", String.valueOf(drift));
            detail.put("serverEpochMillis", String.valueOf(serverMs));
            detail.put("callerEpochMillis", String.valueOf(body.callerEpochMillis()));
            if (body.callerTimeZone() != null) {
                detail.put("callerTimeZone", body.callerTimeZone());
            }
            audit.append(new AuditEvent("CLOCK_DRIFT_WARN",
                    AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                    detail),
                    Instant.now(clock));
        }
        return ResponseEntity.ok(Map.of(
                "driftMillis", drift,
                "unsafe", unsafe,
                "serverEpochMillis", serverMs,
                "unsafeDriftMillis", UNSAFE_DRIFT_MILLIS));
    }

    public record ClockReport(
            @JsonProperty("callerEpochMillis") Long callerEpochMillis,
            @JsonProperty("callerTimeZone") String callerTimeZone) { }

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
