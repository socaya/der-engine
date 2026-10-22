package ug.ac.mak.der.dhis2.compatibility;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class Dhis2SemanticVersionTest {

    @Test
    void parsesMajorMinor() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44");
        assertThat(v.major()).isEqualTo(2);
        assertThat(v.minor()).isEqualTo(44);
        assertThat(v.patch()).isNull();
        assertThat(v.snapshot()).isFalse();
        assertThat(v.raw()).isEqualTo("2.44");
    }

    @Test
    void parsesMajorMinorPatch() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44.1");
        assertThat(v.patch()).isEqualTo(1);
        assertThat(v.snapshot()).isFalse();
    }

    @Test
    void parsesSnapshot() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44-SNAPSHOT");
        assertThat(v.minor()).isEqualTo(44);
        assertThat(v.snapshot()).isTrue();
        assertThat(v.patch()).isNull();
    }

    @Test
    void parsesPatchSnapshot() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44.0-SNAPSHOT");
        assertThat(v.patch()).isEqualTo(0);
        assertThat(v.snapshot()).isTrue();
    }

    @Test
    void parsesExtendedSnapshotLabel() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44-SNAPSHOT-2026.05");
        assertThat(v.minor()).isEqualTo(44);
        assertThat(v.snapshot()).isTrue();
    }

    @Test
    void trimsWhitespace() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("  2.42 ");
        assertThat(v.minor()).isEqualTo(42);
        assertThat(v.raw()).isEqualTo("2.42");
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> Dhis2SemanticVersion.parse(null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlank() {
        assertThatThrownBy(() -> Dhis2SemanticVersion.parse(""))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsMalformed() {
        assertThatThrownBy(() -> Dhis2SemanticVersion.parse("not-a-version"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Dhis2SemanticVersion.parse("2"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Dhis2SemanticVersion.parse("2."))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void tryParseReturnsNullOnFailure() {
        assertThat(Dhis2SemanticVersion.tryParse("not-a-version")).isNull();
        assertThat(Dhis2SemanticVersion.tryParse("2.44")).isNotNull();
    }

    @Test
    void isAtLeastHandlesMajorDifference() {
        final Dhis2SemanticVersion v3 = Dhis2SemanticVersion.parse("3.0");
        final Dhis2SemanticVersion v2 = Dhis2SemanticVersion.parse("2.44");
        assertThat(v3.isAtLeast(2, 41)).isTrue();
        assertThat(v2.isAtLeast(3, 0)).isFalse();
    }

    @Test
    void isAtLeastHandlesMinorBoundary() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44");
        assertThat(v.isAtLeast(2, 44)).isTrue();
        assertThat(v.isAtLeast(2, 45)).isFalse();
        assertThat(v.isAtLeast(2, 41)).isTrue();
    }

    @Test
    void isAtMostHandlesBoundary() {
        final Dhis2SemanticVersion v = Dhis2SemanticVersion.parse("2.44");
        assertThat(v.isAtMost(2, 44)).isTrue();
        assertThat(v.isAtMost(2, 43)).isFalse();
        assertThat(v.isAtMost(3, 0)).isTrue();
        assertThat(v.isAtMost(1, 99)).isFalse();
    }

    @Test
    void minorKeyIsStable() {
        assertThat(Dhis2SemanticVersion.parse("2.44").minorKey()).isEqualTo("V2_44");
        assertThat(Dhis2SemanticVersion.parse("2.41-SNAPSHOT").minorKey()).isEqualTo("V2_41");
    }

    @Test
    void comparableOrdersCorrectly() {
        final Dhis2SemanticVersion a = Dhis2SemanticVersion.parse("2.41");
        final Dhis2SemanticVersion b = Dhis2SemanticVersion.parse("2.44");
        final Dhis2SemanticVersion c = Dhis2SemanticVersion.parse("2.44-SNAPSHOT");
        final Dhis2SemanticVersion d = Dhis2SemanticVersion.parse("2.44.1");
        assertThat(a).isLessThan(b);
        assertThat(c).isLessThan(b); // snapshot sorts before release
        assertThat(b).isLessThan(d);
        assertThat(Dhis2SemanticVersion.parse("3.0")).isGreaterThan(d);
    }

    @Test
    void comparableWithSameEverything() {
        final Dhis2SemanticVersion a = Dhis2SemanticVersion.parse("2.44.1");
        final Dhis2SemanticVersion b = Dhis2SemanticVersion.parse("2.44.1");
        assertThat(a.compareTo(b)).isZero();
    }

    @Test
    void explicitRecordCanBeConstructed() {
        final Dhis2SemanticVersion v = new Dhis2SemanticVersion(2, 44, 0, false, "2.44.0");
        assertThat(v.patch()).isEqualTo(0);
    }

    @Test
    void explicitRecordRejectsNegatives() {
        assertThatThrownBy(() -> new Dhis2SemanticVersion(-1, 44, null, false, "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dhis2SemanticVersion(2, -1, null, false, "x"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new Dhis2SemanticVersion(2, 44, -1, false, "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
