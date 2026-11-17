package ug.ac.mak.der.dhis2emulator;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Resolves DHIS2 relative-period tokens (e.g. {@code LAST_12_MONTHS},
 * {@code THIS_YEAR}, {@code QUARTERS_THIS_YEAR}) into the list of
 * literal ISO period codes DHIS2's analytics tables are keyed by.
 *
 * <p>Mirrors {@code RelativePeriods.java} in dhis2-core — the full
 * 45-entry catalogue exposed by
 * {@link AppShellEmptySurfacesController#relativePeriodTypes}. Each
 * token resolves against {@code LocalDate.now()}; a caller that needs
 * a reference date other than today (e.g. for historical replay)
 * should preprocess the request to pin an "as of" and call
 * {@link #resolveAt(String, LocalDate)} instead.</p>
 *
 * <p>Unknown tokens throw {@link IllegalArgumentException} so the
 * analytics controller can emit the standard DHIS2 409 envelope with
 * errorCode {@code E7124}. Literal ISO period codes ({@code 202501},
 * {@code 2025}, {@code 2025W01}, {@code 2025Q1}) are returned verbatim
 * so callers can pass a mixed set of literals and relative tokens
 * through one resolve step.</p>
 */
public final class RelativePeriodResolver {

    private static final DateTimeFormatter YYYY_MM = DateTimeFormatter.ofPattern("yyyyMM");
    private static final DateTimeFormatter YYYY_MM_DD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private RelativePeriodResolver() { }

    public static List<String> resolve(final String token) {
        return resolveAt(token, LocalDate.now());
    }

    public static List<String> resolveAt(final String token, final LocalDate today) {
        if (token == null || token.isBlank()) {
            return List.of();
        }
        final String t = token.trim();
        // Literal ISO periods pass through unchanged — callers can mix
        // relative + literal tokens in one `dimension=pe:` spec.
        if (isLiteralPeriod(t)) {
            return List.of(t);
        }
        final String upper = t.toUpperCase(Locale.ROOT);
        return switch (upper) {
            // Days
            case "TODAY" -> List.of(fmtDay(today));
            case "YESTERDAY" -> List.of(fmtDay(today.minusDays(1)));
            case "LAST_3_DAYS" -> lastDays(today, 3);
            case "LAST_7_DAYS" -> lastDays(today, 7);
            case "LAST_14_DAYS" -> lastDays(today, 14);
            case "LAST_30_DAYS" -> lastDays(today, 30);
            case "LAST_60_DAYS" -> lastDays(today, 60);
            case "LAST_90_DAYS" -> lastDays(today, 90);
            case "LAST_180_DAYS" -> lastDays(today, 180);
            // Weeks
            case "THIS_WEEK" -> List.of(fmtWeek(today));
            case "LAST_WEEK" -> List.of(fmtWeek(today.minusWeeks(1)));
            case "LAST_4_WEEKS" -> lastWeeks(today, 4);
            case "LAST_12_WEEKS" -> lastWeeks(today, 12);
            case "LAST_52_WEEKS" -> lastWeeks(today, 52);
            case "WEEKS_THIS_YEAR" -> weeksOfYear(today.getYear(), today);
            // Bimonths
            case "THIS_BIMONTH" -> List.of(fmtBimonth(today));
            case "LAST_BIMONTH" -> List.of(fmtBimonth(today.minusMonths(2)));
            case "LAST_6_BIMONTHS" -> lastBimonths(today, 6);
            case "BIMONTHS_THIS_YEAR" -> bimonthsOfYear(today.getYear());
            // Months
            case "THIS_MONTH" -> List.of(today.format(YYYY_MM));
            case "LAST_MONTH" -> List.of(today.minusMonths(1).format(YYYY_MM));
            case "LAST_3_MONTHS" -> lastMonths(today, 3);
            case "LAST_6_MONTHS" -> lastMonths(today, 6);
            case "LAST_12_MONTHS" -> lastMonths(today, 12);
            case "MONTHS_THIS_YEAR" -> monthsOfYear(today.getYear());
            case "MONTHS_LAST_YEAR" -> monthsOfYear(today.getYear() - 1);
            // Quarters
            case "THIS_QUARTER" -> List.of(fmtQuarter(today));
            case "LAST_QUARTER" -> List.of(fmtQuarter(today.minusMonths(3)));
            case "LAST_4_QUARTERS" -> lastQuarters(today, 4);
            case "QUARTERS_THIS_YEAR" -> quartersOfYear(today.getYear());
            case "QUARTERS_LAST_YEAR" -> quartersOfYear(today.getYear() - 1);
            // Six-months
            case "THIS_SIX_MONTH" -> List.of(fmtSixMonth(today));
            case "LAST_SIX_MONTH" -> List.of(fmtSixMonth(today.minusMonths(6)));
            case "LAST_2_SIXMONTHS" -> lastSixMonths(today, 2);
            // Years
            case "THIS_YEAR" -> List.of(Integer.toString(today.getYear()));
            case "LAST_YEAR" -> List.of(Integer.toString(today.getYear() - 1));
            case "LAST_5_YEARS" -> lastYears(today, 5);
            case "LAST_10_YEARS" -> lastYears(today, 10);
            // Financial years (July-start — the DHIS2 default when the
            // caller doesn't specify; FinancialApril/Nov variants land
            // in a follow-up batch along with the central-side
            // financial-year-anchor system setting).
            case "THIS_FINANCIAL_YEAR" -> List.of(fmtFinancialYear(today, 7));
            case "LAST_FINANCIAL_YEAR" -> List.of(fmtFinancialYear(today.minusYears(1), 7));
            case "LAST_5_FINANCIAL_YEARS" -> lastFinancialYears(today, 5, 7);
            case "LAST_10_FINANCIAL_YEARS" -> lastFinancialYears(today, 10, 7);
            default -> throw new IllegalArgumentException(
                    "Unknown relative period: " + token);
        };
    }

    /** True for YYYYMMDD / YYYYMM / YYYY / YYYYWnn / YYYYQn / YYYYSn. */
    private static boolean isLiteralPeriod(final String t) {
        return t.matches("\\d{4}(\\d{2}(\\d{2})?)?"
                + "|\\d{4}W\\d{1,2}"
                + "|\\d{4}Q[1-4]"
                + "|\\d{4}S[1-2]"
                + "|\\d{4}B\\d{1,2}");
    }

    private static String fmtDay(final LocalDate d) {
        return d.format(YYYY_MM_DD);
    }

    private static List<String> lastDays(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(fmtDay(today.minusDays(i)));
        }
        return out;
    }

    private static String fmtWeek(final LocalDate d) {
        final WeekFields wf = WeekFields.ISO;
        final int week = d.get(wf.weekOfWeekBasedYear());
        final int year = d.get(wf.weekBasedYear());
        return year + "W" + week;
    }

    private static List<String> lastWeeks(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(fmtWeek(today.minusWeeks(i)));
        }
        return out;
    }

    private static List<String> weeksOfYear(final int year, final LocalDate today) {
        final List<String> out = new ArrayList<>(53);
        final int maxWeek = LocalDate.of(year, 12, 28)
                .get(WeekFields.ISO.weekOfWeekBasedYear());
        final int upTo = (today.getYear() == year)
                ? today.get(WeekFields.ISO.weekOfWeekBasedYear()) : maxWeek;
        for (int w = 1; w <= upTo; w++) {
            out.add(year + "W" + w);
        }
        return out;
    }

    private static String fmtBimonth(final LocalDate d) {
        final int bimonthOfYear = ((d.getMonthValue() - 1) / 2) + 1;
        return d.getYear() + "0" + bimonthOfYear + "B";
    }

    private static List<String> lastBimonths(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(fmtBimonth(today.minusMonths(2L * i)));
        }
        return out;
    }

    private static List<String> bimonthsOfYear(final int year) {
        final List<String> out = new ArrayList<>(6);
        for (int b = 1; b <= 6; b++) {
            out.add(year + "0" + b + "B");
        }
        return out;
    }

    private static List<String> lastMonths(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(today.minusMonths(i).format(YYYY_MM));
        }
        return out;
    }

    private static List<String> monthsOfYear(final int year) {
        final List<String> out = new ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            out.add(String.format("%d%02d", year, m));
        }
        return out;
    }

    private static String fmtQuarter(final LocalDate d) {
        return d.getYear() + "Q" + d.get(IsoFields.QUARTER_OF_YEAR);
    }

    private static List<String> lastQuarters(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(fmtQuarter(today.minusMonths(3L * i)));
        }
        return out;
    }

    private static List<String> quartersOfYear(final int year) {
        final List<String> out = new ArrayList<>(4);
        for (int q = 1; q <= 4; q++) {
            out.add(year + "Q" + q);
        }
        return out;
    }

    private static String fmtSixMonth(final LocalDate d) {
        final int s = d.getMonthValue() <= 6 ? 1 : 2;
        return d.getYear() + "S" + s;
    }

    private static List<String> lastSixMonths(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(fmtSixMonth(today.minusMonths(6L * i)));
        }
        return out;
    }

    private static List<String> lastYears(final LocalDate today, final int n) {
        final List<String> out = new ArrayList<>(n);
        for (int i = n; i >= 1; i--) {
            out.add(Integer.toString(today.getYear() - i));
        }
        return out;
    }

    /** DHIS2 financial-year code is the year the fiscal period STARTS in,
     *  with an anchor month suffix for non-July starts (central uses
     *  {@code 2024July}, {@code 2024April}, …). July is the default on
     *  a fresh install. */
    private static String fmtFinancialYear(final LocalDate d, final int anchorMonth) {
        final int fyStart = d.getMonthValue() >= anchorMonth
                ? d.getYear() : d.getYear() - 1;
        return fyStart + anchorSuffix(anchorMonth);
    }

    private static List<String> lastFinancialYears(final LocalDate today,
                                                     final int n, final int anchorMonth) {
        final List<String> out = new ArrayList<>(n);
        final int currentFy = today.getMonthValue() >= anchorMonth
                ? today.getYear() : today.getYear() - 1;
        for (int i = n; i >= 1; i--) {
            out.add((currentFy - i) + anchorSuffix(anchorMonth));
        }
        return out;
    }

    private static String anchorSuffix(final int anchorMonth) {
        return switch (anchorMonth) {
            case 1 -> "";
            case 4 -> "April";
            case 7 -> "July";
            case 10 -> "Oct";
            case 11 -> "Nov";
            default -> "July";
        };
    }
}
