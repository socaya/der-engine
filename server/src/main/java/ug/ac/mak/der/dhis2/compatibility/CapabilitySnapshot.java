package ug.ac.mak.der.dhis2.compatibility;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Row in {@code der.dhis2_capability_snapshot} — the persisted outcome of one
 * probe run. Composed by {@link Dhis2CompatibilityEngine} and stored by
 * {@link CapabilitySnapshotRepository}.
 */
public record CapabilitySnapshot(
        Long snapshotId,
        Instant capturedAt,
        String centralVersion,
        String centralRevision,
        String centralBuildTime,
        int major,
        int minor,
        Integer patch,
        boolean snapshot,
        String profileName,
        ProbeReport probeReport,
        CapabilityFlags capabilities,
        String engineVersion,
        boolean probeReachable,
        long probeDurationMs,
        Trigger triggeredBy,
        UUID initiatorUser
) {

    public CapabilitySnapshot {
        Objects.requireNonNull(centralVersion, "centralVersion");
        Objects.requireNonNull(profileName, "profileName");
        Objects.requireNonNull(probeReport, "probeReport");
        Objects.requireNonNull(capabilities, "capabilities");
        Objects.requireNonNull(engineVersion, "engineVersion");
        Objects.requireNonNull(triggeredBy, "triggeredBy");
    }

    public enum Trigger { STARTUP, ADMIN_REFRESH, SCHEDULED, TEST }
}
