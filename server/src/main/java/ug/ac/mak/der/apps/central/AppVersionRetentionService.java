package ug.ac.mak.der.apps.central;

import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.apps.AppCatalogueRepository;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-006 — daily sweep that drops
 * {@code installed_app_version} rows superseded more than N days ago.
 *
 * <p>The retention window is 7 days by default — long enough that an
 * admin who sees a bad auto-sync replace a customised app on Monday
 * morning still has until the following Monday to roll it back, but
 * short enough that {@code bundle_bytes} doesn't accumulate every
 * central-sync version forever.</p>
 */
@Service
public class AppVersionRetentionService {

    private static final Logger LOG =
            LoggerFactory.getLogger(AppVersionRetentionService.class);

    private final AppCatalogueRepository repo;
    private final int retentionDays;

    public AppVersionRetentionService(final AppCatalogueRepository repo,
                                        @Value("${der.apps.version-retention-days:7}")
                                            final int retentionDays) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.retentionDays = retentionDays;
    }

    /** Run at 03:15 daily — offset from the compliance sweep at 03:00
     *  so the two don't contend on the same tables. */
    @Scheduled(cron = "${der.apps.version-retention-cron:0 15 3 * * *}")
    public void dailySweep() {
        try {
            final int pruned = repo.pruneSupersededVersions(retentionDays);
            if (pruned > 0) {
                LOG.info("pruned {} superseded installed_app_version rows "
                        + "older than {} days", pruned, retentionDays);
            }
        } catch (RuntimeException ex) {
            LOG.warn("app_version retention sweep failed: {}", ex.getMessage());
        }
    }

    /** Admin-callable trigger for the same sweep. */
    public int sweepNow() {
        return repo.pruneSupersededVersions(retentionDays);
    }

    public int retentionDays() {
        return retentionDays;
    }
}
