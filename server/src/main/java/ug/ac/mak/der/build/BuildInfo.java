package ug.ac.mak.der.build;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable record describing the DER build identity reported by the system health
 * endpoint. Fields are the ones Phase 00 commits to reporting.
 *
 * <p>{@link #dhis2ReferenceVersion()} is deliberately {@code "unknown"} at Phase 00
 * and only changes to a pinned {@code 2.43.x} value when Phase 01 records the
 * decision in ADR-0002 and the matching Maven property is updated.</p>
 */
public record BuildInfo(
        String release,
        String commit,
        String branch,
        boolean dirty,
        Instant buildTime,
        String dhis2ReferenceVersion
) {
    public BuildInfo {
        Objects.requireNonNull(release, "release");
        Objects.requireNonNull(commit, "commit");
        Objects.requireNonNull(branch, "branch");
        Objects.requireNonNull(buildTime, "buildTime");
        Objects.requireNonNull(dhis2ReferenceVersion, "dhis2ReferenceVersion");
    }

    public static final String UNKNOWN_DHIS2_VERSION = "unknown";
}
