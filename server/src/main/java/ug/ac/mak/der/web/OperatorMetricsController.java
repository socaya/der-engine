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

import ug.ac.mak.der.scheduler.ScheduledJobRepository;
import ug.ac.mak.der.scheduler.ScheduledJobRun;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeSessionRepository;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.SecurityProperties;
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

    /** NFR-28 legacy constant — kept for test + JSON back-compat. The
     *  live threshold now reads from
     *  {@code der.security.clock-drift.unsafe-drift-millis}. */
    static final long UNSAFE_DRIFT_MILLIS = 60_000L;

    private final ObjectProvider<OperationJournalRepository> journal;
    private final ObjectProvider<ScheduledJobRepository> scheduledJobs;
    private final SecurityAuditRepository audit;
    private final ObjectProvider<EdgeSessionRepository> sessionsProvider;
    private final ObjectProvider<SecurityProperties> propsProvider;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public OperatorMetricsController(final ObjectProvider<OperationJournalRepository> journal,
                                      final ObjectProvider<ScheduledJobRepository> scheduledJobs,
                                      final SecurityAuditRepository audit,
                                      final ObjectProvider<EdgeSessionRepository> sessionsProvider,
                                      final ObjectProvider<SecurityProperties> propsProvider,
                                      final Clock clock) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.scheduledJobs = Objects.requireNonNull(scheduledJobs, "scheduledJobs");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.sessionsProvider = sessionsProvider;
        this.propsProvider = propsProvider;
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** Pre-FR-02-10 ctor — Phase 2 tests still call this. */
    public OperatorMetricsController(final ObjectProvider<OperationJournalRepository> journal,
                                      final ObjectProvider<ScheduledJobRepository> scheduledJobs,
                                      final SecurityAuditRepository audit,
                                      final Clock clock) {
        this(journal, scheduledJobs, audit, null, null, clock);
    }

    private long unsafeThreshold() {
        final SecurityProperties props = propsProvider == null ? null
                : propsProvider.getIfAvailable();
        return props == null ? UNSAFE_DRIFT_MILLIS
                : props.clockDrift().unsafeDriftMillis();
    }

    private SecurityProperties.ClockDrift.UnsafeAction unsafeAction() {
        final SecurityProperties props = propsProvider == null ? null
                : propsProvider.getIfAvailable();
        return props == null
                ? SecurityProperties.ClockDrift.UnsafeAction.WARN_ONLY
                : props.clockDrift().onUnsafe();
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
        final long threshold = unsafeThreshold();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("serverTime", now.toString());
        body.put("serverEpochMillis", now.toEpochMilli());
        body.put("serverTimeZone", clock.getZone().getId());
        body.put("systemTimeZone", ZoneId.systemDefault().getId());
        body.put("unsafeDriftMillis", threshold);
        body.put("unsafeAction", unsafeAction().name());
        body.put("note", "Caller computes drift = abs(serverEpochMillis - callerEpochMillis). "
                + "Report drift > unsafeDriftMillis via POST /clock/report.");
        return ResponseEntity.ok(body);
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
        final long threshold = unsafeThreshold();
        final boolean unsafe = drift > threshold;
        boolean sessionRevoked = false;
        int sessionsRevoked = 0;
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
            // FR-02-10 fail-safe. The warn audit above is NFR-28's
            // telemetry; this is the separate FR-02-10 decision —
            // kill the session so a device with bad time can't keep
            // making expiry-sensitive calls.
            final SecurityProperties.ClockDrift.UnsafeAction action = unsafeAction();
            final EdgeSessionRepository sessions =
                    sessionsProvider == null ? null : sessionsProvider.getIfAvailable();
            if (action != SecurityProperties.ClockDrift.UnsafeAction.WARN_ONLY
                    && sessions != null) {
                final Instant now = Instant.now(clock);
                if (action == SecurityProperties.ClockDrift.UnsafeAction.REVOKE_SESSION) {
                    sessions.revoke(principal.session().sessionId(), now);
                    sessionRevoked = true;
                    sessionsRevoked = 1;
                } else if (action == SecurityProperties.ClockDrift.UnsafeAction.REVOKE_ALL_FOR_USER) {
                    sessionsRevoked = sessions.revokeAllForUser(
                            principal.userId(), now);
                    sessionRevoked = sessionsRevoked > 0;
                }
                if (sessionRevoked) {
                    audit.append(new AuditEvent("CLOCK_DRIFT_SESSION_REVOKED",
                            AuditEvent.Outcome.DENIED,
                            principal.userId(), principal.userId(),
                            null, null,
                            Map.of(
                                    "driftMillis", String.valueOf(drift),
                                    "action", action.name(),
                                    "sessionsRevoked", String.valueOf(sessionsRevoked))),
                            now);
                }
            }
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("driftMillis", drift);
        out.put("unsafe", unsafe);
        out.put("serverEpochMillis", serverMs);
        out.put("unsafeDriftMillis", threshold);
        out.put("sessionRevoked", sessionRevoked);
        return ResponseEntity.ok(out);
    }

    public record ClockReport(
            @JsonProperty("callerEpochMillis") Long callerEpochMillis,
            @JsonProperty("callerTimeZone") String callerTimeZone) { }

    /**
     * NFR-20 — operator-visible metrics.
     *
     * <p>The response is the authoritative source of the operator
     * dashboard. The following keys are the NFR-20 contract and
     * MUST stay present (missing a required key is a regression —
     * guarded by OperatorMetricsControllerTest#contractShape):</p>
     *
     * <ul>
     *   <li>{@code health.status} — "UP" when the queue sampler can read
     *       the journal, otherwise "DEGRADED"</li>
     *   <li>{@code lastSuccessfulSyncAt} — ISO-8601 instant of the most
     *       recent SUCCESS in {@code scheduled_job_run}, or null when
     *       no successful sync has run on this edge</li>
     *   <li>{@code queueDepth} — PENDING + RETRYABLE + IN_FLIGHT, scalar</li>
     *   <li>{@code rejections} — CENTRAL_REJECTED count, scalar</li>
     *   <li>{@code conflicts} — CONFLICT_REVIEW count, scalar</li>
     *   <li>{@code journal} — map of every operator-visible state → count</li>
     *   <li>{@code process} — uptime, heap, thread, processor counts</li>
     * </ul>
     */
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
        boolean journalHealthy = false;
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
            // NFR-20 contract fields — surfaced at the top level so the
            // dashboard doesn't have to hunt them inside journal.
            body.put("rejections", byState.getOrDefault(
                    OperationJournalEntry.State.CENTRAL_REJECTED.name(), 0));
            body.put("conflicts", byState.getOrDefault(
                    OperationJournalEntry.State.CONFLICT_REVIEW.name(), 0));
            journalHealthy = true;
        } else {
            body.put("journal", Map.of());
            body.put("queueDepth", 0);
            body.put("rejections", 0);
            body.put("conflicts", 0);
        }

        // Last-successful-sync — hunts scheduled_job_run for the most
        // recent SUCCESS. Null on a fresh install.
        final ScheduledJobRepository sjr = scheduledJobs.getIfAvailable();
        String lastOk = null;
        if (sjr != null) {
            lastOk = sjr.findLastSuccessful()
                    .map(ScheduledJobRun::startedAt)
                    .map(Instant::toString)
                    .orElse(null);
        }
        body.put("lastSuccessfulSyncAt", lastOk);

        // Health is derived — UP when the journal is reachable, DEGRADED
        // when it isn't (so the operator dashboard can show a status
        // badge without round-tripping to /system/health separately).
        body.put("health", Map.of("status", journalHealthy ? "UP" : "DEGRADED"));

        return ResponseEntity.ok(body);
    }
}
