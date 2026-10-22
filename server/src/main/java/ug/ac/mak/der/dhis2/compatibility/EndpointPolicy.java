package ug.ac.mak.der.dhis2.compatibility;

import java.util.Objects;

/**
 * Status of a single DHIS2 Web API endpoint for a given minor version.
 *
 * <p>Carries the information needed for DER's version-aware routing:</p>
 *
 * <ul>
 *   <li>{@link #path} — the canonical path (may differ per minor).</li>
 *   <li>{@link #status} — present, deprecated, or removed on this minor.</li>
 *   <li>{@link #sinceMinor} — the earliest DHIS2 2.x minor this endpoint
 *       appeared on. {@code null} means "unknown / pre-DER".</li>
 *   <li>{@link #removedMinor} — the DHIS2 2.x minor that removed the
 *       endpoint. {@code null} means "still present".</li>
 *   <li>{@link #replacement} — the preferred replacement endpoint, if
 *       deprecated. {@code null} if none.</li>
 *   <li>{@link #notes} — release-note reference (e.g. "2.43.2").</li>
 * </ul>
 *
 * <p>Immutable; populated per profile and overlaid by probe outcomes.</p>
 */
public record EndpointPolicy(
        String path,
        Status status,
        Integer sinceMinor,
        Integer removedMinor,
        EndpointId replacement,
        String notes
) {

    public EndpointPolicy {
        Objects.requireNonNull(path, "path");
        Objects.requireNonNull(status, "status");
    }

    public boolean usable() {
        return status == Status.PRESENT || status == Status.DEPRECATED;
    }

    public boolean removed() {
        return status == Status.REMOVED;
    }

    public enum Status {
        PRESENT,
        DEPRECATED,
        REMOVED,
        NOT_APPLICABLE
    }

    public static EndpointPolicy present(final String path, final int sinceMinor) {
        return new EndpointPolicy(path, Status.PRESENT, sinceMinor, null, null, null);
    }

    public static EndpointPolicy deprecated(final String path, final int sinceMinor,
                                             final EndpointId replacement, final String notes) {
        return new EndpointPolicy(path, Status.DEPRECATED, sinceMinor, null, replacement, notes);
    }

    public static EndpointPolicy removed(final String path, final int sinceMinor,
                                          final int removedMinor, final EndpointId replacement,
                                          final String notes) {
        return new EndpointPolicy(path, Status.REMOVED, sinceMinor, removedMinor, replacement, notes);
    }
}
