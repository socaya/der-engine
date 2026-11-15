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
                new CentralAppSyncAdminController(svc, runs,
                        mock(CentralSyncPolicyService.class)).status(null);
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void statusReturns403WithoutAdmin() {
        final CentralAppSyncService svc = mock(CentralAppSyncService.class);
        final CentralAppSyncRunRepository runs = mock(CentralAppSyncRunRepository.class);
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(svc, runs,
                        mock(CentralSyncPolicyService.class))
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
                new CentralAppSyncAdminController(svc, runs,
                        mock(CentralSyncPolicyService.class))
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
                        mock(CentralAppSyncRunRepository.class),
                        mock(CentralSyncPolicyService.class))
.preview(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("outcome", "OK");
        verify(svc).sync(eq(true), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void getPolicyReturnsCurrentPolicy() {
        final CentralSyncPolicyService pol = mock(CentralSyncPolicyService.class);
        when(pol.read()).thenReturn(new CentralSyncPolicy(
                CentralSyncPolicy.Mode.ALLOW_LIST, List.of("capture", "dashboard")));
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(
                        mock(CentralAppSyncService.class),
                        mock(CentralAppSyncRunRepository.class), pol)
                        .getPolicy(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("mode", "ALLOW_LIST");
        assertThat((List<Object>) res.getBody().get("keys")).contains("capture");
    }

    @Test
    void putPolicyWithoutAdminIs403() {
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(
                        mock(CentralAppSyncService.class),
                        mock(CentralAppSyncRunRepository.class),
                        mock(CentralSyncPolicyService.class))
                        .putPolicy(principal(EdgeRole.OPERATOR),
                                CentralSyncPolicy.allowAll());
        assertThat(res.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void putPolicyPersistsAndReturnsNewState() {
        final CentralSyncPolicyService pol = mock(CentralSyncPolicyService.class);
        final CentralSyncPolicy next = new CentralSyncPolicy(
                CentralSyncPolicy.Mode.DENY_LIST, List.of("capture"));
        when(pol.read()).thenReturn(next);
        final ResponseEntity<Map<String, Object>> res =
                new CentralAppSyncAdminController(
                        mock(CentralAppSyncService.class),
                        mock(CentralAppSyncRunRepository.class), pol)
                        .putPolicy(principal(EdgeRole.ADMIN), next);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("mode", "DENY_LIST");
        verify(pol).write(eq(next), any());
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
                        mock(CentralAppSyncRunRepository.class),
                        mock(CentralSyncPolicyService.class))
.run(principal(EdgeRole.ADMIN));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(svc).sync(eq(false), any());
    }
}
