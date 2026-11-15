package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

/**
 * Coverage for the FR-OU-005 {@code effectiveScopeFor} branch. The
 * service's pre-existing {@code current / bind / isInScope} behaviour
 * is already covered by {@code OrgUnitBindingServiceTest}; this file
 * adds the per-user scope decision table.
 */
class EffectiveScopeTest {

    private static final EdgeOrgUnitBinding BOUND = EdgeOrgUnitBinding.bound(
            "OU-CLINIC-A", "Clinic A",
            "/OU-ROOT/OU-DISTRICT/OU-CLINIC-A",
            UUID.randomUUID());

    @SuppressWarnings("unchecked")
    private static ObjectProvider<ScopeAssignmentRepository> provider(
            final ScopeAssignmentRepository repo) {
        final ObjectProvider<ScopeAssignmentRepository> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(repo);
        return p;
    }

    private static EdgeOrgUnitBindingRepository bindingRepo(
            final EdgeOrgUnitBinding current) {
        final EdgeOrgUnitBindingRepository r = mock(EdgeOrgUnitBindingRepository.class);
        when(r.read()).thenReturn(current);
        return r;
    }

    @Test
    void unboundEdgeAlwaysYieldsUnboundState() {
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo(EdgeOrgUnitBinding.empty()),
                provider(mock(ScopeAssignmentRepository.class)));
        final var r = svc.effectiveScopeFor(UUID.randomUUID());
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.UNBOUND);
    }

    @Test
    void noAssignmentFallsBackToDeviceBound() {
        final ScopeAssignmentRepository scopes = mock(ScopeAssignmentRepository.class);
        when(scopes.findOrgUnitScope(any())).thenReturn(Optional.empty());
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo(BOUND), provider(scopes));
        final var r = svc.effectiveScopeFor(UUID.randomUUID());
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.NO_ASSIGNMENT);
        assertThat(r.binding().orgUnitId()).isEqualTo("OU-CLINIC-A");
        assertThat(r.narrowedOu()).isNull();
    }

    @Test
    void validAssignmentNarrowsToSubtreeOu() {
        final UUID uid = UUID.randomUUID();
        final ScopeAssignmentRepository scopes = mock(ScopeAssignmentRepository.class);
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.of(
                new ScopeAssignmentRepository.Row(1L, uid, "OU-ROOM-7",
                        true, Instant.now())));
        final EdgeOrgUnitBindingRepository bindingRepo = bindingRepo(BOUND);
        when(bindingRepo.resolveOrgUnitPath("OU-ROOM-7"))
                .thenReturn("/OU-ROOT/OU-DISTRICT/OU-CLINIC-A/OU-ROOM-7");
        when(bindingRepo.resolveOrgUnitDisplayName("OU-ROOM-7"))
                .thenReturn("Room 7");
        when(bindingRepo.isUnderBoundSubtree(any(), any())).thenReturn(true);
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo, provider(scopes));
        final var r = svc.effectiveScopeFor(uid);
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.SCOPE_ASSIGNED);
        assertThat(r.narrowedOu()).isNotNull();
        assertThat(r.narrowedOu().orgUnitId()).isEqualTo("OU-ROOM-7");
        assertThat(r.narrowedOu().displayName()).isEqualTo("Room 7");
    }

    @Test
    void outOfBoundAssignmentFallsOutsideAndKeepsBinding() {
        final UUID uid = UUID.randomUUID();
        final ScopeAssignmentRepository scopes = mock(ScopeAssignmentRepository.class);
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.of(
                new ScopeAssignmentRepository.Row(1L, uid, "OU-OTHER-FACILITY",
                        true, Instant.now())));
        final EdgeOrgUnitBindingRepository bindingRepo = bindingRepo(BOUND);
        // The OU exists in the mirror but is outside the bound subtree.
        when(bindingRepo.resolveOrgUnitPath("OU-OTHER-FACILITY"))
                .thenReturn("/OU-ROOT/OU-OTHER-DISTRICT/OU-OTHER-FACILITY");
        when(bindingRepo.isUnderBoundSubtree(any(), any())).thenReturn(false);
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo, provider(scopes));
        final var r = svc.effectiveScopeFor(uid);
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.SCOPE_FALLS_OUTSIDE);
        assertThat(r.binding().orgUnitId()).isEqualTo("OU-CLINIC-A");
        assertThat(r.narrowedOu()).isNull();
    }

    @Test
    void assignmentPointingAtUnknownOuFallsOutside() {
        final UUID uid = UUID.randomUUID();
        final ScopeAssignmentRepository scopes = mock(ScopeAssignmentRepository.class);
        when(scopes.findOrgUnitScope(uid)).thenReturn(Optional.of(
                new ScopeAssignmentRepository.Row(1L, uid, "OU-GHOST",
                        true, Instant.now())));
        final EdgeOrgUnitBindingRepository bindingRepo = bindingRepo(BOUND);
        when(bindingRepo.resolveOrgUnitPath("OU-GHOST")).thenReturn(null);
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo, provider(scopes));
        final var r = svc.effectiveScopeFor(uid);
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.SCOPE_FALLS_OUTSIDE);
    }

    @Test
    void nullUserIdReturnsNoAssignment() {
        final OrgUnitBindingService svc = new OrgUnitBindingService(
                bindingRepo(BOUND),
                provider(mock(ScopeAssignmentRepository.class)));
        final var r = svc.effectiveScopeFor(null);
        assertThat(r.state())
                .isEqualTo(OrgUnitBindingService.EffectiveScope.State.NO_ASSIGNMENT);
    }
}
