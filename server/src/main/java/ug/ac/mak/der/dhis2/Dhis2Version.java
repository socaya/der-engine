package ug.ac.mak.der.dhis2;

import java.util.Objects;

/**
 * Normalised identity of a DHIS2 server as reported by {@code /api/system/info}.
 *
 * <p>Only {@link #version()} is matched for compatibility: Phase 01 pins
 * {@code "2.44-SNAPSHOT"} and the guard requires an exact prefix match
 * (ADR-0002). {@link #revision()} and {@link #buildTime()} are recorded for
 * audit and included in the evidence bundle; they do not drive admission.</p>
 *
 * @param version   value of {@code info.version} (e.g. "2.44-SNAPSHOT", "2.44.0").
 *                  Must not be {@code null}; may be blank which means "unknown"
 *                  and is rejected by the compatibility guard.
 * @param revision  value of {@code info.revision} (git short SHA), nullable.
 * @param buildTime value of {@code info.buildTime}, nullable.
 */
public record Dhis2Version(String version, String revision, String buildTime) {

    public Dhis2Version {
        Objects.requireNonNull(version, "version");
    }

    /** Convenience factory for tests. */
    public static Dhis2Version of(final String version) {
        return new Dhis2Version(version, null, null);
    }

    public boolean isBlank() {
        return version.isBlank();
    }
}
