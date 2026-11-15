package ug.ac.mak.der.apps.central;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.apps.AppCatalogueController;
import ug.ac.mak.der.apps.InstalledApp;
import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-001..003, FR-SYNC-005, FR-SYNC-007 —
 * central app auto-sync.
 *
 * <p>Runs on a fixed schedule (default every 6 h) and on explicit
 * admin trigger. For every central app discovered, decides:
 * <ul>
 *   <li>NEW — not locally installed → install</li>
 *   <li>UPDATE — locally installed with a different version → install
 *       (the underlying installer upserts)</li>
 *   <li>SKIP — version matches local</li>
 * </ul>
 * When {@code dryRun=true} the loop stops at the decision step, so
 * admins can preview what the next real run would do before enabling
 * auto-sync on a tenant. See {@link CentralAppSyncRunRepository} for
 * the per-run audit row.</p>
 *
 * <p>When the sync job runs on its scheduled cadence (no admin
 * principal) the {@code triggeredBy} column is null and the audit
 * event's actor stays null — signalling "system job" in log analysis.
 * </p>
 */
@Service
public class CentralAppSyncService {

    private static final Logger LOG = LoggerFactory.getLogger(CentralAppSyncService.class);

    private final CentralAppClient client;
    private final AppCatalogueController catalogue;
    private final InstalledAppRepository installedApps;
    private final CentralAppSyncRunRepository runs;
    private final SecurityAuditRepository audit;
    private final CentralSyncPolicyService policies;
    private final boolean enabled;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public CentralAppSyncService(final CentralAppClient client,
                                   final AppCatalogueController catalogue,
                                   final InstalledAppRepository installedApps,
                                   final CentralAppSyncRunRepository runs,
                                   final SecurityAuditRepository audit,
                                   final CentralSyncPolicyService policies,
                                   @Value("${der.apps.central-sync.enabled:false}")
                                       final boolean enabled) {
        this.client = Objects.requireNonNull(client, "client");
        this.catalogue = Objects.requireNonNull(catalogue, "catalogue");
        this.installedApps = Objects.requireNonNull(installedApps, "installedApps");
        this.runs = Objects.requireNonNull(runs, "runs");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.policies = Objects.requireNonNull(policies, "policies");
        this.enabled = enabled;
    }

    /** Scheduled entry point. Default cadence is 6 h; configurable via
     *  {@code der.apps.central-sync.interval-ms}. Disabled by default
     *  so tests + fresh appliances don't try to reach a central that
     *  isn't configured. */
    @Scheduled(fixedDelayString = "${der.apps.central-sync.interval-ms:21600000}",
            initialDelayString = "${der.apps.central-sync.initial-delay-ms:600000}")
    public void runOnSchedule() {
        if (!enabled) {
            return;
        }
        try {
            sync(false, null);
        } catch (RuntimeException ex) {
            LOG.warn("scheduled app sync failed: {}", ex.getMessage());
        }
    }

    public SyncReport sync(final boolean dryRun, final UUID triggeredBy) {
        if (!running.compareAndSet(false, true)) {
            return new SyncReport(null, "SKIPPED",
                    "another sync run is already in progress",
                    CentralAppSyncRunRepository.SyncCounters.zero(), List.of());
        }
        final UUID runId = runs.insertStarted(dryRun, triggeredBy);
        try {
            return doSync(runId, dryRun, triggeredBy);
        } catch (RuntimeException ex) {
            // Any un-caught runtime leaves the run row RUNNING forever
            // unless we close it out here. Record it as FAILED so the
            // admin diagnostic stays coherent.
            final var counters = CentralAppSyncRunRepository.SyncCounters.zero();
            final String msg = ex.getClass().getSimpleName()
                    + ": " + (ex.getMessage() == null ? "" : ex.getMessage());
            runs.markComplete(runId, "FAILED", msg, counters, List.of());
            LOG.warn("central sync run {} failed hard: {}", runId, msg);
            return new SyncReport(runId, "FAILED", msg, counters, List.of());
        } finally {
            running.set(false);
        }
    }

