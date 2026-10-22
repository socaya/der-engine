package ug.ac.mak.der.dhis2.compatibility;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parsed DHIS2 server version string.
 *
 * <p>DHIS2 reports its version through {@code GET /api/system/info.version}
 * in one of a small set of shapes:</p>
 *
 * <pre>
 *   2.44
 *   2.44.1
 *   2.44-SNAPSHOT
 *   2.44.0-SNAPSHOT
 *   2.44-SNAPSHOT-2026.05
 * </pre>
 *
 * <p>This record parses those shapes into
 * {@code (major, minor, patch, snapshot, raw)} so the compatibility engine can
 * route to a per-minor profile ({@code V2_41Profile} … {@code V2_44Profile})
 * and compare against a configured minimum.</p>
 *
 * <p>Unknown shapes are rejected rather than silently coerced: ADR-0006 requires
 * fail-closed admission when DER cannot identify the central's version.</p>
 */
public record Dhis2SemanticVersion(int major, int minor, Integer patch, boolean snapshot, String raw)
        implements Comparable<Dhis2SemanticVersion> {

    private static final Pattern PATTERN = Pattern.compile(
            "^(\\d+)\\.(\\d+)(?:\\.(\\d+))?(-SNAPSHOT(?:-[0-9A-Za-z.\\-]+)?)?$");

    public Dhis2SemanticVersion {
        Objects.requireNonNull(raw, "raw");
        if (major < 0 || minor < 0) {
            throw new IllegalArgumentException("major/minor must be non-negative: " + raw);
        }
        if (patch != null && patch < 0) {
            throw new IllegalArgumentException("patch must be non-negative: " + raw);
        }
    }

    /** Parse DHIS2's {@code info.version} string. Throws on anything unparseable. */
    public static Dhis2SemanticVersion parse(final String versionString) {
        if (versionString == null || versionString.isBlank()) {
            throw new IllegalArgumentException("version is null or blank");
        }
        final Matcher m = PATTERN.matcher(versionString.trim());
        if (!m.matches()) {
            throw new IllegalArgumentException("not a recognised DHIS2 version: '" + versionString + "'");
        }
        final int major = Integer.parseInt(m.group(1));
        final int minor = Integer.parseInt(m.group(2));
        final Integer patch = m.group(3) == null ? null : Integer.parseInt(m.group(3));
        final boolean snapshot = m.group(4) != null;
        return new Dhis2SemanticVersion(major, minor, patch, snapshot, versionString.trim());
    }

    /** Attempt to parse; return {@code null} on failure instead of throwing. */
    public static Dhis2SemanticVersion tryParse(final String versionString) {
        try {
            return parse(versionString);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public boolean isAtLeast(final int otherMajor, final int otherMinor) {
        if (major != otherMajor) {
            return major > otherMajor;
        }
        return minor >= otherMinor;
    }

    public boolean isAtMost(final int otherMajor, final int otherMinor) {
        if (major != otherMajor) {
            return major < otherMajor;
        }
        return minor <= otherMinor;
    }

    /** Returns a stable key per minor, e.g. {@code "V2_44"}. */
    public String minorKey() {
        return "V" + major + "_" + minor;
    }

    @Override
    public int compareTo(final Dhis2SemanticVersion other) {
        int c = Integer.compare(major, other.major);
        if (c != 0) {
            return c;
        }
        c = Integer.compare(minor, other.minor);
        if (c != 0) {
            return c;
        }
        final int lp = patch == null ? -1 : patch;
        final int rp = other.patch == null ? -1 : other.patch;
        c = Integer.compare(lp, rp);
        if (c != 0) {
            return c;
        }
        return Boolean.compare(other.snapshot, snapshot);
    }
}
