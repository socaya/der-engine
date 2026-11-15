package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class SystemSettingsControllerTest {

    private static EdgeUserPrincipal principalWith(final EdgeRole... roles) {
        final Instant now = Instant.now();
        final EnumSet<EdgeRole> set = roles.length == 0
                ? EnumSet.noneOf(EdgeRole.class)
                : EnumSet.copyOf(java.util.Arrays.asList(roles));
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "bob", "Bob",
                EdgeUser.Origin.DHIS2, "x", false, set, now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h",
                now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    @Test
    void readAllIsOpenToAnyUser() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        when(repo.readAll()).thenReturn(Map.of("keyInstanceName", "MOH DER"));
        final var res = new SystemSettingsController(repo).readAll();
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("keyInstanceName", "MOH DER");
    }

    @Test
    void upsertWithoutAuthIs401() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final var res = new SystemSettingsController(repo).upsert(null,
                "keyInstanceName", "X", null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void upsertWithoutAdminIs403() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final var res = new SystemSettingsController(repo).upsert(
                principalWith(EdgeRole.OPERATOR),
                "keyInstanceName", "X", null);
        assertThat(res.getStatusCode().value()).isEqualTo(403);
        verify(repo, never()).upsert(any(), any(), any());
    }

    @Test
    void upsertSucceedsForAdmin() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final var p = principalWith(EdgeRole.ADMIN);
        final var res = new SystemSettingsController(repo).upsert(
                p, "keyInstanceName", "DER MoH", null);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(repo).upsert("keyInstanceName", "DER MoH", p.user().userId());
    }

    @Test
    void deleteWithoutAdminIs403() {
        final SystemSettingsRepository repo = mock(SystemSettingsRepository.class);
        final var res = new SystemSettingsController(repo).delete(
                principalWith(EdgeRole.OPERATOR), "keyInstanceName");
        assertThat(res.getStatusCode().value()).isEqualTo(403);
        verify(repo, never()).delete(any());
    }
}
