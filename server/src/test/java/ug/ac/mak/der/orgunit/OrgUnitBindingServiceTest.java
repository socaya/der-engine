package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class OrgUnitBindingServiceTest {

    @Test
    void bindResolvesPathAndWrites() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        when(repo.resolveOrgUnitPath("ou-1")).thenReturn("/root/ou-1");
        when(repo.resolveOrgUnitDisplayName("ou-1")).thenReturn("Clinic");
        final UUID u = UUID.randomUUID();
        final EdgeOrgUnitBinding bound = new OrgUnitBindingService(repo).bind("ou-1", u);
        assertThat(bound.orgUnitPath()).isEqualTo("/root/ou-1");
        verify(repo).write(bound);
    }

    @Test
    void bindRejectsBlankId() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        final OrgUnitBindingService svc = new OrgUnitBindingService(repo);
        assertThatThrownBy(() -> svc.bind(null, UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> svc.bind("  ", UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void bindRejectsWhenOrgUnitMissingFromMirror() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        when(repo.resolveOrgUnitPath("x")).thenReturn(null);
        assertThatThrownBy(() -> new OrgUnitBindingService(repo).bind("x", UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("metadata mirror");
    }

    @Test
    void isInScopeReturnsFalseWhenUnbound() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        when(repo.read()).thenReturn(EdgeOrgUnitBinding.empty());
        assertThat(new OrgUnitBindingService(repo).isInScope("x", 3)).isFalse();
    }

    @Test
    void isInScopeChecksSubtreeAndDepth() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound(
                "ou-root", "C", "/root/ou-root", UUID.randomUUID());
        when(repo.read()).thenReturn(bound);
        when(repo.resolveOrgUnitPath("ou-child")).thenReturn("/root/ou-root/ou-child");
        when(repo.resolveOrgUnitPath("ou-deep"))
                .thenReturn("/root/ou-root/ou-child/ou-sub/ou-deep");
        when(repo.resolveOrgUnitPath("ou-outside")).thenReturn("/other/ou-outside");
        when(repo.isUnderBoundSubtree(bound, "/root/ou-root/ou-child")).thenReturn(true);
        when(repo.isUnderBoundSubtree(bound, "/root/ou-root/ou-child/ou-sub/ou-deep")).thenReturn(true);
        when(repo.isUnderBoundSubtree(bound, "/other/ou-outside")).thenReturn(false);
        final OrgUnitBindingService svc = new OrgUnitBindingService(repo);
        assertThat(svc.isInScope("ou-child", 1)).isTrue();
        assertThat(svc.isInScope("ou-deep", 2)).isFalse();  // depth 3 > 2
        assertThat(svc.isInScope("ou-deep", 3)).isTrue();
        assertThat(svc.isInScope("ou-outside", 3)).isFalse();
    }

    @Test
    void isInScopeHandlesNullAndBlank() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        final OrgUnitBindingService svc = new OrgUnitBindingService(repo);
        assertThat(svc.isInScope(null, 3)).isFalse();
        assertThat(svc.isInScope("", 3)).isFalse();
    }

    @Test
    void isInScopeFalseWhenCandidatePathMissingFromMirror() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        final EdgeOrgUnitBinding bound = EdgeOrgUnitBinding.bound(
                "root", "R", "/root", UUID.randomUUID());
        when(repo.read()).thenReturn(bound);
        when(repo.resolveOrgUnitPath("x")).thenReturn(null);
        assertThat(new OrgUnitBindingService(repo).isInScope("x", 3)).isFalse();
    }

    @Test
    void relativeDepthSemantics() {
        assertThat(OrgUnitBindingService.relativeDepth("/a", "/a")).isZero();
        assertThat(OrgUnitBindingService.relativeDepth("/a", "/a/b")).isEqualTo(1);
        assertThat(OrgUnitBindingService.relativeDepth("/a", "/a/b/c")).isEqualTo(2);
        assertThat(OrgUnitBindingService.relativeDepth("/a", "/b")).isEqualTo(Integer.MAX_VALUE);
        assertThat(OrgUnitBindingService.relativeDepth(null, "/a")).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void currentDelegates() {
        final EdgeOrgUnitBindingRepository repo = mock(EdgeOrgUnitBindingRepository.class);
        when(repo.read()).thenReturn(EdgeOrgUnitBinding.empty());
        assertThat(new OrgUnitBindingService(repo).current().isBound()).isFalse();
    }
}
