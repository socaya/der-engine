package ug.ac.mak.der.dhis2emulator;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/periods} + {@code /api/periods/{iso}} — the
 * generated-period catalogue DHIS2 Data Entry, Event Reports, Data
 * Visualizer and Maps all consume to resolve a period type +
 * date range into the concrete list of ISO period instances.
 *
 * <p>Periods are <em>deterministic</em> — they can be computed on
 * demand from (periodType, startDate, endDate) without a backing
 * table. Each period carries the DHIS2-standard fields:
 * {@code id}, {@code name}, {@code iso}, {@code startDate},
 * {@code endDate}, {@code periodType}. Shape matches central exactly
 * so {@code @dhis2/analytics}'s period lib round-trips cleanly.</p>
 *
 * <p>Supported period types covered on-edge (the 19 DHIS2 built-ins):
 * Daily, Weekly (+ WeeklyWednesday/Thursday/Saturday/Sunday),
 * BiWeekly, Monthly, BiMonthly, Quarterly (+ QuarterlyNov),
 * SixMonthly (+ SixMonthlyApril/Nov), Yearly, FinancialApril/July/
 * Oct/Nov. Each enumerates the correct period instances between
 * the requested start + end dates.</p>
 */
@RestController
@RequestMapping(path = "/api/periods", produces = MediaType.APPLICATION_JSON_VALUE)
public class PeriodsController {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter YM  = DateTimeFormatter.ofPattern("yyyyMM");

