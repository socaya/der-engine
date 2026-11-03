package ug.ac.mak.der.workflows.referral;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.observability.DerMetrics;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository.ReferralOutstandingRow;

/**
 * Phase 10.3.2 — one-shot escalation for referrals the destination
 * hasn't acked within the configured window.
 *
 * <p>The scheduled {@code ReferralEscalationJob} calls
 * {@link #escalateOnce()} every tick. One tick:</p>
 * <ol>
 *   <li>Scan {@link OperationJournalRepository#findOutstandingReferralsPastDue}
 *     for referral rows older than {@code der.referral.escalation.threshold}
 *     (default 30 minutes).</li>
 *   <li>For each row: append one {@code REFERRAL_UNDELIVERED} audit
 *     event carrying the operation id + next-hop OU, then stamp
 *     {@code referral_escalated_at} so the next tick skips it.</li>
 * </ol>
 *
 * <p>Keeping the "escalate at most once per row" invariant in the
 * repository (atomic UPDATE with WHERE referral_escalated_at IS
 * NULL) means a concurrent escalation + ack race ends with
 * exactly one of {ack, escalation} winning per row. The partial
 * index from V084 keeps the scan cheap even on large journals.</p>
 */
@Service
public class ReferralEscalationService {

    private static final Logger LOG = LoggerFactory.getLogger(ReferralEscalationService.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final Duration threshold;
    private final int batchLimit;
    private final DerMetrics metrics;

    public ReferralEscalationService(final OperationJournalRepository journal,
                                        final SecurityAuditRepository audit,
                                        final Clock clock,
                                        @Value("${der.referral.escalation.threshold:PT30M}")
                                        final Duration threshold,
                                        @Value("${der.referral.escalation.batch:100}")
                                        final int batchLimit,
                                        final DerMetrics metrics) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.threshold = Objects.requireNonNull(threshold, "threshold");
        this.batchLimit = Math.max(1, batchLimit);
        this.metrics = Objects.requireNonNull(metrics, "metrics");
    }

    public EscalationReport escalateOnce() {
        final Instant now = Instant.now(clock);
        final Instant cutoff = now.minus(threshold);
        final List<ReferralOutstandingRow> rows =
                journal.findOutstandingReferralsPastDue(cutoff, batchLimit);
        int escalated = 0;
        int skipped = 0;
        for (final ReferralOutstandingRow row : rows) {
            final int updated = journal.markReferralEscalated(row.operationId(), now);
            if (updated == 0) {
                /* Lost the race — someone else (ack endpoint or
                 * another escalation ticker) touched the row
                 * between the scan and the UPDATE. Safe no-op. */
                skipped++;
                continue;
            }
            audit.append(new AuditEvent(
                    "REFERRAL_UNDELIVERED",
                    AuditEvent.Outcome.SUCCESS,
                    null, null, null, null,
                    Map.of(
                            "operationId", row.operationId().toString(),
                            "nextHopOrgUnit", row.nextHopOrgUnitUid(),
                            "updatedAt", row.updatedAt().toString(),
                            "escalatedAt", now.toString(),
                            "thresholdSeconds", String.valueOf(threshold.getSeconds()))),
                    now);
            escalated++;
        }
        if (escalated + skipped > 0) {
            LOG.info("ReferralEscalation: escalated={}, race-skipped={}",
                    escalated, skipped);
        }
        metrics.referralEscalated(escalated);
        return new EscalationReport(rows.size(), escalated, skipped);
    }

    /** One scan tick's outcome; wired into the admin UI via the
     *  scheduled_job_run detail JSON. */
    public record EscalationReport(int scanned, int escalated, int raceSkipped) { }
}
