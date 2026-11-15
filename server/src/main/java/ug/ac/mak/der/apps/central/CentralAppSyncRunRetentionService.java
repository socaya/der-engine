package ug.ac.mak.der.apps.central;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * DER-APPS-DHIS2-001 Phase 5e — daily sweep for
 * {@code app_central_sync_run}. V124's design intent is 90-day
 * retention so operators can still dig into "what changed last
 * quarter?" when a facility surfaces a complaint.
 *
 * <p>Pairs with {@link ug.ac.mak.der.dhis2emulator.TrackerJobRetentionService}
 * — both run on a daily cron, offset from Phase 5c's version sweep
 * + the compliance sweep so no two daily jobs hit the same tables
 * concurrently.</p>
 */
@Service
public class CentralAppSyncRunRetentionService {

    private static final Logger LOG =
            LoggerFactory.getLogger(CentralAppSyncRunRetentionService.class);

    private final CentralAppSyncRunRepository repo;
    private final int retentionDays;

    public CentralAppSyncRunRetentionService(
            final CentralAppSyncRunRepository repo,
            @Value("${der.apps.central-sync.run-retention-days:90}")
                final int retentionDays) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.retentionDays = retentionDays;
    }

    /** Daily at 03:45 — after both the tracker_job sweep (03:30)
     *  and the version sweep (03:15). */
    @Scheduled(cron = "${der.apps.central-sync.run-retention-cron:0 45 3 * * *}")
    public void dailySweep() {
        try {
            final int pruned = repo.pruneOlderThan(retentionDays);
            if (pruned > 0) {
                LOG.info("pruned {} app_central_sync_run rows older than {} days",
                        pruned, retentionDays);
            }
        } catch (RuntimeException ex) {
            LOG.warn("app_central_sync_run retention sweep failed: {}",
                    ex.getMessage());
        }
    }

    public int sweepNow() {
        return repo.pruneOlderThan(retentionDays);
    }

    public int retentionDays() {
        return retentionDays;
    }
}
