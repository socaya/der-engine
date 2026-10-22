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
        // ADR-0006 renamed pinnedVersion -> maxTestedVersion (2.44 by default).
        assertThat(p.compatibility().maxTestedVersion()).isEqualTo("2.44");
        assertThat(p.compatibility().minSupportedVersion()).isEqualTo("2.41");
        assertThat(p.compatibility().mode()).isEqualTo("strict");
        assertThat(p.compatibility().allowUnsupported()).isFalse();
    }

    @Test
    void legacyFactoryPopulatesNewFields() {
        final Dhis2Properties.Compatibility c = Dhis2Properties.Compatibility.legacy(
                "2.44-SNAPSHOT", true);
        assertThat(c.pinnedVersion()).isEqualTo("2.44-SNAPSHOT");
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
        assertThat(c.allowMismatch()).isTrue();
        assertThat(c.allowUnsupported()).isTrue();
    }

    @Test
    void legacyFactoryHandlesBlankPin() {
        final Dhis2Properties.Compatibility c = Dhis2Properties.Compatibility.legacy("", false);
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
    }

    @Test
    void compactConstructorAppliesSensibleDefaults() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                null, null, null, false, 0, false, null, false);
        assertThat(c.minSupportedVersion()).isEqualTo("2.41");
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
        assertThat(c.mode()).isEqualTo("strict");
        assertThat(c.strict()).isTrue();
        assertThat(c.snapshotTtlHours()).isEqualTo(168);
        assertThat(c.pinnedVersion()).isEqualTo("2.44");
    }

    @Test
    void permissiveModeDetected() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", "2.44", "permissive", false, 24, false, null, false);
        assertThat(c.strict()).isFalse();
    }

    @Test
    void blankMinSupportedUsesDefault() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "", "2.44", "strict", false, 24, false, null, false);
        assertThat(c.minSupportedVersion()).isEqualTo("2.41");
    }

    @Test
    void blankMaxTestedFromPinnedWithSnapshot() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", null, "strict", false, 24, false, "2.44-SNAPSHOT", false);
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
    }

    @Test
    void blankMaxTestedBlankPinnedUsesDefault() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", "", "strict", false, 24, false, "", false);
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
    }

    @Test
    void pinnedBlankTakesMaxTested() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", "2.43", "strict", false, 24, false, "", false);
        assertThat(c.pinnedVersion()).isEqualTo("2.43");
    }

    @Test
    void blankModeUsesStrictDefault() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", "2.44", "", false, 24, false, "2.44", false);
        assertThat(c.mode()).isEqualTo("strict");
    }

    @Test
    void legacyFactoryHandlesNullPin() {
        final Dhis2Properties.Compatibility c = Dhis2Properties.Compatibility.legacy(null, false);
        assertThat(c.maxTestedVersion()).isEqualTo("2.44");
    }

    @Test
    void allowMismatchImpliesAllowUnsupported() {
        final Dhis2Properties.Compatibility c = new Dhis2Properties.Compatibility(
                "2.41", "2.44", "strict", false, 24, false, "2.44", true);
        assertThat(c.allowUnsupported()).isTrue();
    }

    @Test
    void explicitValuesSurvive() {
        final Dhis2Properties p = new Dhis2Properties(
                new Dhis2Properties.Central("http://x/dhis", "u", "p", 1234),
                Dhis2Properties.Compatibility.legacy("2.44", true));
        assertThat(p.central().baseUrl()).isEqualTo("http://x/dhis");
        assertThat(p.central().connectTimeoutMillis()).isEqualTo(1234);
        assertThat(p.compatibility().pinnedVersion()).isEqualTo("2.44");
        assertThat(p.compatibility().allowMismatch()).isTrue();
    }
}
