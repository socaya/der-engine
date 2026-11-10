package ug.ac.mak.der.analytics.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

class AnalyticsPeriodEnumeratorTest {

    private final AnalyticsPeriodEnumerator svc = new AnalyticsPeriodEnumerator();

    @Test
    void resolveAcceptsCanonicalAndDhis2Spellings() {
        assertThat(AnalyticsPeriodEnumerator.resolve("MONTHLY"))
                .isEqualTo(AnalyticsPeriodEnumerator.Type.MONTHLY);
        assertThat(AnalyticsPeriodEnumerator.resolve("Monthly"))
                .isEqualTo(AnalyticsPeriodEnumerator.Type.MONTHLY);
        assertThat(AnalyticsPeriodEnumerator.resolve("Weekly"))
                .isEqualTo(AnalyticsPeriodEnumerator.Type.WEEKLY);
    }

    @Test
    void resolveReturnsNullForUnknown() {
        assertThat(AnalyticsPeriodEnumerator.resolve("Biweekly")).isNull();
        assertThat(AnalyticsPeriodEnumerator.resolve("")).isNull();
        assertThat(AnalyticsPeriodEnumerator.resolve(null)).isNull();
    }

    @Test
    void yearlyEnumeratesOneWindow() {
        final List<AnalyticsPeriodEnumerator.Window> ws =
                svc.enumerate(AnalyticsPeriodEnumerator.Type.YEARLY, 2026);
        assertThat(ws).hasSize(1);
        assertThat(ws.get(0).id()).isEqualTo("2026");
        assertThat(ws.get(0).startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(ws.get(0).endDate()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void quarterlyEnumeratesFourWindows() {
        final List<AnalyticsPeriodEnumerator.Window> ws =
                svc.enumerate(AnalyticsPeriodEnumerator.Type.QUARTERLY, 2026);
        assertThat(ws).hasSize(4);
        assertThat(ws.get(0).id()).isEqualTo("2026Q1");
        assertThat(ws.get(0).startDate()).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(ws.get(0).endDate()).isEqualTo(LocalDate.of(2026, 3, 31));
        assertThat(ws.get(3).id()).isEqualTo("2026Q4");
        assertThat(ws.get(3).endDate()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    void monthlyEnumeratesTwelveWindowsPaddingMonth() {
        final List<AnalyticsPeriodEnumerator.Window> ws =
                svc.enumerate(AnalyticsPeriodEnumerator.Type.MONTHLY, 2026);
        assertThat(ws).hasSize(12);
        assertThat(ws.get(0).id()).isEqualTo("202601");
        assertThat(ws.get(10).id()).isEqualTo("202611");
        assertThat(ws.get(11).id()).isEqualTo("202612");
        // February leap handling — 2026 is non-leap, so Feb ends on 28.
        assertThat(ws.get(1).endDate()).isEqualTo(LocalDate.of(2026, 2, 28));
        // 2024 is leap — regression guard.
        final List<AnalyticsPeriodEnumerator.Window> leap =
                svc.enumerate(AnalyticsPeriodEnumerator.Type.MONTHLY, 2024);
        assertThat(leap.get(1).endDate()).isEqualTo(LocalDate.of(2024, 2, 29));
    }

    @Test
    void weeklyIsoFollowsIsoYearBoundaries() {
        // 2026-01-01 is a Thursday — ISO week 1 starts Monday 2025-12-29.
        final List<AnalyticsPeriodEnumerator.Window> ws =
                svc.enumerate(AnalyticsPeriodEnumerator.Type.WEEKLY, 2026);
        assertThat(ws).isNotEmpty();
        assertThat(ws.get(0).id()).isEqualTo("2026W1");
        assertThat(ws.get(0).startDate()).isEqualTo(LocalDate.of(2025, 12, 29));
        assertThat(ws.get(0).endDate()).isEqualTo(LocalDate.of(2026, 1, 4));
        // 2026 has 53 weeks per ISO (year starting on Thursday).
        assertThat(ws.size()).isGreaterThanOrEqualTo(52);
    }

    @Test
    void dailyEnumerates365Or366Windows() {
        assertThat(svc.enumerate(AnalyticsPeriodEnumerator.Type.DAILY, 2026)).hasSize(365);
        assertThat(svc.enumerate(AnalyticsPeriodEnumerator.Type.DAILY, 2024)).hasSize(366);
    }

    @Test
    void outOfRangeYearRejected() {
        assertThatThrownBy(() -> svc.enumerate(
                AnalyticsPeriodEnumerator.Type.YEARLY, 1800))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void windowContainingMapsDateToCanonicalPeriod() {
        final LocalDate d = LocalDate.of(2026, 11, 10);
        assertThat(svc.windowContaining(
                AnalyticsPeriodEnumerator.Type.MONTHLY, d).id())
                .isEqualTo("202611");
        assertThat(svc.windowContaining(
                AnalyticsPeriodEnumerator.Type.QUARTERLY, d).id())
                .isEqualTo("2026Q4");
        assertThat(svc.windowContaining(
                AnalyticsPeriodEnumerator.Type.YEARLY, d).id())
                .isEqualTo("2026");
    }

    @Test
    void quarterIdFor() {
        assertThat(AnalyticsPeriodEnumerator.quarterIdFor(
                LocalDate.of(2026, 1, 15))).isEqualTo("2026Q1");
        assertThat(AnalyticsPeriodEnumerator.quarterIdFor(
                LocalDate.of(2026, 11, 10))).isEqualTo("2026Q4");
    }
}
