package ug.ac.mak.der.workflows.periods;

import java.time.LocalDate;
import java.time.Month;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.time.temporal.IsoFields;
import java.time.temporal.WeekFields;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags.PeriodType;

/**
 * Parser for DHIS2 period codes.
 *
 * <p>Only period types the active {@link CapabilityFlags#supportedPeriodTypes()}
 * declares are accepted. Unknown or out-of-range codes raise
 * {@link PeriodParseException}; the caller must surface this as HTTP 409 /
 * {@code status=WARNING} with a DHIS2-shape conflict entry.</p>
 *
 * <p>Supported codes (per period type):</p>
 * <ul>
 *   <li>YEARLY: {@code 2026}</li>
 *   <li>QUARTERLY: {@code 2026Q1}..{@code 2026Q4}</li>
 *   <li>MONTHLY: {@code 202601}..{@code 202612}</li>
 *   <li>WEEKLY: {@code 2026W1}..{@code 2026W53}</li>
 *   <li>DAILY: {@code 20260122}</li>
 *   <li>BIMONTHLY: {@code 202601B}..{@code 202606B}</li>
 *   <li>SIXMONTHLY: {@code 2026S1}, {@code 2026S2}</li>
 *   <li>SIXMONTHLYAPRIL: {@code 2026AprilS1}, {@code 2026AprilS2}</li>
 *   <li>FINANCIALOCT: {@code 2026Oct}</li>
 *   <li>FINANCIALJULY: {@code 2026July}</li>
 *   <li>FINANCIALAPRIL: {@code 2026April}</li>
 *   <li>BIWEEKLY: {@code 2026BiW1}..{@code 2026BiW27}</li>
 * </ul>
 */
public final class PeriodParser {

    private static final Pattern YEARLY = Pattern.compile("^(\\d{4})$");
    private static final Pattern QUARTERLY = Pattern.compile("^(\\d{4})Q([1-4])$");
    private static final Pattern MONTHLY = Pattern.compile("^(\\d{4})(\\d{2})$");
    private static final Pattern WEEKLY = Pattern.compile("^(\\d{4})W(\\d{1,2})$");
    private static final Pattern DAILY = Pattern.compile("^(\\d{4})(\\d{2})(\\d{2})$");
    private static final Pattern BIMONTHLY = Pattern.compile("^(\\d{4})(\\d{2})B$");
    private static final Pattern SIXMONTHLY = Pattern.compile("^(\\d{4})S([12])$");
    private static final Pattern SIXMONTHLY_APRIL = Pattern.compile("^(\\d{4})AprilS([12])$");
    private static final Pattern FIN_OCT = Pattern.compile("^(\\d{4})Oct$");
    private static final Pattern FIN_JULY = Pattern.compile("^(\\d{4})July$");
    private static final Pattern FIN_APRIL = Pattern.compile("^(\\d{4})April$");
    private static final Pattern BIWEEKLY = Pattern.compile("^(\\d{4})BiW(\\d{1,2})$");

    private PeriodParser() { }

