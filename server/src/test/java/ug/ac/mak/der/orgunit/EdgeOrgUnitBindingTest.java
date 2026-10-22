package ug.ac.mak.der.orgunit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeOrgUnitBindingTest {

    @Test
    void emptyIsUnbound() {
        assertThat(EdgeOrgUnitBinding.empty().isBound()).isFalse();
    }

    @Test
    void boundRequiresEveryField() {
        assertThatThrownBy(() -> EdgeOrgUnitBinding.bound(null, "x", "/p", UUID.randomUUID()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> EdgeOrgUnitBinding.bound("id", null, "/p", UUID.randomUUID()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> EdgeOrgUnitBinding.bound("id", "x", null, UUID.randomUUID()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> EdgeOrgUnitBinding.bound("id", "x", "/p", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void boundHasAllFields() {
        final UUID u = UUID.randomUUID();
        final EdgeOrgUnitBinding b = EdgeOrgUnitBinding.bound("id1", "Clinic X", "/root/id1", u);
        assertThat(b.isBound()).isTrue();
        assertThat(b.orgUnitId()).isEqualTo("id1");
        assertThat(b.orgUnitDisplayName()).isEqualTo("Clinic X");
        assertThat(b.orgUnitPath()).isEqualTo("/root/id1");
        assertThat(b.boundBy()).isEqualTo(u);
        assertThat(b.boundAt()).isNotNull();
    }

    @Test
    void arbitraryRecordNullsAreUnbound() {
        final EdgeOrgUnitBinding b = new EdgeOrgUnitBinding(null, null, null, Instant.now(), null);
        assertThat(b.isBound()).isFalse();
    }
}
