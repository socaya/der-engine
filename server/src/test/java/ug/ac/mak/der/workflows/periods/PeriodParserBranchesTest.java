package ug.ac.mak.der.workflows.periods;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

class PeriodParserBranchesTest {

    private static CapabilityFlags caps() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        return b.build();
    }

    @Test
    void weeklyOutOfRangeLow() {
        assertThatThrownBy(() -> PeriodParser.parse("2026W0", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void biweeklyOutOfRangeLow() {
        assertThatThrownBy(() -> PeriodParser.parse("2026BiW0", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void monthlyOutOfRangeLow() {
        assertThatThrownBy(() -> PeriodParser.parse("202600", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void bimonthlyEvenMonthRejected() {
        assertThatThrownBy(() -> PeriodParser.parse("202604B", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void bimonthlyOutOfRangeHigh() {
        assertThatThrownBy(() -> PeriodParser.parse("202613B", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void allKnownPatternsAreCoveredByValidSamples() {
        assertThat(PeriodParser.parse("202601B", caps())).isNotNull();
        assertThat(PeriodParser.parse("202603B", caps())).isNotNull();
        assertThat(PeriodParser.parse("202605B", caps())).isNotNull();
        assertThat(PeriodParser.parse("202607B", caps())).isNotNull();
        assertThat(PeriodParser.parse("202609B", caps())).isNotNull();
        assertThat(PeriodParser.parse("202611B", caps())).isNotNull();
    }

    @Test
    void yearlyLeadingZeroStillYear() {
        assertThat(PeriodParser.parse("0001", caps())).isNotNull();
    }

    @Test
    void biweeklyWithMaxValid() {
        assertThat(PeriodParser.parse("2026BiW27", caps())).isNotNull();
    }

    @Test
    void weeklyWithMaxValid() {
        assertThat(PeriodParser.parse("2020W53", caps())).isNotNull();
    }
}
