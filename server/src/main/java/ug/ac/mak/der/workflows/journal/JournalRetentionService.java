package ug.ac.mak.der.workflows.journal;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * FR-09-10 — scheduled journal retention. The repository already
 * supports the delete + the admin controller exposes a
 * {@code POST /journal/purge} endpoint operators can trigger on
 * demand; this service adds the scheduled drip-tick so a stable
 * appliance that nobody touches still drains its terminal rows at
 * the configured cadence.
 *
 * <p>Two policy knobs:
 * <ul>
 *   <li>{@code der.journal.retention-days} — days to retain terminal
 *     rows. Default 90.</li>
 *   <li>{@code der.journal.retention-cron} — cron expression for the
 *     sweep. Default {@code 0 15 4 * * *} (04:15 daily, offset from
 *     the compliance + Phase 5 app sweeps that run between 03:00
 *     and 03:45).</li>
 * </ul>
 *
 * <p>Every sweep emits a {@code JOURNAL_RETENTION_PURGE} audit event
 * with {@code source=SCHEDULED} in the detail map — the existing
 * admin-triggered path uses {@code source=OPERATOR} so the
 * evidence-export endpoint can distinguish the two drivers.</p>
 */
@Service
public class JournalRetentionService {

    private static final Logger LOG = LoggerFactory.getLogger(JournalRetentionService.class);

    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final int retentionDays;

    public JournalRetentionService(final OperationJournalRepository journal,
                                     final SecurityAuditRepository audit,
                                     final Clock clock,
                                     @Value("${der.journal.retention-days:90}")
                                         final int retentionDays) {
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${der.journal.retention-cron:0 15 4 * * *}")
    public void dailySweep() {
        try {
            sweepNow();
        } catch (RuntimeException ex) {
            LOG.warn("scheduled journal retention sweep failed: {}",
                    ex.getMessage());
        }
    }

    public int sweepNow() {
        final int days = Math.max(1, retentionDays);
        final Instant cutoff = Instant.now(clock).minus(days, ChronoUnit.DAYS);
        final int purged = journal.purgeTerminalBefore(cutoff);
        audit.append(new AuditEvent("JOURNAL_RETENTION_PURGE",
                AuditEvent.Outcome.SUCCESS, null, null, null, null,
                Map.of("source", "SCHEDULED",
                        "olderThanDays", String.valueOf(days),
                        "rowsPurged", String.valueOf(purged),
                        "cutoff", cutoff.toString())),
                Instant.now(clock));
        if (purged > 0) {
            LOG.info("journal retention swept {} terminal rows older than {} days",
                    purged, days);
        }
        return purged;
    }

    public int retentionDays() {
        return retentionDays;
    }
}
