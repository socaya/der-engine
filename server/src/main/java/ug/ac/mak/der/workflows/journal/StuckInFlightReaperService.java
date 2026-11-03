package ug.ac.mak.der.workflows.journal;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Phase 12.1 — continuous runtime reaper for IN_FLIGHT rows that
 * never completed their state transition.
 *
 * <p>{@link JournalInFlightReaperRunner} fires once at boot and
 * catches rows the previous process left behind. This service runs
 * every N minutes while DER is up and catches the steady-state
 * version of the same bug — a publisher thread died mid-publish,
 * or a DB transaction was rolled back after flipping to IN_FLIGHT
 * but before the terminal UPDATE committed. Without a runtime
 * reaper those rows sit IN_FLIGHT indefinitely (nothing's going to
 * crash and reboot DER if the host is healthy).</p>
 *
 * <p>The threshold is set wide enough that normal publishes don't
 * trip it: the longest legitimate IN_FLIGHT window is the tracker
 * async-job poll (30s per
 * {@link ug.ac.mak.der.workflows.journal.JournalPublisher}), so the
 * default 10 minute threshold leaves 20x headroom.</p>
 */
@Service
public class StuckInFlightReaperService {

    private static final Logger LOG = LoggerFactory.getLogger(StuckInFlightReaperService.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final Duration threshold;

    public StuckInFlightReaperService(final OperationJournalRepository journal,
                                        final SecurityAuditRepository audit,
                                        final Clock clock,
                                        @Value("${der.journal.inflight-threshold:PT10M}")
                                        final Duration threshold) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.threshold = Objects.requireNonNull(threshold, "threshold");
    }

    public int reapOnce() {
        final Instant cutoff = Instant.now(clock).minus(threshold);
        final int reaped = journal.requeueStuckInFlight(cutoff);
        if (reaped == 0) {
            LOG.debug("StuckInFlightReaperService: 0 rows past IN_FLIGHT threshold");
            return 0;
        }
        LOG.warn("StuckInFlightReaperService: requeued {} IN_FLIGHT row(s) "
                + "stuck longer than {} — publisher thread death or rolled-back drain tx",
                reaped, threshold);
        audit.append(new AuditEvent(
                "JOURNAL_INFLIGHT_STUCK_REAPED",
                AuditEvent.Outcome.SUCCESS,
                null, null, null, null,
                Map.of(
                        "rowsReaped", String.valueOf(reaped),
                        "thresholdSeconds", String.valueOf(threshold.getSeconds()))),
                Instant.now(clock));
        return reaped;
    }
}
