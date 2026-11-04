package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class RoleDefinitionTest {

    @Test
    void acceptsNullAuthoritiesAsEmpty() {
        final RoleDefinition r = new RoleDefinition(
                UUID.randomUUID(), "Custom", "d", false, null,
                null, Instant.EPOCH, Instant.EPOCH);
        assertThat(r.authorities()).isEmpty();
    }

    @Test
    void authoritiesSetIsUnmodifiable() {
        final Set<String> seed = new LinkedHashSet<>(Set.of("der.users.read"));
        final RoleDefinition r = new RoleDefinition(
                UUID.randomUUID(), "Custom", null, false, null,
                seed, Instant.EPOCH, Instant.EPOCH);
        assertThatThrownBy(() -> r.authorities().add("x"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void blankNameRejected() {
        assertThatThrownBy(() -> new RoleDefinition(UUID.randomUUID(), "  ", null, false, null,
                Set.of(), Instant.EPOCH, Instant.EPOCH))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nullsAreRejected() {
        final UUID id = UUID.randomUUID();
        assertThatThrownBy(() -> new RoleDefinition(null, "x", null, false, null, Set.of(), Instant.EPOCH, Instant.EPOCH))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RoleDefinition(id, null, null, false, null, Set.of(), Instant.EPOCH, Instant.EPOCH))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RoleDefinition(id, "x", null, false, null, Set.of(), null, Instant.EPOCH))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new RoleDefinition(id, "x", null, false, null, Set.of(), Instant.EPOCH, null))
                .isInstanceOf(NullPointerException.class);
    }
}
