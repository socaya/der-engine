package ug.ac.mak.der.dhis2;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class Dhis2PropertiesTest {

    @Test
    void defaultsAppliedWhenNullsPassed() {
        final Dhis2Properties p = new Dhis2Properties(null, null);
        assertThat(p.central().baseUrl()).isNull();
        assertThat(p.central().username()).isNull();
        assertThat(p.central().password()).isNull();
        assertThat(p.central().connectTimeoutMillis()).isEqualTo(10_000);
        assertThat(p.compatibility().pinnedVersion()).isEqualTo("2.44-SNAPSHOT");
        assertThat(p.compatibility().allowMismatch()).isFalse();
    }

    @Test
    void explicitValuesSurvive() {
        final Dhis2Properties p = new Dhis2Properties(
                new Dhis2Properties.Central("http://x/dhis", "u", "p", 1234),
                new Dhis2Properties.Compatibility("2.44", true));
        assertThat(p.central().baseUrl()).isEqualTo("http://x/dhis");
        assertThat(p.central().connectTimeoutMillis()).isEqualTo(1234);
        assertThat(p.compatibility().pinnedVersion()).isEqualTo("2.44");
        assertThat(p.compatibility().allowMismatch()).isTrue();
    }
}
