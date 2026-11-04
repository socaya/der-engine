package ug.ac.mak.der.security;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * A row in {@code der.role_definition} plus its mapped authorities.  Dynamic
 * — operators create and edit these through
 * {@code /edge-api/v1/admin/roles}.  Built-in rows (is_builtin = TRUE) cannot
 * be renamed or deleted; their authority list can still be adjusted.
 */
public record RoleDefinition(
        UUID roleId,
        String name,
        String description,
        boolean builtin,
        String builtinKey,
        Set<String> authorities,
        Instant createdAt,
        Instant updatedAt
) {
    public RoleDefinition {
        Objects.requireNonNull(roleId, "roleId");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(updatedAt, "updatedAt");
        if (name.isBlank()) {
            throw new IllegalArgumentException("name must not be blank");
        }
        authorities = authorities == null
                ? Set.of()
                : Collections.unmodifiableSet(new LinkedHashSet<>(authorities));
    }
}