    /**
     * {@code GET /api/periods?periodType=Monthly&startDate=2025-01-01&endDate=2025-12-31}
     * — enumerate every period of {@code periodType} whose start date
     * falls within [startDate, endDate]. Default range when callers
     * don't specify: last 12 months, matching central's behaviour for
     * a bare query.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication auth,
            @RequestParam(name = "periodType", defaultValue = "Monthly") final String periodType,
            @RequestParam(name = "startDate", required = false) final String startDate,
            @RequestParam(name = "endDate", required = false) final String endDate) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final LocalDate today = LocalDate.now();
        final LocalDate start = startDate != null && !startDate.isBlank()
                ? LocalDate.parse(startDate, ISO) : today.minusMonths(12);
        final LocalDate end = endDate != null && !endDate.isBlank()
                ? LocalDate.parse(endDate, ISO) : today;
        final List<Map<String, Object>> periods = enumerate(periodType, start, end);
        return ResponseEntity.ok(Map.of(
                "pager", Map.of("page", 1, "pageSize", periods.size(),
                        "total", periods.size(),
                        "pageCount", periods.isEmpty() ? 0 : 1),
                "periods", periods));
    }

    /**
     * {@code GET /api/periods/{iso}} — resolve one period by its ISO
     * code. Returns the same object shape as the list endpoint. Used
     * by Data Entry when the operator pastes a period code into the
     * URL and expects the app to jump to that period.
     */
    @GetMapping("/{iso}")
    public ResponseEntity<Map<String, Object>> byIso(
            final Authentication auth,
            @PathVariable("iso") final String iso) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> p = parseOne(iso);
        if (p == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "httpStatus", "NotFound",
                    "message", "Period " + iso + " could not be parsed"));
        }
        return ResponseEntity.ok(p);
    }

    // ---- enumeration ----

    private static List<Map<String, Object>> enumerate(final String periodType,
                                                         final LocalDate start,
                                                         final LocalDate end) {
        final List<Map<String, Object>> out = new ArrayList<>();
        switch (periodType) {
            case "Daily" -> {
                for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                    out.add(period(d.format(YMD), "Daily",
                            fmtDailyName(d), d, d));
                }
            }
            case "Weekly" -> enumerateWeeks(out, start, end, DayOfWeek.MONDAY, "Weekly", "W");
            case "WeeklyWednesday" -> enumerateWeeks(out, start, end,
                    DayOfWeek.WEDNESDAY, "WeeklyWednesday", "WedW");
            case "WeeklyThursday" -> enumerateWeeks(out, start, end,
                    DayOfWeek.THURSDAY, "WeeklyThursday", "ThuW");
            case "WeeklySaturday" -> enumerateWeeks(out, start, end,
                    DayOfWeek.SATURDAY, "WeeklySaturday", "SatW");
            case "WeeklySunday" -> enumerateWeeks(out, start, end,
                    DayOfWeek.SUNDAY, "WeeklySunday", "SunW");
            case "BiWeekly" -> {
                LocalDate cursor = start.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                int biweek = ((cursor.getDayOfYear() - 1) / 14) + 1;
                while (!cursor.isAfter(end)) {
                    final LocalDate periodEnd = cursor.plusDays(13);
                    final int year = cursor.getYear();
                    out.add(period(year + "BiW" + biweek, "BiWeekly",
                            year + " Bi-Week " + biweek, cursor, periodEnd));
                    cursor = cursor.plusDays(14);
                    biweek++;
                }
            }
            case "Monthly" -> enumerateMonths(out, start, end);
            case "BiMonthly" -> {
                LocalDate cursor = start.withDayOfMonth(1);
                // snap to nearest bi-month start (Jan/Mar/May/Jul/Sep/Nov)
                while ((cursor.getMonthValue() - 1) % 2 != 0) {
                    cursor = cursor.minusMonths(1);
                }
                while (!cursor.isAfter(end)) {
                    final int bimonth = ((cursor.getMonthValue() - 1) / 2) + 1;
                    final LocalDate periodEnd = cursor.plusMonths(2).minusDays(1);
                    out.add(period(cursor.getYear() + "0" + bimonth + "B",
                            "BiMonthly", cursor.getYear() + " Bi-Month " + bimonth,
                            cursor, periodEnd));
                    cursor = cursor.plusMonths(2);
                }
            }
            case "Quarterly" -> enumerateQuarters(out, start, end, 1, "Quarterly", "Q");
            case "QuarterlyNov" -> enumerateQuarters(out, start, end, 11, "QuarterlyNov", "NovQ");
            case "SixMonthly" -> enumerateSixMonths(out, start, end, 1, "SixMonthly", "S");
            case "SixMonthlyApril" -> enumerateSixMonths(out, start, end, 4, "SixMonthlyApril", "AprilS");
            case "SixMonthlyNov" -> enumerateSixMonths(out, start, end, 11, "SixMonthlyNov", "NovS");
            case "Yearly" -> enumerateYears(out, start, end, 1, "Yearly", "");
            case "FinancialApril" -> enumerateYears(out, start, end, 4, "FinancialApril", "April");
            case "FinancialJuly" -> enumerateYears(out, start, end, 7, "FinancialJuly", "July");
            case "FinancialOct" -> enumerateYears(out, start, end, 10, "FinancialOct", "Oct");
            case "FinancialNov" -> enumerateYears(out, start, end, 11, "FinancialNov", "Nov");
            default -> { /* Unknown period type — return empty list. */ }
        }
        return out;
    }

    private static void enumerateWeeks(final List<Map<String, Object>> out,
                                         final LocalDate start, final LocalDate end,
                                         final DayOfWeek first, final String typeName,
                                         final String suffix) {
        LocalDate cursor = start.with(TemporalAdjusters.previousOrSame(first));
        while (!cursor.isAfter(end)) {
            final LocalDate periodEnd = cursor.plusDays(6);
            final int week = cursor.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            final int year = cursor.get(IsoFields.WEEK_BASED_YEAR);
            final String id = "Weekly".equals(typeName)
                    ? year + "W" + week
                    : year + suffix + week;
            out.add(period(id, typeName,
                    year + " " + id.substring(4), cursor, periodEnd));
            cursor = cursor.plusWeeks(1);
        }
    }

    private static void enumerateMonths(final List<Map<String, Object>> out,
                                          final LocalDate start, final LocalDate end) {
        LocalDate cursor = start.withDayOfMonth(1);
        while (!cursor.isAfter(end)) {
            final LocalDate periodEnd = cursor.plusMonths(1).minusDays(1);
            out.add(period(cursor.format(YM), "Monthly",
                    fmtMonthName(cursor), cursor, periodEnd));
            cursor = cursor.plusMonths(1);
        }
    }

    private static void enumerateQuarters(final List<Map<String, Object>> out,
                                            final LocalDate start, final LocalDate end,
                                            final int anchorMonth, final String typeName,
                                            final String suffix) {
        LocalDate cursor = start.withDayOfMonth(1);
        while ((cursor.getMonthValue() - anchorMonth) % 3 != 0) {
            cursor = cursor.minusMonths(1);
        }
        while (!cursor.isAfter(end)) {
            final int quarter = ((cursor.getMonthValue() - anchorMonth + 12) % 12) / 3 + 1;
            final LocalDate periodEnd = cursor.plusMonths(3).minusDays(1);
            final int year = cursor.getYear();
            out.add(period(year + suffix + quarter, typeName,
                    year + " Q" + quarter, cursor, periodEnd));
            cursor = cursor.plusMonths(3);
        }
    }

    private static void enumerateSixMonths(final List<Map<String, Object>> out,
                                             final LocalDate start, final LocalDate end,
                                             final int anchorMonth, final String typeName,
                                             final String suffix) {
        LocalDate cursor = start.withDayOfMonth(1);
        while ((cursor.getMonthValue() - anchorMonth) % 6 != 0) {
            cursor = cursor.minusMonths(1);
        }
        while (!cursor.isAfter(end)) {
            final int half = ((cursor.getMonthValue() - anchorMonth + 12) % 12) / 6 + 1;
            final LocalDate periodEnd = cursor.plusMonths(6).minusDays(1);
            final int year = cursor.getYear();
            out.add(period(year + suffix + half, typeName,
                    year + " S" + half, cursor, periodEnd));
            cursor = cursor.plusMonths(6);
        }
    }

    private static void enumerateYears(final List<Map<String, Object>> out,
                                         final LocalDate start, final LocalDate end,
                                         final int anchorMonth, final String typeName,
                                         final String suffix) {
        int fyStart = start.getYear();
        if (anchorMonth != 1 && start.getMonthValue() < anchorMonth) {
            fyStart--;
        }
        while (true) {
            final LocalDate periodStart = LocalDate.of(fyStart, anchorMonth, 1);
            if (periodStart.isAfter(end)) {
                break;
            }
            final LocalDate periodEnd = periodStart.plusYears(1).minusDays(1);
            out.add(period(fyStart + suffix, typeName,
                    "Yearly".equals(typeName) ? Integer.toString(fyStart)
                            : fyStart + " " + suffix,
                    periodStart, periodEnd));
            fyStart++;
        }
    }

    private static Map<String, Object> period(final String id, final String type,
                                                final String name,
                                                final LocalDate startDate,
                                                final LocalDate endDate) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("iso", id);
        m.put("name", name);
        m.put("displayName", name);
        m.put("startDate", startDate.toString());
        m.put("endDate", endDate.toString());
        m.put("periodType", type);
        return m;
    }

    private static String fmtMonthName(final LocalDate d) {
        return d.getMonth().getDisplayName(
                java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH)
                + " " + d.getYear();
    }

    private static String fmtDailyName(final LocalDate d) {
        return d.getDayOfMonth() + " "
                + d.getMonth().getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)
                + " " + d.getYear();
    }

    /** Best-effort parse of a single ISO period code. Delegates to the
     *  same enumeration machinery with a one-day range so the shape
     *  stays identical to the list endpoint's entries. */
    private static Map<String, Object> parseOne(final String iso) {
        if (iso == null || iso.length() < 4) {
            return null;
        }
        final String type = guessType(iso);
        if (type == null) {
            return null;
        }
        // Heuristic: parse the starting date from the ISO code then
        // enumerate one period of this type starting there.
        try {
            final LocalDate anchor = parseAnchor(iso, type);
            if (anchor == null) {
                return null;
            }
            final List<Map<String, Object>> list = enumerate(type, anchor, anchor);
            for (final Map<String, Object> p : list) {
                if (iso.equals(p.get("id"))) {
                    return p;
                }
            }
            if (!list.isEmpty()) {
                return list.get(0);
            }
            return null;
        } catch (final Exception ex) {
            return null;
        }
    }

    private static String guessType(final String iso) {
        if (iso.length() == 8 && iso.chars().allMatch(Character::isDigit)) {
            return "Daily";
        }
        if (iso.length() == 6 && iso.chars().allMatch(Character::isDigit)) {
            return "Monthly";
        }
        if (iso.length() == 4 && iso.chars().allMatch(Character::isDigit)) {
            return "Yearly";
        }
        if (iso.matches("\\d{4}Q[1-4]")) {
            return "Quarterly";
        }
        if (iso.matches("\\d{4}S[12]")) {
            return "SixMonthly";
        }
        if (iso.matches("\\d{4}W\\d{1,2}")) {
            return "Weekly";
        }
        if (iso.matches("\\d{4}0[1-6]B")) {
            return "BiMonthly";
        }
        if (iso.matches("\\d{4}(April|July|Oct|Nov)")) {
            if (iso.endsWith("April")) {
                return "FinancialApril";
            }
            if (iso.endsWith("July")) {
                return "FinancialJuly";
            }
            if (iso.endsWith("Oct")) {
                return "FinancialOct";
            }
            if (iso.endsWith("Nov")) {
                return "FinancialNov";
            }
        }
        return null;
    }

    private static LocalDate parseAnchor(final String iso, final String type) {
        return switch (type) {
            case "Daily" -> LocalDate.parse(iso, YMD);
            case "Monthly" -> LocalDate.of(
                    Integer.parseInt(iso.substring(0, 4)),
                    Integer.parseInt(iso.substring(4, 6)), 1);
            case "Yearly" -> LocalDate.of(Integer.parseInt(iso), 1, 1);
            case "Quarterly" -> {
                final int q = Integer.parseInt(iso.substring(5));
                yield LocalDate.of(Integer.parseInt(iso.substring(0, 4)),
                        (q - 1) * 3 + 1, 1);
            }
            case "SixMonthly" -> {
                final int s = Integer.parseInt(iso.substring(5));
                yield LocalDate.of(Integer.parseInt(iso.substring(0, 4)),
                        s == 1 ? 1 : 7, 1);
            }
            case "Weekly" -> LocalDate.of(Integer.parseInt(iso.substring(0, 4)), 1, 1)
                    .plusWeeks(Integer.parseInt(iso.substring(5)) - 1L)
                    .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case "BiMonthly" -> {
                final int b = Integer.parseInt(iso.substring(4, 6));
                yield LocalDate.of(Integer.parseInt(iso.substring(0, 4)),
                        (b - 1) * 2 + 1, 1);
            }
            case "FinancialApril" -> LocalDate.of(Integer.parseInt(iso.substring(0, 4)), 4, 1);
            case "FinancialJuly" -> LocalDate.of(Integer.parseInt(iso.substring(0, 4)), 7, 1);
            case "FinancialOct" -> LocalDate.of(Integer.parseInt(iso.substring(0, 4)), 10, 1);
            case "FinancialNov" -> LocalDate.of(Integer.parseInt(iso.substring(0, 4)), 11, 1);
            default -> null;
        };
    }
}
