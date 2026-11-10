package ug.ac.mak.der.analytics.engine;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.stereotype.Service;

/**
 * Canonical period enumeration for DER Analytics (Phase 1 of the
 * engine spec, §5 "period type catalogue").
 *
 * <p>Enumerates the half-open local-time windows that the analytics
 * query layer uses when projecting event dates into DHIS2 period codes.
 * Lives separately from the pre-existing {@link
 * ug.ac.mak.der.workflows.periods.PeriodParser} because that class
 * parses a single operator-supplied code; this service produces the
 * ordered list of every period in a year for a given type, which the
 * `/edge-api/v1/analytics/v1/periods` endpoint and the materializer
 * both need.</p>
 *
 * <p>Boundaries: inclusive {@code startDate}, inclusive {@code endDate}
 * (callers that need a half-open instant window add one day to
 * {@code endDate}). Weeks follow ISO 8601 (Monday start); monthly /
 * quarterly / yearly follow the Gregorian calendar. Fiscal-year
 * variants are deliberately NOT enumerated here — AN-FR-027 requires
 * explicit per-target DHIS2 verification before enabling them.</p>
 */
@Service
public class AnalyticsPeriodEnumerator {

    /** One concrete period window. */
    public record Window(String id, LocalDate startDate, LocalDate endDate) {
        public Window {
            Objects.requireNonNull(id, "id");
            Objects.requireNonNull(startDate, "startDate");
            Objects.requireNonNull(endDate, "endDate");
            if (endDate.isBefore(startDate)) {
                throw new IllegalArgumentException(
                        "endDate must not precede startDate");
            }
        }
    }

    /** Period types enumerable without per-target DHIS2 verification. */
    public enum Type {
        DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
    }

    /** Resolve a type string against the canonical enum, accepting the
     *  DHIS2 PeriodType spelling (Daily / Weekly / Monthly / …) and the
     *  all-caps variant. Returns null for unknown types — callers must
     *  translate that to an HTTP 400 so unsupported period types can't
     *  silently become empty results. */
    public static Type resolve(final String raw) {
        if (raw == null) {
            return null;
        }
        try {
            return Type.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    public List<Window> enumerate(final Type type, final int year) {
        Objects.requireNonNull(type, "type");
        if (year < 1900 || year > 2200) {
            throw new IllegalArgumentException(
                    "year out of range: " + year);
        }
        return switch (type) {
            case DAILY     -> daily(year);
            case WEEKLY    -> weekly(year);
            case MONTHLY   -> monthly(year);
            case QUARTERLY -> quarterly(year);
            case YEARLY    -> yearly(year);
        };
    }

    private static List<Window> daily(final int year) {
        final LocalDate first = LocalDate.of(year, 1, 1);
        final LocalDate last = LocalDate.of(year, 12, 31);
        final List<Window> out = new ArrayList<>(366);
        final DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyyMMdd");
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            out.add(new Window(d.format(fmt), d, d));
        }
        return out;
    }

    private static List<Window> weekly(final int year) {
        // ISO 8601 week-of-week-based-year — the week that contains
        // this year's first Thursday is week 1.
        final WeekFields iso = WeekFields.ISO;
        final List<Window> out = new ArrayList<>(53);
        // Find the first Monday of ISO week 1 of `year`.
        final LocalDate jan4 = LocalDate.of(year, 1, 4);
        final LocalDate firstMonday = jan4.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate mon = firstMonday;
        int week = 1;
        while (true) {
            final LocalDate sun = mon.plusDays(6);
            // Stop when the Monday's ISO-week-based year moves past the
            // requested year (handles weeks 52/53 correctly).
            final int yearOfMonday = mon.get(iso.weekBasedYear());
            if (yearOfMonday != year) {
                break;
            }
            final int wk = mon.get(iso.weekOfWeekBasedYear());
            out.add(new Window(
                    String.format(Locale.ROOT, "%dW%d", year, wk),
                    mon, sun));
            mon = mon.plusWeeks(1);
            week++;
            if (week > 54) {
                break; // safety
            }
        }
        return out;
    }

    private static List<Window> monthly(final int year) {
        final List<Window> out = new ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            final LocalDate start = LocalDate.of(year, m, 1);
            final LocalDate end = start.with(TemporalAdjusters.lastDayOfMonth());
            out.add(new Window(
                    String.format(Locale.ROOT, "%d%02d", year, m),
                    start, end));
        }
        return out;
    }

    private static List<Window> quarterly(final int year) {
        final List<Window> out = new ArrayList<>(4);
        for (int q = 1; q <= 4; q++) {
            final int startMonth = (q - 1) * 3 + 1;
            final LocalDate start = LocalDate.of(year, startMonth, 1);
            final LocalDate end = LocalDate.of(year, startMonth + 2, 1)
                    .with(TemporalAdjusters.lastDayOfMonth());
            out.add(new Window(
                    String.format(Locale.ROOT, "%dQ%d", year, q),
                    start, end));
        }
        return out;
    }

    private static List<Window> yearly(final int year) {
        return List.of(new Window(
                String.valueOf(year),
                LocalDate.of(year, 1, 1),
                LocalDate.of(year, 12, 31)));
    }

    /** Returns the ISO quarter id for a date — convenience for the
     *  ingestion path that maps an event date to its canonical period.
     *  Equivalent conceptual helpers for weekly / monthly / yearly exist
     *  in {@link #windowContaining(Type, LocalDate)}. */
    public static String quarterIdFor(final LocalDate d) {
        return String.format(Locale.ROOT, "%dQ%d",
                d.getYear(), d.get(IsoFields.QUARTER_OF_YEAR));
    }

    public Window windowContaining(final Type type, final LocalDate d) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(d, "date");
        return switch (type) {
            case DAILY -> new Window(d.format(DateTimeFormatter.ofPattern("yyyyMMdd")), d, d);
            case WEEKLY -> {
                final WeekFields iso = WeekFields.ISO;
                final LocalDate mon = d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                final LocalDate sun = mon.plusDays(6);
                final int weekYear = mon.get(iso.weekBasedYear());
                final int wk = mon.get(iso.weekOfWeekBasedYear());
                yield new Window(String.format(Locale.ROOT, "%dW%d", weekYear, wk), mon, sun);
            }
            case MONTHLY -> {
                final LocalDate start = d.withDayOfMonth(1);
                final LocalDate end = start.with(TemporalAdjusters.lastDayOfMonth());
                yield new Window(
                        String.format(Locale.ROOT, "%d%02d", d.getYear(), d.getMonthValue()),
                        start, end);
            }
            case QUARTERLY -> {
                final int q = d.get(IsoFields.QUARTER_OF_YEAR);
                final int startMonth = (q - 1) * 3 + 1;
                final LocalDate start = LocalDate.of(d.getYear(), startMonth, 1);
                final LocalDate end = LocalDate.of(d.getYear(), startMonth + 2, 1)
                        .with(TemporalAdjusters.lastDayOfMonth());
                yield new Window(
                        String.format(Locale.ROOT, "%dQ%d", d.getYear(), q),
                        start, end);
            }
            case YEARLY -> new Window(
                    String.valueOf(d.getYear()),
                    LocalDate.of(d.getYear(), 1, 1),
                    LocalDate.of(d.getYear(), 12, 31));
        };
    }
}
