package ug.ac.mak.der.dhis2emulator;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * DER-APPS-DHIS2-001 Phase 5e — daily sweep that drops terminal
 * {@code tracker_job} rows older than N days. V123's migration
 * comment noted 7-day retention as the design intent; this service
 * enforces it.
 *
 * <p>Pairs with {@link ug.ac.mak.der.apps.central.CentralAppSyncRunRetentionService}
 * — both run on a daily cron, offset from the Phase 5c
 * {@code AppVersionRetentionService} + the compliance sweep so no two
 * daily jobs hit the same tables concurrently.</p>
 */
@Service
public class TrackerJobRetentionService {

    private static final Logger LOG =
            LoggerFactory.getLogger(TrackerJobRetentionService.class);

    private final TrackerJobRepository repo;
    private final int retentionDays;

    public TrackerJobRetentionService(final TrackerJobRepository repo,
                                        @Value("${der.tracker.job-retention-days:7}")
                                            final int retentionDays) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.retentionDays = retentionDays;
    }

    /** Daily at 03:30 — 15 min after Phase 5c's app_version sweep,
     *  30 min after the compliance sweep at 03:00. */
    @Scheduled(cron = "${der.tracker.job-retention-cron:0 30 3 * * *}")
    public void dailySweep() {
        try {
            final int pruned = repo.pruneOlderThan(retentionDays);
            if (pruned > 0) {
                LOG.info("pruned {} terminal tracker_job rows older than {} days",
                        pruned, retentionDays);
            }
        } catch (RuntimeException ex) {
            LOG.warn("tracker_job retention sweep failed: {}", ex.getMessage());
        }
    }

    public int sweepNow() {
        return repo.pruneOlderThan(retentionDays);
    }

    public int retentionDays() {
        return retentionDays;
    }
}
