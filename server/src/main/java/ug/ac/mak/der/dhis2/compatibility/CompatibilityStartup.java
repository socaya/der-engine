package ug.ac.mak.der.dhis2.compatibility;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Runs {@link Dhis2CompatibilityEngine#initialise()} as soon as the Spring
 * context is ready.
 *
 * <p>ADR-0006 §Offline resilience: if the central is unreachable AND no cached
 * snapshot exists, the engine throws
 * {@link Dhis2CompatibilityUnavailableException}. We log the condition and let
 * the server come up anyway — admin-only {@code /edge-api/v1/*} surface
 * (identity, provisioning) must stay reachable so an operator can diagnose
 * and re-run the probe. Any request to the version-sensitive
 * {@code /api/*} emulator will fail-closed when it asks the engine for
 * capabilities.</p>
 */
@Component
public class CompatibilityStartup {

    private static final Logger LOG = LoggerFactory.getLogger(CompatibilityStartup.class);

    private final Dhis2CompatibilityEngine engine;

    public CompatibilityStartup(final Dhis2CompatibilityEngine engine) {
        this.engine = engine;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        try {
            final CapabilitySnapshot snapshot = engine.initialise();
            LOG.info("DHIS2 compatibility engine ready: profile={} version={} (snapshotId={})",
                    snapshot.profileName(), snapshot.centralVersion(), snapshot.snapshotId());
        } catch (Dhis2CompatibilityUnavailableException ex) {
            LOG.warn("DHIS2 compatibility engine not initialised at startup: {}. "
                    + "Admin surface will answer; /api/* writes refuse until a snapshot exists.",
                    ex.getMessage());
        } catch (UnsupportedDhis2VersionException ex) {
            LOG.error("DHIS2 version below minimum supported: observed={} min={}. "
                    + "Set der.dhis2.compatibility.allow-unsupported=true to override (dev only).",
                    ex.observed(), ex.minimum());
            throw ex;
        }
    }
}
