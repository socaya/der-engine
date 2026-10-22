package ug.ac.mak.der.dhis2.compatibility;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

/**
 * The DHIS2 compatibility engine (ADR-0006).
 *
 * <p>Combines:</p>
 * <ol>
 *   <li>a static profile per supported minor ({@link Dhis2ProfileRegistry});</li>
 *   <li>a dynamic probe battery against the configured central ({@link Dhis2CapabilityProbe});</li>
 *   <li>a persisted history of capability snapshots ({@link CapabilitySnapshotRepository}).</li>
 * </ol>
 *
 * <p>The engine exposes a single resolved {@link CapabilityFlags} value that
 * every version-sensitive DER code path consults. See the ADR for admission
 * policy, offline resilience, and snapshot refresh semantics.</p>
 */
public class Dhis2CompatibilityEngine {

    public static final String ENGINE_VERSION = "1.0.0";

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2CompatibilityEngine.class);

    private final Dhis2ReferenceClient referenceClient;
    private final Dhis2CapabilityProbe probe;
    private final Dhis2ProfileRegistry registry;
    private final CapabilitySnapshotRepository snapshots;
    private final Dhis2Properties properties;
    private final Clock clock;

    private final AtomicReference<CapabilitySnapshot> active = new AtomicReference<>();

    public Dhis2CompatibilityEngine(final Dhis2ReferenceClient referenceClient,
                                    final Dhis2CapabilityProbe probe,
                                    final Dhis2ProfileRegistry registry,
                                    final CapabilitySnapshotRepository snapshots,
                                    final Dhis2Properties properties,
                                    final Clock clock) {
        this.referenceClient = Objects.requireNonNull(referenceClient, "referenceClient");
        this.probe = Objects.requireNonNull(probe, "probe");
        this.registry = Objects.requireNonNull(registry, "registry");
        this.snapshots = Objects.requireNonNull(snapshots, "snapshots");
        this.properties = Objects.requireNonNull(properties, "properties");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * Resolve the active snapshot from startup state. See ADR-0006 §Offline
     * resilience and §Snapshot TTL.
     */
    public CapabilitySnapshot initialise() {
        if (properties.compatibility().cachedOnly()) {
            return initFromCache("cached-only mode (der.dhis2.compatibility.cached-only=true)");
        }
        final Optional<CapabilitySnapshot> cached = snapshots.findLatest();
        if (cached.isPresent() && !isStale(cached.get())) {
            LOG.info("DHIS2 compat engine: cached snapshot still fresh (captured={}, ttlHours={}); re-probing anyway",
                    cached.get().capturedAt(), properties.compatibility().snapshotTtlHours());
        }
        try {
            final CapabilitySnapshot fresh = probeAndStore(CapabilitySnapshot.Trigger.STARTUP, null);
            active.set(fresh);
            return fresh;
        } catch (UnsupportedDhis2VersionException ex) {
            // Below-floor is operator-fixable only; never silently fall back
            // to a cached-OK snapshot for an incompatible central.
            throw ex;
        } catch (RuntimeException ex) {
            if (cached.isEmpty()) {
                throw new Dhis2CompatibilityUnavailableException(
                        "DHIS2 central unreachable and no cached capability snapshot exists; "
                                + "refusing to serve /api/* until the engine can resolve a profile.", ex);
            }
            LOG.warn("DHIS2 probe failed; reusing cached snapshot {} ({}): {}",
                    cached.get().snapshotId(), cached.get().centralVersion(), ex.getMessage());
            active.set(cached.get());
            return cached.get();
        }
    }

    private CapabilitySnapshot initFromCache(final String reason) {
        final Optional<CapabilitySnapshot> cached = snapshots.findLatest();
        if (cached.isEmpty()) {
            throw new Dhis2CompatibilityUnavailableException(
                    "No cached snapshot available (" + reason + ") and the live probe is disabled.", null);
        }
        LOG.info("DHIS2 compat engine: {}", reason);
        active.set(cached.get());
        return cached.get();
    }

    /** Re-probe immediately on an operator's command, writing a new snapshot. */
    public CapabilitySnapshot refresh(final UUID initiatorUser) {
        final CapabilitySnapshot fresh = probeAndStore(CapabilitySnapshot.Trigger.ADMIN_REFRESH, initiatorUser);
        active.set(fresh);
        return fresh;
    }

    /** Return the active snapshot; throws if {@link #initialise()} has not run. */
    public CapabilitySnapshot current() {
        final CapabilitySnapshot s = active.get();
        if (s == null) {
            throw new Dhis2CompatibilityUnavailableException(
                    "DHIS2 compatibility engine has not been initialised.", null);
        }
        return s;
    }

    /** Resolved capability flags for the active snapshot. */
    public CapabilityFlags capabilities() {
        return current().capabilities();
    }

    /** Parsed semantic version for the active snapshot. */
    public Dhis2SemanticVersion semanticVersion() {
        final CapabilitySnapshot s = current();
        return new Dhis2SemanticVersion(s.major(), s.minor(), s.patch(), s.snapshot(), s.centralVersion());
    }

    /** Throw {@link UnsupportedDhis2VersionException} if below the floor. */
    public void requireAtLeast(final int major, final int minor) {
        final Dhis2SemanticVersion v = semanticVersion();
        if (!v.isAtLeast(major, minor)) {
            throw new UnsupportedDhis2VersionException(v.raw(), major + "." + minor);
        }
    }

    public List<CapabilitySnapshot> history(final int limit) {
        return snapshots.findRecent(limit);
    }

    public String engineVersion() {
        return ENGINE_VERSION;
    }

    private boolean isStale(final CapabilitySnapshot snapshot) {
        final long ttlHours = Math.max(1, properties.compatibility().snapshotTtlHours());
        final Instant threshold = Instant.now(clock).minusSeconds(ttlHours * 3600L);
        return snapshot.capturedAt().isBefore(threshold);
    }

    private CapabilitySnapshot probeAndStore(final CapabilitySnapshot.Trigger trigger,
                                             final UUID initiatorUser) {
        LOG.info("DHIS2 compat engine: running probe (trigger={})", trigger);
        final ProbeReport report = probe.run();

        final Dhis2Version version;
        try {
            version = referenceClient.fetchVersion();
        } catch (Exception ex) {
            if (properties.compatibility().strict()) {
                throw new IllegalStateException(
                        "DHIS2 /api/system/info unreachable or malformed", ex);
            }
            throw new IllegalStateException(
                    "Permissive mode but version fetch failed", ex);
        }

        final Dhis2SemanticVersion sem = Dhis2SemanticVersion.parse(version.version());

        final Dhis2SemanticVersion floor = Dhis2SemanticVersion.parse(
                properties.compatibility().minSupportedVersion() + ".0");
        if (!sem.isAtLeast(floor.major(), floor.minor())) {
            if (!properties.compatibility().allowUnsupported()) {
                throw new UnsupportedDhis2VersionException(sem.raw(),
                        properties.compatibility().minSupportedVersion());
            }
            LOG.warn("DHIS2 {} is below floor {} but allow-unsupported=true; proceeding",
                    sem.raw(), properties.compatibility().minSupportedVersion());
        }

        final Optional<Dhis2VersionProfile> maybeProfile = registry.resolve(sem);
        if (maybeProfile.isEmpty()) {
            throw new UnsupportedDhis2VersionException(sem.raw(),
                    properties.compatibility().minSupportedVersion());
        }
        final Dhis2VersionProfile profile = maybeProfile.get();

        final CapabilityFlags.Builder builder = new CapabilityFlags.Builder();
        profile.apply(builder);
        overlayProbeFindings(builder, report);
        final CapabilityFlags capabilities = builder.build();

        final CapabilitySnapshot snapshot = new CapabilitySnapshot(
                null,
                Instant.now(clock),
                sem.raw(),
                version.revision(),
                version.buildTime(),
                sem.major(),
                sem.minor(),
                sem.patch(),
                sem.snapshot(),
                profile.minorKey(),
                report,
                capabilities,
                ENGINE_VERSION,
                report.reachable(),
                report.totalDurationMs(),
                trigger,
                initiatorUser);
        return snapshots.insert(snapshot);
    }

    /** Override specific flags from the probe report. */
    static void overlayProbeFindings(final CapabilityFlags.Builder builder, final ProbeReport report) {
        boolean tracker = false;
        boolean legacy = false;
        boolean coc = false;
        boolean rules = false;
        boolean bulk = false;
        for (final ProbeOutcome o : report.outcomes()) {
            if (!o.reachable()) {
                continue;
            }
            final boolean responded = o.status() > 0 && o.status() != 404;
            if (o.endpoint().startsWith("/api/tracker/trackedEntities") && responded) {
                tracker = true;
            } else if (o.endpoint().startsWith("/api/tracker/events") && responded) {
                tracker = true;
            } else if (o.endpoint().startsWith("/api/trackedEntityInstances") && responded) {
                legacy = true;
            } else if (o.endpoint().startsWith("/api/events") && responded) {
                legacy = true;
            } else if (o.endpoint().startsWith("/api/categoryOptionCombos") && responded) {
                coc = true;
            } else if (o.endpoint().startsWith("/api/programRules") && responded) {
                rules = true;
            } else if (o.endpoint().startsWith("/api/metadata") && responded) {
                bulk = true;
            }
        }
        if (tracker && legacy) {
            builder.trackerApi(CapabilityFlags.TrackerApi.BOTH);
        } else if (tracker) {
            builder.trackerApi(CapabilityFlags.TrackerApi.TRACKER_ONLY);
        } else if (legacy) {
            builder.trackerApi(CapabilityFlags.TrackerApi.LEGACY_ONLY);
        } else {
            builder.trackerApi(CapabilityFlags.TrackerApi.NONE);
        }
        builder.supportsCategoryOptionCombosEndpoint(coc);
        builder.supportsProgramRulesEndpoint(rules);
        builder.supportsMetadataBulkEndpoint(bulk);
    }
}
