package ug.ac.mak.der.workflows.journal;

import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Phase 11.1 — boot-time reaper for orphaned
 * {@code operation_journal} rows.
 *
 * <p>If the previous DER process was killed (SIGKILL, OOM, host
 * crash, pg restart with uncommitted drain tx) between the drain
 * worker flipping a row to {@code IN_FLIGHT} and marking the
 * terminal transition, the row stays {@code IN_FLIGHT} forever —
 * the drain worker's {@code WHERE state = 'PENDING'} scan never
 * sees it again. The row is effectively lost from the retry
 * lifecycle until an operator intervenes.</p>
 *
 * <p>Fires on {@link ApplicationReadyEvent} so Flyway + the
 * repository bean are up. Idempotent: a clean restart finds zero
 * orphans and no-ops. Each reap tick appends one
 * {@code JOURNAL_INFLIGHT_REAPED} audit event with the row count so
 * operators can see post-mortem exactly when a crash happened and
 * how many rows it affected.</p>
 */
@Component
public class JournalInFlightReaperRunner {

    private static final Logger LOG = LoggerFactory.getLogger(JournalInFlightReaperRunner.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;

    public JournalInFlightReaperRunner(final OperationJournalRepository journal,
                                         final SecurityAuditRepository audit) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void reapOnBoot() {
        final int reaped = journal.requeueOrphanedInFlight();
        if (reaped == 0) {
            LOG.debug("JournalInFlightReaperRunner: zero IN_FLIGHT rows at boot — clean start.");
            return;
        }
        LOG.warn("JournalInFlightReaperRunner: requeued {} orphaned IN_FLIGHT row(s) from "
                + "the previous DER process (SIGKILL, OOM, pg flap, or similar).", reaped);
        audit.append(new AuditEvent(
                "JOURNAL_INFLIGHT_REAPED",
                AuditEvent.Outcome.SUCCESS,
                null, null, null, null,
                Map.of("rowsReaped", String.valueOf(reaped))),
                java.time.Instant.now());
    }
}
