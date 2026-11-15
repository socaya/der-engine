package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class CentralAppSyncAdminControllerTest {

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
    void statusReturns401WithoutAuth() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        final CentralAppSyncRunRepository runs = mock(CentralAppSyncRunRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc, runs).status(null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void statusReturns403WithoutAdmin() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        final CentralAppSyncRunRepository runs = mock(CentralAppSyncRunRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc, runs)
                        .status(principal(EdgeRole.OPERATOR));
        assertThat(res.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void statusSurfacesLatestRun() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        final CentralAppSyncRunRepository runs = mock(CentralAppSyncRunRepository.class);
        final UUID id = UUID.randomUUID();
        when(runs.latest()).thenReturn(Optional.of(new CentralAppSyncRunRepository.Row(
                id, Instant.parse("2026-11-15T10:00:00Z"),
                Instant.parse("2026-11-15T10:00:01Z"),
                "OK", "fine", false, null, 1, 1, 0, 0, 0)));
        when(runs.recent(20)).thenReturn(List.of());
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc, runs)
                        .status(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        @SuppressWarnings("unchecked")
        final Map<String, Object> latest =
                (Map<String, Object>) res.getBody().get("latest");
        assertThat(latest).containsEntry("runId", id.toString());
    }

    @Test
    void previewCallsServiceWithDryRunTrue() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        when(svc.sync(eq(true), any())).thenReturn(
                new CentralAppSyncService.SyncReport(UUID.randomUUID(), "OK",
                        "dry-run: 0 discovered",
                        CentralAppSyncRunRepository.SyncCounters.zero(),
                        List.of()));
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc,
                        mock(CentralAppSyncRunRepository.class))
                        .preview(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("outcome", "OK");
        verify(svc).sync(eq(true), any());
    }

    @Test
    void runCallsServiceWithDryRunFalse() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        when(svc.sync(eq(false), any())).thenReturn(
                new CentralAppSyncService.SyncReport(UUID.randomUUID(), "OK",
                        "nothing new",
                        CentralAppSyncRunRepository.SyncCounters.zero(),
                        List.of()));
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc,
                        mock(CentralAppSyncRunRepository.class))
                        .run(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(svc).sync(eq(false), any());
    }
}
