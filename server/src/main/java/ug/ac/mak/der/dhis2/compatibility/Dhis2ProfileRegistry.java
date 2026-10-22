package ug.ac.mak.der.dhis2.compatibility;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import ug.ac.mak.der.dhis2.compatibility.profiles.V241Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V242Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V243Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

/**
 * Maps a parsed {@link Dhis2SemanticVersion} to a {@link Dhis2VersionProfile}.
 *
 * <p>ADR-0006 resolution rules:</p>
 * <ul>
 *   <li>Exact minor match → that profile.</li>
 *   <li>Above {@code max-tested}: pick the max profile and WARN.</li>
 *   <li>Between known profiles: pick the nearest-lower profile and WARN.</li>
 *   <li>Below the hard floor: resolver returns {@link Optional#empty()}; the
 *       engine then decides whether to throw
 *       {@link UnsupportedDhis2VersionException} based on policy.</li>
 * </ul>
 */
public class Dhis2ProfileRegistry {

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2ProfileRegistry.class);

    private final TreeMap<Integer, Dhis2VersionProfile> profilesByMinor = new TreeMap<>();
    private final int minSupportedMinor;
    private final int maxTestedMinor;

    public Dhis2ProfileRegistry(final int minSupportedMinor, final int maxTestedMinor,
                                final List<Dhis2VersionProfile> profiles) {
        if (profiles == null || profiles.isEmpty()) {
            throw new IllegalArgumentException("profiles must not be empty");
        }
        for (final Dhis2VersionProfile p : profiles) {
            final int minor = parseMinorFromKey(p.minorKey());
            profilesByMinor.put(minor, p);
        }
        this.minSupportedMinor = minSupportedMinor;
        this.maxTestedMinor = maxTestedMinor;
    }

    /** Convenience factory with the default profile set (2.41 through 2.44). */
    public static Dhis2ProfileRegistry defaultRegistry() {
        return new Dhis2ProfileRegistry(41, 44, List.of(
                new V241Profile(), new V242Profile(), new V243Profile(), new V244Profile()));
    }

    public int minSupportedMinor() {
        return minSupportedMinor;
    }

    public int maxTestedMinor() {
        return maxTestedMinor;
    }

    /**
     * Resolve the profile for an observed major-2 version. For non-2 majors we
     * return empty; the engine fails closed.
     */
    public Optional<Dhis2VersionProfile> resolve(final Dhis2SemanticVersion version) {
        Objects.requireNonNull(version, "version");
        if (version.major() != 2) {
            LOG.warn("Unknown DHIS2 major {}; no profile available", version.major());
            return Optional.empty();
        }
        final int minor = version.minor();
        if (minor < minSupportedMinor) {
            LOG.warn("DHIS2 minor {} is below minimum supported 2.{}; refusing to resolve",
                    minor, minSupportedMinor);
            return Optional.empty();
        }
        if (profilesByMinor.containsKey(minor)) {
            return Optional.of(profilesByMinor.get(minor));
        }
        if (minor > maxTestedMinor) {
            final Dhis2VersionProfile max = profilesByMinor.lastEntry().getValue();
            LOG.warn("DHIS2 minor {} is above the maximum tested 2.{}; resolving to {} profile",
                    minor, maxTestedMinor, max.minorKey());
            return Optional.of(max);
        }
        final var floor = profilesByMinor.floorEntry(minor);
        if (floor != null) {
            LOG.warn("No exact profile for DHIS2 2.{}; falling back to {}",
                    minor, floor.getValue().minorKey());
            return Optional.of(floor.getValue());
        }
        return Optional.empty();
    }

    private static int parseMinorFromKey(final String key) {
        final int underscore = key.indexOf('_');
        if (underscore < 0) {
            throw new IllegalArgumentException("minorKey must look like 'V2_44', got: " + key);
        }
        return Integer.parseInt(key.substring(underscore + 1));
    }
}
