package ug.ac.mak.der.orgunit;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Current edge-to-orgUnit binding. {@code null}-valued fields when the
 * edge has not been bound yet; after the first-boot EA-01 picker runs,
 * every field is populated. ADR-0015.
 */
public record EdgeOrgUnitBinding(
        String orgUnitId,
        String orgUnitDisplayName,
        String orgUnitPath,
        Instant boundAt,
        UUID boundBy
) {

    public boolean isBound() {
        return orgUnitId != null && orgUnitPath != null;
    }

    /** Returns an empty, unbound binding. */
    public static EdgeOrgUnitBinding empty() {
        return new EdgeOrgUnitBinding(null, null, null, null, null);
    }

    /** Pre-condition applied to the row written to {@code edge_node}. */
    public static EdgeOrgUnitBinding bound(final String id, final String displayName,
                                             final String path, final UUID boundBy) {
        Objects.requireNonNull(id, "orgUnitId");
        Objects.requireNonNull(displayName, "orgUnitDisplayName");
        Objects.requireNonNull(path, "orgUnitPath");
        Objects.requireNonNull(boundBy, "boundBy");
        return new EdgeOrgUnitBinding(id, displayName, path, Instant.now(), boundBy);
    }
}
