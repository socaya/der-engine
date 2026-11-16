package ug.ac.mak.der.security;

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

/**
 * FR-02-10 — scheduled reclaim of expired session rows.
 *
 * <p>Sessions are strictly bounded by {@code expires_at} (no grace
 * window — pinned by {@code EdgeSessionTest}). Every request that
 * presents an expired cookie is already rejected at
 * {@link SessionValidationService}, but the row stays in
 * {@code der.edge_session} until it's reclaimed. This worker does
 * the reclaim so the table doesn't grow unbounded on a long-running
 * appliance.</p>
 *
 * <p>Schedule: daily at 04:45 UTC, offset from the 04:15 journal
 * retention sweep and 05:00 backup integrity probe. Retention
 * window defaults to 7 days post-expiry — long enough that an
 * operator investigating a sign-out complaint can still find the
 * row, short enough that the table stays small.</p>
 */
@Service
public class ExpiredSessionPurgeService {

    private static final Logger LOG =
            LoggerFactory.getLogger(ExpiredSessionPurgeService.class);

    private final EdgeSessionRepository sessions;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final int retentionDays;

    public ExpiredSessionPurgeService(final EdgeSessionRepository sessions,
                                        final SecurityAuditRepository audit,
                                        final Clock clock,
                                        @Value("${der.security.session.expired-retention-days:7}")
                                            final int retentionDays) {
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${der.security.session.purge-cron:0 45 4 * * *}")
    public void dailySweep() {
        try {
            sweepNow();
        } catch (final RuntimeException ex) {
            LOG.warn("scheduled expired-session purge failed: {}",
                    ex.getMessage());
        }
    }

    public int sweepNow() {
        return sweep("SCHEDULED");
    }

    public int runNow() {
        return sweep("OPERATOR");
    }

    private int sweep(final String source) {
        final int days = Math.max(1, retentionDays);
        final Instant cutoff = Instant.now(clock).minus(days, ChronoUnit.DAYS);
        final int purged = sessions.purgeExpiredBefore(cutoff);
        audit.append(new AuditEvent("SESSION_EXPIRED_PURGE",
                AuditEvent.Outcome.SUCCESS, null, null, null, null,
                Map.of("source", source,
                        "olderThanDays", String.valueOf(days),
                        "rowsPurged", String.valueOf(purged),
                        "cutoff", cutoff.toString())),
                Instant.now(clock));
        if (purged > 0) {
            LOG.info("purged {} expired sessions older than {} days",
                    purged, days);
        }
        return purged;
    }

    public int retentionDays() {
        return retentionDays;
    }
}
