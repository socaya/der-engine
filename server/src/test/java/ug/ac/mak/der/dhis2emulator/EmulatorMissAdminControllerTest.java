package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class EmulatorMissAdminControllerTest {

    private static EdgeUserPrincipal principal(final EdgeRole... roles) {
        final Instant now = Instant.now();
        final EnumSet<EdgeRole> set = roles.length == 0
                ? EnumSet.noneOf(EdgeRole.class)
                : EnumSet.copyOf(java.util.Arrays.asList(roles));
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ad", "Ad",
                EdgeUser.Origin.DHIS2, "x", false, set, now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void returns401WithoutAuth() {
        final ResponseEntity<Map<String, Object>> res =
                new EmulatorMissAdminController(mock(EmulatorMissRepository.class))
                        .list(null, 50);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void returns403WithoutAdminRole() {
        final ResponseEntity<Map<String, Object>> res =
                new EmulatorMissAdminController(mock(EmulatorMissRepository.class))
                        .list(principal(EdgeRole.OPERATOR), 50);
        assertThat(res.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    @SuppressWarnings("unchecked")
    void returnsRowsForAdmin() {
        final EmulatorMissRepository repo = mock(EmulatorMissRepository.class);
        when(repo.topRecent(50)).thenReturn(List.of(
                new EmulatorMissRepository.Row("/api/organisationUnitGroupSets",
                        "dashboard", 7L,
                        "2026-11-15T09:00:00Z", "2026-11-15T09:05:00Z")));
        final ResponseEntity<Map<String, Object>> res =
                new EmulatorMissAdminController(repo)
                        .list(principal(EdgeRole.ADMIN), 50);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        final List<Map<String, Object>> items =
                (List<Map<String, Object>>) res.getBody().get("misses");
        assertThat(items).hasSize(1);
        assertThat(items.get(0)).containsEntry("endpoint", "/api/organisationUnitGroupSets");
        assertThat(items.get(0)).containsEntry("hitCount", 7L);
    }
}
