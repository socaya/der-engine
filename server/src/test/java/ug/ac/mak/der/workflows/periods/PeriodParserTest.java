package ug.ac.mak.der.workflows.periods;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;

class PeriodParserTest {

    private static CapabilityFlags caps() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        return b.build();
    }

    private static CapabilityFlags noPeriods() {
        return new CapabilityFlags.Builder()
                .trackerApi(CapabilityFlags.TrackerApi.NONE)
                .importSummaryShape(CapabilityFlags.ImportSummaryShape.CLASSIC)
                .webMessageShape(CapabilityFlags.WebMessageShape.DHIS2_2_41)
                .build();
    }

    @Test
    void yearly() {
        final ParsedPeriod p = PeriodParser.parse("2026", caps());
        assertThat(p.type()).isEqualTo(PeriodType.YEARLY);
        assertThat(p.startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(p.endDate()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void quarterly() {
        assertThat(PeriodParser.parse("2026Q1", caps()).startDate())
                .isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(PeriodParser.parse("2026Q4", caps()).endDate())
                .isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void monthly() {
        final ParsedPeriod p = PeriodParser.parse("202604", caps());
        assertThat(p.type()).isEqualTo(PeriodType.MONTHLY);
        assertThat(p.startDate()).isEqualTo(LocalDate.of(2026, 4, 1));
        assertThat(p.endDate()).isEqualTo(LocalDate.of(2026, 4, 30));
    }

    @Test
    void monthlyOutOfRange() {
        assertThatThrownBy(() -> PeriodParser.parse("202613", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void daily() {
        final ParsedPeriod p = PeriodParser.parse("20260122", caps());
        assertThat(p.type()).isEqualTo(PeriodType.DAILY);
        assertThat(p.startDate()).isEqualTo(LocalDate.of(2026, 1, 22));
    }

    @Test
    void dailyInvalid() {
        assertThatThrownBy(() -> PeriodParser.parse("20260231", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void weekly() {
        assertThat(PeriodParser.parse("2026W1", caps()).type()).isEqualTo(PeriodType.WEEKLY);
        assertThatThrownBy(() -> PeriodParser.parse("2026W54", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void biweekly() {
        assertThat(PeriodParser.parse("2026BiW1", caps()).type()).isEqualTo(PeriodType.BIWEEKLY);
        assertThatThrownBy(() -> PeriodParser.parse("2026BiW30", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void bimonthly() {
        assertThat(PeriodParser.parse("202601B", caps()).type()).isEqualTo(PeriodType.BIMONTHLY);
        assertThatThrownBy(() -> PeriodParser.parse("202602B", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void sixMonthly() {
        assertThat(PeriodParser.parse("2026S1", caps()).type()).isEqualTo(PeriodType.SIXMONTHLY);
        assertThat(PeriodParser.parse("2026S2", caps()).type()).isEqualTo(PeriodType.SIXMONTHLY);
    }

    @Test
    void sixMonthlyApril() {
        assertThat(PeriodParser.parse("2026AprilS1", caps()).type())
                .isEqualTo(PeriodType.SIXMONTHLYAPRIL);
        assertThat(PeriodParser.parse("2026AprilS2", caps()).startDate())
                .isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void financialYears() {
        assertThat(PeriodParser.parse("2026April", caps()).type())
                .isEqualTo(PeriodType.FINANCIALAPRIL);
        assertThat(PeriodParser.parse("2026July", caps()).type())
                .isEqualTo(PeriodType.FINANCIALJULY);
        assertThat(PeriodParser.parse("2026Oct", caps()).type())
                .isEqualTo(PeriodType.FINANCIALOCT);
    }

    @Test
    void nullRejected() {
        assertThatThrownBy(() -> PeriodParser.parse(null, caps()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void unknownRejected() {
        assertThatThrownBy(() -> PeriodParser.parse("gibberish", caps()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void unsupportedTypeRejected() {
        assertThatThrownBy(() -> PeriodParser.parse("2026", noPeriods()))
                .isInstanceOf(PeriodParseException.class);
    }

    @Test
    void parsedPeriodValidatesRange() {
        assertThatThrownBy(() -> new ParsedPeriod("x", PeriodType.YEARLY,
                LocalDate.of(2026, 12, 31), LocalDate.of(2026, 1, 1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