    public static ParsedPeriod parse(final String code, final CapabilityFlags capabilities) {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(capabilities, "capabilities");
        final Optional<ParsedPeriod> yearly = tryYearly(code, capabilities);
        if (yearly.isPresent()) {
            return yearly.get();
        }
        final Optional<ParsedPeriod> quarterly = tryQuarterly(code, capabilities);
        if (quarterly.isPresent()) {
            return quarterly.get();
        }
        final Optional<ParsedPeriod> sixAprilM = trySixMonthlyApril(code, capabilities);
        if (sixAprilM.isPresent()) {
            return sixAprilM.get();
        }
        final Optional<ParsedPeriod> sixMonthly = trySixMonthly(code, capabilities);
        if (sixMonthly.isPresent()) {
            return sixMonthly.get();
        }
        final Optional<ParsedPeriod> finApril = tryFinancial(code, capabilities, FIN_APRIL,
                PeriodType.FINANCIALAPRIL, Month.APRIL);
        if (finApril.isPresent()) {
            return finApril.get();
        }
        final Optional<ParsedPeriod> finJuly = tryFinancial(code, capabilities, FIN_JULY,
                PeriodType.FINANCIALJULY, Month.JULY);
        if (finJuly.isPresent()) {
            return finJuly.get();
        }
        final Optional<ParsedPeriod> finOct = tryFinancial(code, capabilities, FIN_OCT,
                PeriodType.FINANCIALOCT, Month.OCTOBER);
        if (finOct.isPresent()) {
            return finOct.get();
        }
        final Optional<ParsedPeriod> biweekly = tryBiweekly(code, capabilities);
        if (biweekly.isPresent()) {
            return biweekly.get();
        }
        final Optional<ParsedPeriod> weekly = tryWeekly(code, capabilities);
        if (weekly.isPresent()) {
            return weekly.get();
        }
        final Optional<ParsedPeriod> bimonthly = tryBimonthly(code, capabilities);
        if (bimonthly.isPresent()) {
            return bimonthly.get();
        }
        final Optional<ParsedPeriod> daily = tryDaily(code, capabilities);
        if (daily.isPresent()) {
            return daily.get();
        }
        final Optional<ParsedPeriod> monthly = tryMonthly(code, capabilities);
        if (monthly.isPresent()) {
            return monthly.get();
        }
        throw new PeriodParseException("period '" + code + "' is not a recognised DHIS2 period code");
    }

