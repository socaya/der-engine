package ug.ac.mak.der.dhis2;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed configuration for the DER→DHIS2 connection and the compatibility engine.
 *
 * <p>Populated from {@code application.yml} and environment variables under the
 * {@code der.dhis2} prefix.</p>
 *
 * <p>ADR-0006 introduced {@link Compatibility#minSupportedVersion}, {@link
 * Compatibility#maxTestedVersion}, {@link Compatibility#mode},
 * {@link Compatibility#allowUnsupported}, {@link Compatibility#snapshotTtlHours}
 * and {@link Compatibility#cachedOnly}. The old {@code pinnedVersion} and
 * {@code allowMismatch} fields are retained as deprecated aliases so existing
 * deployments do not break on upgrade; they are mapped onto the new semantics
 * at bean-construction time.</p>
 *
 * @param central           connection and credentials for the central DHIS2
 * @param compatibility     policy for the compatibility engine
 */
@ConfigurationProperties(prefix = "der.dhis2")
public record Dhis2Properties(Central central, Compatibility compatibility) {

    public Dhis2Properties {
        if (central == null) {
            central = new Central(null, null, null, 10_000);
        }
        if (compatibility == null) {
            compatibility = new Compatibility(
                    "2.41",
                    "2.44",
                    "strict",
                    false,
                    168,
                    false,
                    null,
                    false);
        }
    }

    /**
     * @param baseUrl               canonical base URL of the central DHIS2
     *                              ({@code .../dhis}), no trailing slash.
     * @param username              Web API user DER authenticates as
     * @param password              corresponding password; MUST NOT be logged
     * @param connectTimeoutMillis  bounded connect timeout for every outbound call
     */
    public record Central(String baseUrl, String username, String password, int connectTimeoutMillis) {
    }

    /**
     * ADR-0006 compatibility policy.
     *
     * @param minSupportedVersion   hard floor, e.g. {@code "2.41"}. Boot refuses
     *                              anything below unless {@link #allowUnsupported}.
     * @param maxTestedVersion      maximum minor DER has a profile for, e.g.
     *                              {@code "2.44"}. Above this logs WARN and
     *                              resolves to the max profile.
     * @param mode                  {@code "strict"} fails closed on probe
     *                              exceptions; {@code "permissive"} warns.
     * @param allowUnsupported      dev override permitting boot below
     *                              {@link #minSupportedVersion}.
     * @param snapshotTtlHours      how long a cached snapshot is reused before
     *                              the engine re-probes on next startup.
     * @param cachedOnly            dev flag — use the latest cached snapshot and
     *                              skip the live probe.
     * @param pinnedVersion         DEPRECATED alias for {@link #maxTestedVersion}.
     * @param allowMismatch         DEPRECATED alias for {@link #allowUnsupported}.
     */
    public record Compatibility(
            String minSupportedVersion,
            String maxTestedVersion,
            String mode,
            boolean allowUnsupported,
            int snapshotTtlHours,
            boolean cachedOnly,
            @Deprecated String pinnedVersion,
            @Deprecated boolean allowMismatch
    ) {

        public Compatibility {
            if (minSupportedVersion == null || minSupportedVersion.isBlank()) {
                minSupportedVersion = "2.41";
            }
            if (maxTestedVersion == null || maxTestedVersion.isBlank()) {
                maxTestedVersion = pinnedVersion == null || pinnedVersion.isBlank()
                        ? "2.44" : stripSnapshot(pinnedVersion);
            }
            if (mode == null || mode.isBlank()) {
                mode = "strict";
            }
            if (snapshotTtlHours <= 0) {
                snapshotTtlHours = 168;
            }
            if (allowMismatch && !allowUnsupported) {
                allowUnsupported = true;
            }
            if (pinnedVersion == null || pinnedVersion.isBlank()) {
                pinnedVersion = maxTestedVersion;
            }
        }

        public boolean strict() {
            return "strict".equalsIgnoreCase(mode);
        }

        /**
         * Builds a {@link Compatibility} from the Phase 01 (pre-ADR-0006) two-field
         * shape so existing callers and tests keep working. Prefer the full
         * canonical constructor in new code.
         */
        public static Compatibility legacy(final String pinnedVersion, final boolean allowMismatch) {
            return new Compatibility(
                    "2.41",
                    pinnedVersion == null || pinnedVersion.isBlank() ? "2.44" : stripSnapshot(pinnedVersion),
                    "strict",
                    allowMismatch,
                    168,
                    false,
                    pinnedVersion,
                    allowMismatch);
        }

        private static String stripSnapshot(final String v) {
            final int dash = v.indexOf('-');
            return dash < 0 ? v : v.substring(0, dash);
        }
    }
}
