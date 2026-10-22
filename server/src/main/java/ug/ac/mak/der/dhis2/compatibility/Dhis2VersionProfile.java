package ug.ac.mak.der.dhis2.compatibility;

/**
 * Static-defaults contribution for a single DHIS2 minor version.
 *
 * <p>Each profile populates a {@link CapabilityFlags.Builder} with the known
 * behaviour of its minor. The compatibility engine then overlays probe
 * outcomes on top; see ADR-0006.</p>
 */
public interface Dhis2VersionProfile {

    /** Minor-key the profile answers to ({@code V2_41}, {@code V2_44}, …). */
    String minorKey();

    /** Human-readable DHIS2 minor label ({@code 2.41}, {@code 2.44}, …). */
    String label();

    /** Populate the builder with this profile's defaults. */
    void apply(CapabilityFlags.Builder builder);
}