    private SyncReport doSync(final UUID runId,
                                final boolean dryRun,
                                final UUID triggeredBy) {
        if (!client.centralConfigured()) {
            final var counters = CentralAppSyncRunRepository.SyncCounters.zero();
            runs.markComplete(runId, "SKIPPED",
                    "central base-url is not configured", counters, List.of());
            return new SyncReport(runId, "SKIPPED",
                    "central base-url is not configured", counters, List.of());
        }
        final List<CentralApp> discovered;
        try {
            discovered = client.listApps();
        } catch (IOException ex) {
            final var counters = CentralAppSyncRunRepository.SyncCounters.zero();
            runs.markComplete(runId, "FAILED",
                    "central /api/apps I/O: " + ex.getMessage(),
                    counters, List.of());
            return new SyncReport(runId, "FAILED",
                    ex.getMessage(), counters, List.of());
        }
        final CentralSyncPolicy policy = policies.read();
        int installed = 0;
        int updated = 0;
        int skipped = 0;
        int failed = 0;
        final List<CentralAppSyncRunRepository.CandidateDetail> details =
                new ArrayList<>();
        for (final CentralApp app : discovered) {
            if (app == null || app.key() == null || app.key().isBlank()) {
                continue;
            }
            final Optional<InstalledApp> local = installedApps.findByKey(app.key());
            final String localVersion = local.map(InstalledApp::version).orElse(null);
            // FR-SYNC-004 — allow/deny-list filter runs before the
            // version diff so blocked candidates never land in detail
            // as "would install" (which is noisy and misleading).
            if (!policy.admits(app.key())) {
                skipped++;
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion,
                        "SKIP", policy.rejectionReason(), null));
                continue;
            }
            final String action = decideAction(local, app);
            if ("SKIP".equals(action)) {
                skipped++;
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion,
                        "SKIP", "version matches local", null));
                continue;
            }
            if (dryRun) {
                // Dry-run — count the candidate as if we'd install.
                if ("INSTALL".equals(action)) {
                    installed++;
                } else {
                    updated++;
                }
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion, action,
                        "dry-run — not installed", null));
                continue;
            }
            // Live install.
            if (app.downloadUrl() == null || app.downloadUrl().isBlank()) {
                failed++;
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion, action,
                        "central did not provide a downloadUrl", null));
                continue;
            }
            try {
                final byte[] bytes = client.fetchBundle(app.downloadUrl());
                final String sha = sha256Hex(bytes);
                final Map<String, Object> result =
                        catalogue.installZipBytesForSync(bytes, app.key(), triggeredBy);
                final String installedVersion = (String) result.get("version");
                if ("INSTALL".equals(action)) {
                    installed++;
                } else {
                    updated++;
                }
                audit.append(new AuditEvent(
                        "APP_INSTALLED_FROM_CENTRAL",
                        AuditEvent.Outcome.SUCCESS,
                        triggeredBy, null, null, null,
                        Map.of(
                                "centralAppId", app.key(),
                                "version", installedVersion == null ? "" : installedVersion,
                                "sha256", sha,
                                "action", action)),
                        java.time.Instant.now());
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion, action,
                        "installed", sha));
            } catch (IOException | AppCatalogueController.ValidationFailure ex) {
                failed++;
                details.add(new CentralAppSyncRunRepository.CandidateDetail(
                        app.key(), app.version(), localVersion, action,
                        truncateReason(ex), null));
            }
        }
        final var counters = new CentralAppSyncRunRepository.SyncCounters(
                discovered.size(), installed, updated, skipped, failed);
        final String outcome = failed == 0 ? "OK"
                : (installed + updated > 0 ? "PARTIAL" : "FAILED");
        final String msg = dryRun
                ? "dry-run: " + discovered.size() + " discovered"
                : discovered.size() + " discovered, " + installed + " installed, "
                        + updated + " updated, " + skipped + " skipped, "
                        + failed + " failed";
        runs.markComplete(runId, outcome, msg, counters, details);
        return new SyncReport(runId, outcome, msg, counters, details);
    }

    private static String decideAction(final Optional<InstalledApp> local,
                                         final CentralApp central) {
        if (local.isEmpty()) {
            return "INSTALL";
        }
        if (local.get().version().equals(central.version())) {
            return "SKIP";
        }
        return "UPDATE";
    }

    private static String truncateReason(final Exception ex) {
        final String msg = ex.getClass().getSimpleName() + ": "
                + (ex.getMessage() == null ? "" : ex.getMessage());
        return msg.length() > 240 ? msg.substring(0, 240) : msg;
    }

    private static String sha256Hex(final byte[] bytes) {
        try {
            final MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            // JRE guarantees SHA-256; unreachable.
            throw new IllegalStateException(ex);
        }
    }

    public record SyncReport(UUID runId,
                              String outcome,
                              String message,
                              CentralAppSyncRunRepository.SyncCounters counters,
                              List<CentralAppSyncRunRepository.CandidateDetail> details) { }
}
