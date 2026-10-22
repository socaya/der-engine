package ug.ac.mak.der.security;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * A DER-mirrored user. Immutable — services return a new instance for every
 * mutation. The password verifier is stored out-of-band in {@code edge_credential}
 * and never exposed on this record.
 */
public record EdgeUser(
        UUID userId,
        String username,
        String displayName,
        Origin origin,
        String externalUid,
        boolean disabled,
        Set<EdgeRole> roles,
        Instant createdAt,
        Instant updatedAt
) {

    public EdgeUser {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(username, "username");
        Objects.requireNonNull(displayName, "displayName");
        Objects.requireNonNull(origin, "origin");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (username.isBlank()) {
            throw new IllegalArgumentException("username must not be blank");
        }
        if (!username.equals(username.toLowerCase(java.util.Locale.ROOT))) {
            throw new IllegalArgumentException("username must be lower-case");
        }
        roles = roles == null ? Set.of() : Collections.unmodifiableSet(new LinkedHashSet<>(roles));
    }

    public boolean hasRole(final EdgeRole role) {
        return roles.contains(role);
    }

    public enum Origin {
        /** Mirrored from DHIS2 via the user reconciliation service. */
        DHIS2,
        /** Provisioned at startup by the bootstrap-admin runner. */
        BOOTSTRAP
    }
}
