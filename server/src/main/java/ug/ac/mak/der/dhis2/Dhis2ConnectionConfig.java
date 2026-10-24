package ug.ac.mak.der.dhis2;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable snapshot of the editable DHIS2 central-connection config,
 * stored in the {@code der.dhis2_connection_config} singleton table.
 *
 * <p>Secrets ({@code passwordSealed}, {@code patTokenSealed}) are
 * SecretEnvelope-wrapped at rest; callers that need the raw value should
 * resolve through the shared {@code SecretEnvelope}.</p>
 */
public record Dhis2ConnectionConfig(
        String baseUrl,
        String username,
        String passwordSealed,
        String patTokenSealed,
        boolean allowMismatch,
        String pinnedVersion,
        String minSupportedVersion,
        String maxTestedVersion,
        String compatMode,
        Integer snapshotTtlHours,
        Integer connectTimeoutMillis,
        Boolean proxyEnabled,
        Boolean proxyAllowWrites,
        String proxyAllowPaths,
        Instant updatedAt,
        UUID updatedBy
) {
    public static Dhis2ConnectionConfig empty() {
        return new Dhis2ConnectionConfig(
                null, null, null, null, false,
                null, null, null, null, null, null,
                null, null, null, null, null);
    }
}
