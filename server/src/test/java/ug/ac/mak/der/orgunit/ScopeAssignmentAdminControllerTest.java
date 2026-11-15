package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

class ScopeAssignmentAdminControllerTest {

    private ScopeAssignmentRepository scopes;
    private OrgUnitBindingService binding;
    private EdgeOrgUnitBindingRepository bindingRepo;
    private ScopeAssignmentAdminController ctl;

    @BeforeEach
    void setUp() {
        scopes = mock(ScopeAssignmentRepository.class);
        binding = mock(OrgUnitBindingService.class);
        bindingRepo = mock(EdgeOrgUnitBindingRepository.class);
        ctl = new ScopeAssignmentAdminController(scopes, binding, bindingRepo);
    }

    private static EdgeUserPrincipal principal(final EdgeRole... roles) {
        final Instant now = Instant.now();
        final EnumSet<EdgeRole> set = roles.length == 0
                ? EnumSet.noneOf(EdgeRole.class)
                : EnumSet.copyOf(java.util.Arrays.asList(roles));
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ad", "Ad",
                EdgeUser.Origin.DHIS2, "x", false, set, now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static EdgeOrgUnitBinding boundToClinic() {
        return EdgeOrgUnitBinding.bound("OU-CLINIC-A", "Clinic A",
                "/OU-ROOT/OU-DISTRICT/OU-CLINIC-A", UUID.randomUUID());
    }

    @Test
    void anonymousIs401() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.get(null, UUID.randomUUID());
        assertThat(res.getStatusCode().value()).isEqualTo(401);
    }

    @Test
    void nonAdminIs403() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.get(principal(EdgeRole.OPERATOR), UUID.randomUUID());
        assertThat(res.getStatusCode().value()).isEqualTo(403);
    }

    @Test
    void getReturns404WhenAbsent() {
        final UUID uid = UUID.randomUUID();
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.empty());
        final ResponseEntity<Map<String, Object>> res =
                ctl.get(principal(EdgeRole.ADMIN), uid);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void getReturnsAssignment() {
        final UUID uid = UUID.randomUUID();
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.of(
                new ScopeAssignmentRepository.Row(1L, uid, "OU-ROOM-7",
                        true, Instant.parse("2026-11-15T10:00:00Z"))));
        final ResponseEntity<Map<String, Object>> res =
                ctl.get(principal(EdgeRole.ADMIN), uid);
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        assertThat(res.getBody()).containsEntry("orgUnitId", "OU-ROOM-7");
        assertThat(res.getBody()).containsEntry("includeDescendants", true);
    }

    @Test
    void putRejectsEmptyBody() {
        final ResponseEntity<Map<String, Object>> res =
                ctl.put(principal(EdgeRole.ADMIN), UUID.randomUUID(), null);
        assertThat(res.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void putRejectsWhenEdgeUnbound() {
        when(binding.current()).thenReturn(EdgeOrgUnitBinding.empty());
        final ResponseEntity<Map<String, Object>> res =
                ctl.put(principal(EdgeRole.ADMIN), UUID.randomUUID(),
                        new ScopeAssignmentAdminController.Request("OU-ROOM-7", true));
        assertThat(res.getStatusCode().value()).isEqualTo(409);
        assertThat(res.getBody()).containsEntry("code", "EDGE_NOT_BOUND");
        verify(scopes, never()).upsertOrgUnit(any(), any(),
                org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    void putRejectsOrgUnitNotInMirror() {
        when(binding.current()).thenReturn(boundToClinic());
        when(bindingRepo.resolveOrgUnitPath("OU-GHOST")).thenReturn(null);
        final ResponseEntity<Map<String, Object>> res =
                ctl.put(principal(EdgeRole.ADMIN), UUID.randomUUID(),
                        new ScopeAssignmentAdminController.Request("OU-GHOST", true));
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getBody()).containsEntry("code", "ORG_UNIT_NOT_IN_MIRROR");
    }

    @Test
    void putRejectsOrgUnitOutsideBoundSubtree() {
        when(binding.current()).thenReturn(boundToClinic());
        when(bindingRepo.resolveOrgUnitPath("OU-OTHER"))
                .thenReturn("/OU-ROOT/OU-OTHER-DISTRICT/OU-OTHER");
        when(bindingRepo.isUnderBoundSubtree(any(), any())).thenReturn(false);
        final ResponseEntity<Map<String, Object>> res =
                ctl.put(principal(EdgeRole.ADMIN), UUID.randomUUID(),
                        new ScopeAssignmentAdminController.Request("OU-OTHER", true));
        assertThat(res.getStatusCode().value()).isEqualTo(400);
        assertThat(res.getBody()).containsEntry("code",
                "ORG_UNIT_OUTSIDE_BOUND_SUBTREE");
    }

    @Test
    void putUpsertsAndReturns200() {
        final UUID uid = UUID.randomUUID();
        when(binding.current()).thenReturn(boundToClinic());
        when(bindingRepo.resolveOrgUnitPath("OU-ROOM-7"))
                .thenReturn("/OU-ROOT/OU-DISTRICT/OU-CLINIC-A/OU-ROOM-7");
        when(bindingRepo.isUnderBoundSubtree(any(), any())).thenReturn(true);
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.of(
                new ScopeAssignmentRepository.Row(1L, uid, "OU-ROOM-7",
                        true, Instant.now())));
        final ResponseEntity<Map<String, Object>> res = ctl.put(
                principal(EdgeRole.ADMIN), uid,
                new ScopeAssignmentAdminController.Request("OU-ROOM-7", true));
        assertThat(res.getStatusCode().value()).isEqualTo(200);
        verify(scopes).upsertOrgUnit(eq(uid), eq("OU-ROOM-7"), eq(true));
    }

    @Test
    void deleteReturns404WhenAbsent() {
        final UUID uid = UUID.randomUUID();
        when(scopes.deleteOrgUnit(uid)).thenReturn(0);
        final ResponseEntity<Map<String, Object>> res =
                ctl.delete(principal(EdgeRole.ADMIN), uid);
        assertThat(res.getStatusCode().value()).isEqualTo(404);
    }

    @Test
    void deleteReturns204OnSuccess() {
        final UUID uid = UUID.randomUUID();
        when(scopes.deleteOrgUnit(uid)).thenReturn(1);
        final ResponseEntity<Map<String, Object>> res =
                ctl.delete(principal(EdgeRole.ADMIN), uid);
        assertThat(res.getStatusCode().value()).isEqualTo(204);
    }
}
