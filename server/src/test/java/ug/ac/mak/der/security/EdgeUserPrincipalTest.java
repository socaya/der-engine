package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeUserPrincipalTest {

    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");

    private EdgeUser user(final Set<EdgeRole> roles) {
        return new EdgeUser(UUID.randomUUID(), "alice", "A", EdgeUser.Origin.BOOTSTRAP, null, false,
                roles, NOW, NOW);
    }

    private EdgeSession session(final UUID userId) {
        return new EdgeSession(UUID.randomUUID(), userId, "h", NOW, NOW, NOW.plusSeconds(60), null, null, null);
    }

    @Test
    void authoritiesMirrorRolesWithRolePrefix() {
        final EdgeUser u = user(EnumSet.of(EdgeRole.ADMIN, EdgeRole.OPERATOR));
        final EdgeUserPrincipal p = new EdgeUserPrincipal(u, session(u.userId()));
        assertThat(p.getAuthorities()).extracting(Object::toString)
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_OPERATOR");
    }

    @Test
    void credentialsAreRedacted() {
        final EdgeUser u = user(Set.of());
        final EdgeUserPrincipal p = new EdgeUserPrincipal(u, session(u.userId()));
        assertThat(p.getCredentials().toString()).isEqualTo("[REDACTED]");
    }

    @Test
    void principalAndNameSurface() {
        final EdgeUser u = user(Set.of());
        final EdgeUserPrincipal p = new EdgeUserPrincipal(u, session(u.userId()));
        assertThat(p.getPrincipal()).isSameAs(u);
        assertThat(p.getName()).isEqualTo("alice");
        assertThat(p.userId()).isEqualTo(u.userId());
        assertThat(p.user()).isSameAs(u);
        assertThat(p.session().userId()).isEqualTo(u.userId());
        assertThat(p.roleNames()).isEmpty();
    }

    @Test
    void rejectsNullUser() {
        assertThatThrownBy(() -> new EdgeUserPrincipal(null, session(UUID.randomUUID())))
                .isInstanceOf(NullPointerException.class).hasMessage("user");
    }

    @Test
    void rejectsNullSession() {
        final EdgeUser u = user(Set.of());
        assertThatThrownBy(() -> new EdgeUserPrincipal(u, null))
                .isInstanceOf(NullPointerException.class).hasMessage("session");
    }
}
