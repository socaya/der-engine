package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EndpointPolicyTest {

    @Test
    void presentFactoryBuilds() {
        final EndpointPolicy p = EndpointPolicy.present("/api/x", 41);
        assertThat(p.path()).isEqualTo("/api/x");
        assertThat(p.status()).isEqualTo(EndpointPolicy.Status.PRESENT);
        assertThat(p.sinceMinor()).isEqualTo(41);
        assertThat(p.removedMinor()).isNull();
        assertThat(p.replacement()).isNull();
        assertThat(p.notes()).isNull();
        assertThat(p.usable()).isTrue();
        assertThat(p.removed()).isFalse();
    }

    @Test
    void deprecatedFactoryBuilds() {
        final EndpointPolicy p = EndpointPolicy.deprecated("/api/x", 41,
                EndpointId.TRACKER_EVENTS, "note");
        assertThat(p.status()).isEqualTo(EndpointPolicy.Status.DEPRECATED);
        assertThat(p.replacement()).isEqualTo(EndpointId.TRACKER_EVENTS);
        assertThat(p.usable()).isTrue();
        assertThat(p.removed()).isFalse();
    }

    @Test
    void removedFactoryBuilds() {
        final EndpointPolicy p = EndpointPolicy.removed("/api/x", 41, 44,
                EndpointId.TRACKER_EVENTS, "gone");
        assertThat(p.status()).isEqualTo(EndpointPolicy.Status.REMOVED);
        assertThat(p.removedMinor()).isEqualTo(44);
        assertThat(p.usable()).isFalse();
        assertThat(p.removed()).isTrue();
    }

    @Test
    void notApplicableIsNeitherUsableNorRemoved() {
        final EndpointPolicy p = new EndpointPolicy("", EndpointPolicy.Status.NOT_APPLICABLE,
                null, null, null, "n/a");
        assertThat(p.usable()).isFalse();
        assertThat(p.removed()).isFalse();
    }

    @Test
    void rejectsNullPath() {
        assertThatThrownBy(() -> new EndpointPolicy(null, EndpointPolicy.Status.PRESENT,
                null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void rejectsNullStatus() {
        assertThatThrownBy(() -> new EndpointPolicy("/x", null,
                null, null, null, null))
                .isInstanceOf(NullPointerException.class);
    }
}
