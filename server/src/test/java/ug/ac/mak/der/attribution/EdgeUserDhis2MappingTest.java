package ug.ac.mak.der.attribution;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class EdgeUserDhis2MappingTest {

    @Test
    void acceptsValidDhis2Uid() {
        final UUID u = UUID.randomUUID();
        final EdgeUserDhis2Mapping m = new EdgeUserDhis2Mapping(
                u, "aBcDeFgHiJk", "nurse.alice", "Alice Nurse",
                Instant.now(), u, null);
        assertThat(m.dhis2UserUid()).isEqualTo("aBcDeFgHiJk");
    }

    @Test
    void rejectsShortUid() {
        assertThatThrownBy(() -> new EdgeUserDhis2Mapping(
                UUID.randomUUID(), "short", "u", null,
                Instant.now(), UUID.randomUUID(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNumericFirstCharUid() {
        assertThatThrownBy(() -> new EdgeUserDhis2Mapping(
                UUID.randomUUID(), "1BcDeFgHiJk", "u", null,
                Instant.now(), UUID.randomUUID(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsNullRequiredFields() {
        assertThatThrownBy(() -> new EdgeUserDhis2Mapping(
                null, "aBcDeFgHiJk", "u", null,
                Instant.now(), UUID.randomUUID(), null))
                .isInstanceOf(NullPointerException.class);
    }
}
