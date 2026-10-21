package ug.ac.mak.der.dhis2;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class Dhis2VersionTest {

    @Test
    void requiredFieldsArePresent() {
        final Dhis2Version v = new Dhis2Version("2.44-SNAPSHOT", "abc1234", "2026-08-19T23:39:17.000");
        assertThat(v.version()).isEqualTo("2.44-SNAPSHOT");
        assertThat(v.revision()).isEqualTo("abc1234");
        assertThat(v.buildTime()).isEqualTo("2026-08-19T23:39:17.000");
        assertThat(v.isBlank()).isFalse();
    }

    @Test
    void nullableFieldsMayBeAbsent() {
        final Dhis2Version v = new Dhis2Version("2.44", null, null);
        assertThat(v.revision()).isNull();
        assertThat(v.buildTime()).isNull();
    }

    @Test
    void rejectsNullVersion() {
        assertThatThrownBy(() -> new Dhis2Version(null, null, null))
                .isInstanceOf(NullPointerException.class).hasMessage("version");
    }

    @Test
    void blankVersionReportsIsBlank() {
        assertThat(new Dhis2Version("   ", null, null).isBlank()).isTrue();
        assertThat(new Dhis2Version("", null, null).isBlank()).isTrue();
    }

    @Test
    void factoryBuildsBareInstance() {
        final Dhis2Version v = Dhis2Version.of("2.44-SNAPSHOT");
        assertThat(v.version()).isEqualTo("2.44-SNAPSHOT");
        assertThat(v.revision()).isNull();
        assertThat(v.buildTime()).isNull();
    }
}
