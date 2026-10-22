package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeUserTest {

    private static final UUID ID = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");

    @Test
    void requiresLowerCaseUsername() {
        assertThatThrownBy(() -> new EdgeUser(ID, "Admin", "d", EdgeUser.Origin.BOOTSTRAP, null, false,
                Set.of(EdgeRole.ADMIN), NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("lower-case");
    }

    @Test
    void rejectsBlankUsername() {
        assertThatThrownBy(() -> new EdgeUser(ID, "   ", "d", EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                NOW, NOW))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("blank");
    }

    @Test
    void defaultsNullRolesToEmpty() {
        final EdgeUser u = new EdgeUser(ID, "a", "d", EdgeUser.Origin.BOOTSTRAP, null, false, null, NOW, NOW);
        assertThat(u.roles()).isEmpty();
    }

    @Test
    void hasRoleReflectsMembership() {
        final EdgeUser u = new EdgeUser(ID, "a", "d", EdgeUser.Origin.DHIS2, "x1", false,
                EnumSet.of(EdgeRole.ADMIN), NOW, NOW);
        assertThat(u.hasRole(EdgeRole.ADMIN)).isTrue();
        assertThat(u.hasRole(EdgeRole.OPERATOR)).isFalse();
    }

    @Test
    void rejectsNullUserId() {
        assertThatThrownBy(() -> new EdgeUser(null, "a", "d", EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                NOW, NOW))
                .isInstanceOf(NullPointerException.class).hasMessage("userId");
    }

    @Test
    void rejectsNullUsername() {
        assertThatThrownBy(() -> new EdgeUser(ID, null, "d", EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                NOW, NOW))
                .isInstanceOf(NullPointerException.class).hasMessage("username");
    }

    @Test
    void rejectsNullDisplayName() {
        assertThatThrownBy(() -> new EdgeUser(ID, "a", null, EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                NOW, NOW))
                .isInstanceOf(NullPointerException.class).hasMessage("displayName");
    }

    @Test
    void rejectsNullOrigin() {
        assertThatThrownBy(() -> new EdgeUser(ID, "a", "d", null, null, false, Set.of(), NOW, NOW))
                .isInstanceOf(NullPointerException.class).hasMessage("origin");
    }

    @Test
    void rejectsNullCreatedAt() {
        assertThatThrownBy(() -> new EdgeUser(ID, "a", "d", EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                null, NOW))
                .isInstanceOf(NullPointerException.class).hasMessage("createdAt");
    }

    @Test
    void rejectsNullUpdatedAt() {
        assertThatThrownBy(() -> new EdgeUser(ID, "a", "d", EdgeUser.Origin.BOOTSTRAP, null, false, Set.of(),
                NOW, null))
                .isInstanceOf(NullPointerException.class).hasMessage("updatedAt");
    }
}
