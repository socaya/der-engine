package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.compatibility.profiles.V241Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V242Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V243Profile;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

class Dhis2ProfileRegistryTest {

    private final Dhis2ProfileRegistry registry = Dhis2ProfileRegistry.defaultRegistry();

    @Test
    void exactMinorMatch() {
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.41")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_41");
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.42")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_42");
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.43")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_43");
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.44-SNAPSHOT")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_44");
    }

    @Test
    void aboveMaxFallsBackToMax() {
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.45")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_44");
    }

    @Test
    void belowMinReturnsEmpty() {
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.40"))).isEmpty();
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("2.30"))).isEmpty();
    }

    @Test
    void nonTwoMajorReturnsEmpty() {
        assertThat(registry.resolve(Dhis2SemanticVersion.parse("3.0"))).isEmpty();
    }

    @Test
    void gapBetweenProfilesFallsBackLower() {
        // Build a registry missing 2.43 to prove the floor-match path.
        final Dhis2ProfileRegistry withHole = new Dhis2ProfileRegistry(41, 44, List.of(
                new V241Profile(), new V242Profile(), new V244Profile()));
        assertThat(withHole.resolve(Dhis2SemanticVersion.parse("2.43")))
                .get().extracting(Dhis2VersionProfile::minorKey).isEqualTo("V2_42");
    }

    @Test
    void profileAccessorsAreExposed() {
        assertThat(registry.minSupportedMinor()).isEqualTo(41);
        assertThat(registry.maxTestedMinor()).isEqualTo(44);
    }

    @Test
    void rejectsEmptyProfiles() {
        assertThatThrownBy(() -> new Dhis2ProfileRegistry(41, 44, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dhis2ProfileRegistry(41, 44, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void profilesHaveLabelsAndKeys() {
        assertThat(new V241Profile().label()).isEqualTo("2.41");
        assertThat(new V242Profile().label()).isEqualTo("2.42");
        assertThat(new V243Profile().label()).isEqualTo("2.43");
        assertThat(new V244Profile().label()).isEqualTo("2.44");
    }

    @Test
    void floorEntryEmptyReturnsEmpty() {
        // A registry whose only profile is above the queried minor, with the
        // queried minor still above the configured floor, exercises the final
        // `return Optional.empty()` branch.
        final Dhis2ProfileRegistry only44 = new Dhis2ProfileRegistry(10, 44, List.of(new V244Profile()));
        assertThat(only44.resolve(Dhis2SemanticVersion.parse("2.15"))).isEmpty();
    }

    @Test
    void rejectMalformedMinorKey() {
        assertThatThrownBy(() -> new Dhis2ProfileRegistry(41, 44, List.of(new Dhis2VersionProfile() {
            @Override
            public String minorKey() {
                return "BAD";
            }

            @Override
            public String label() {
                return "bad";
            }

            @Override
            public void apply(final CapabilityFlags.Builder b) { }
        }))).isInstanceOf(IllegalArgumentException.class);
    }
}