    private static Optional<ParsedPeriod> tryYearly(final String code, final CapabilityFlags caps) {
        final Matcher m = YEARLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.YEARLY);
        final int year = Integer.parseInt(m.group(1));
        return Optional.of(new ParsedPeriod(code, PeriodType.YEARLY,
                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)));
    }

    private static Optional<ParsedPeriod> tryQuarterly(final String code, final CapabilityFlags caps) {
        final Matcher m = QUARTERLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.QUARTERLY);
        final int year = Integer.parseInt(m.group(1));
        final int q = Integer.parseInt(m.group(2));
        final int startMonth = (q - 1) * 3 + 1;
        final LocalDate start = LocalDate.of(year, startMonth, 1);
        final LocalDate end = start.plusMonths(3).minusDays(1);
        return Optional.of(new ParsedPeriod(code, PeriodType.QUARTERLY, start, end));
    }

    private static Optional<ParsedPeriod> trySixMonthly(final String code, final CapabilityFlags caps) {
        final Matcher m = SIXMONTHLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.SIXMONTHLY);
        final int year = Integer.parseInt(m.group(1));
        final int half = Integer.parseInt(m.group(2));
        final int startMonth = half == 1 ? 1 : 7;
        final LocalDate start = LocalDate.of(year, startMonth, 1);
        final LocalDate end = start.plusMonths(6).minusDays(1);
        return Optional.of(new ParsedPeriod(code, PeriodType.SIXMONTHLY, start, end));
    }

    private static Optional<ParsedPeriod> trySixMonthlyApril(final String code,
                                                              final CapabilityFlags caps) {
        final Matcher m = SIXMONTHLY_APRIL.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.SIXMONTHLYAPRIL);
        final int year = Integer.parseInt(m.group(1));
        final int half = Integer.parseInt(m.group(2));
        final LocalDate start = LocalDate.of(year, half == 1 ? 4 : 10, 1);
        final LocalDate end = start.plusMonths(6).minusDays(1);
        return Optional.of(new ParsedPeriod(code, PeriodType.SIXMONTHLYAPRIL, start, end));
    }

    private static Optional<ParsedPeriod> tryFinancial(final String code, final CapabilityFlags caps,
                                                       final Pattern pattern, final PeriodType pt,
                                                       final Month startMonth) {
        final Matcher m = pattern.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, pt);
        final int year = Integer.parseInt(m.group(1));
        final LocalDate start = LocalDate.of(year, startMonth, 1);
        final LocalDate end = start.plusYears(1).minusDays(1);
        return Optional.of(new ParsedPeriod(code, pt, start, end));
    }

    private static Optional<ParsedPeriod> tryWeekly(final String code, final CapabilityFlags caps) {
        final Matcher m = WEEKLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.WEEKLY);
        final int year = Integer.parseInt(m.group(1));
        final int week = Integer.parseInt(m.group(2));
        if (week < 1 || week > 53) {
            throw new PeriodParseException("week " + week + " out of range in '" + code + "'");
        }
        final LocalDate start;
        try {
            start = LocalDate.now().with(IsoFields.WEEK_BASED_YEAR, year)
                    .with(IsoFields.WEEK_OF_WEEK_BASED_YEAR, week)
                    .with(WeekFields.ISO.dayOfWeek(), 1);
        } catch (RuntimeException ex) {
            throw new PeriodParseException("cannot resolve ISO week '" + code + "': " + ex.getMessage());
        }
        return Optional.of(new ParsedPeriod(code, PeriodType.WEEKLY, start, start.plusDays(6)));
    }

    private static Optional<ParsedPeriod> tryBiweekly(final String code, final CapabilityFlags caps) {
        final Matcher m = BIWEEKLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.BIWEEKLY);
        final int year = Integer.parseInt(m.group(1));
        final int biweek = Integer.parseInt(m.group(2));
        if (biweek < 1 || biweek > 27) {
            throw new PeriodParseException("biweek " + biweek + " out of range in '" + code + "'");
        }
        final int firstWeek = (biweek - 1) * 2 + 1;
        final LocalDate start = LocalDate.now().with(IsoFields.WEEK_BASED_YEAR, year)
                .with(IsoFields.WEEK_OF_WEEK_BASED_YEAR, firstWeek)
                .with(WeekFields.ISO.dayOfWeek(), 1);
        return Optional.of(new ParsedPeriod(code, PeriodType.BIWEEKLY, start, start.plusDays(13)));
    }

    private static Optional<ParsedPeriod> tryMonthly(final String code, final CapabilityFlags caps) {
        final Matcher m = MONTHLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.MONTHLY);
        final int year = Integer.parseInt(m.group(1));
        final int month = Integer.parseInt(m.group(2));
        if (month < 1 || month > 12) {
            throw new PeriodParseException("month " + month + " out of range in '" + code + "'");
        }
        final LocalDate start = LocalDate.of(year, month, 1);
        return Optional.of(new ParsedPeriod(code, PeriodType.MONTHLY,
                start, start.plusMonths(1).minusDays(1)));
    }

    private static Optional<ParsedPeriod> tryBimonthly(final String code, final CapabilityFlags caps) {
        final Matcher m = BIMONTHLY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.BIMONTHLY);
        final int year = Integer.parseInt(m.group(1));
        final int startMonth = Integer.parseInt(m.group(2));
        if (startMonth < 1 || startMonth > 12 || startMonth % 2 == 0) {
            throw new PeriodParseException("bi-month '" + code + "' must start on an odd month 1,3,5,7,9,11");
        }
        final LocalDate start = LocalDate.of(year, startMonth, 1);
        return Optional.of(new ParsedPeriod(code, PeriodType.BIMONTHLY,
                start, start.plusMonths(2).minusDays(1)));
    }

    private static Optional<ParsedPeriod> tryDaily(final String code, final CapabilityFlags caps) {
        final Matcher m = DAILY.matcher(code);
        if (!m.matches()) {
            return Optional.empty();
        }
        requireSupported(code, caps, PeriodType.DAILY);
        try {
            final LocalDate day = LocalDate.parse(code, DateTimeFormatter.ofPattern("uuuuMMdd",
                    Locale.ROOT).withResolverStyle(ResolverStyle.STRICT));
            return Optional.of(new ParsedPeriod(code, PeriodType.DAILY, day, day));
        } catch (DateTimeParseException ex) {
            throw new PeriodParseException("daily period '" + code + "' is not a valid date");
        }
    }

    private static void requireSupported(final String code, final CapabilityFlags caps,
                                          final PeriodType type) {
        if (!caps.supportedPeriodTypes().contains(type)) {
            throw new PeriodParseException("period type " + type + " not supported by the active "
                    + "DHIS2 profile for code '" + code + "'");
        }
    }
}
