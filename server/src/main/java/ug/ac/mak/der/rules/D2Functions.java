package ug.ac.mak.der.rules;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.regex.Pattern;

/**
 * The server-impacting subset of DHIS2's {@code d2:} program-rule functions.
 *
 * <p>Each function receives the live {@link RuleContext} and a list of
 * already-evaluated argument values; functions may return primitive numbers,
 * booleans, strings, nulls, or {@link LocalDate}.</p>
 *
 * <p>Coverage register:
 * {@code docs/verification/rules/d2-function-coverage.csv}.</p>
 */
public final class D2Functions {

    private D2Functions() { }

    public static Object call(final String name, final List<Object> args, final RuleContext ctx) {
        return switch (name) {
            case "hasValue" -> hasValue(args);
            case "zing" -> zing(args);
            case "oizp" -> oizp(args);
            case "zpvc" -> zpvc(args);
            case "ceil" -> Math.ceil(num(args, 0));
            case "floor" -> Math.floor(num(args, 0));
            case "round" -> (double) Math.round(num(args, 0));
            case "modulus" -> num(args, 0) % num(args, 1);
            case "count" -> count(args, ctx, "count");
            case "countIfValue" -> count(args, ctx, "countIfValue");
            case "countIfZeroPos" -> count(args, ctx, "countIfZeroPos");
            case "daysBetween" -> dateDiff(args, ChronoUnit.DAYS);
            case "weeksBetween" -> dateDiff(args, ChronoUnit.WEEKS);
            case "monthsBetween" -> dateDiff(args, ChronoUnit.MONTHS);
            case "yearsBetween" -> dateDiff(args, ChronoUnit.YEARS);
            case "minutesBetween" -> dateTimeDiff(args, ChronoUnit.MINUTES);
            case "addDays" -> addDays(args);
            case "concatenate" -> concatenate(args);
            case "left" -> left(args);
            case "right" -> right(args);
            case "substring" -> substring(args);
            case "length" -> (double) str(args, 0).length();
            case "split" -> split(args);
            case "validatePattern" -> validatePattern(args);
            case "lastEventDate" -> lastEventDate(args, ctx);
            case "inOrgUnitGroup" -> inOrgUnitGroup(args, ctx);
            case "extractDataMatrixValue" -> extractDataMatrixValue(args);
            default -> throw new RuleParseException("unsupported d2 function 'd2:" + name + "'");
        };
    }

    // Existence / null handling ------------------------------------------

    private static Boolean hasValue(final List<Object> args) {
        requireArity("hasValue", args, 1);
        final Object v = args.get(0);
        if (v == null) {
            return false;
        }
        if (v instanceof String s) {
            return !s.isEmpty();
        }
        return true;
    }

    private static Double zing(final List<Object> args) {
        final double v = num(args, 0);
        return v < 0 ? 0d : v;
    }

    private static Double oizp(final List<Object> args) {
        final double v = num(args, 0);
        return v >= 0 ? 1d : 0d;
    }

    private static Double zpvc(final List<Object> args) {
        double sum = 0;
        for (final Object a : args) {
            if (a instanceof Number n && n.doubleValue() >= 0) {
                sum++;
            }
        }
        return sum;
    }

    // Counting -----------------------------------------------------------

    private static Double count(final List<Object> args, final RuleContext ctx, final String which) {
        requireArity(which, args, 1);
        if (!(args.get(0) instanceof CountKey key)) {
            throw new RuleParseException("d2:" + which
                    + " expects a '#{psUid.deUid}' reference argument");
        }
        double total = 0;
        for (final var evt : ctx.previousEvents()) {
            final Object v = evt.get(key.compound());
            if (v == null) {
                continue;
            }
            switch (which) {
                case "count":
                    total++;
                    break;
                case "countIfValue":
                    if (args.size() >= 2 && objectsEqual(v, args.get(1))) {
                        total++;
                    }
                    break;
                case "countIfZeroPos":
                    if (v instanceof Number n && n.doubleValue() >= 0) {
                        total++;
                    }
                    break;
                default:
                    throw new IllegalStateException("unreachable branch '" + which + "'");
            }
        }
        return total;
    }

    // Dates --------------------------------------------------------------

    private static Double dateDiff(final List<Object> args, final ChronoUnit unit) {
        requireArity("date-diff", args, 2);
        final LocalDate a = toDate(args.get(0));
        final LocalDate b = toDate(args.get(1));
        return (double) unit.between(a, b);
    }

    private static Double dateTimeDiff(final List<Object> args, final ChronoUnit unit) {
        requireArity("date-time-diff", args, 2);
        final LocalDateTime a = toDateTime(args.get(0));
        final LocalDateTime b = toDateTime(args.get(1));
        return (double) unit.between(a, b);
    }

    private static LocalDate addDays(final List<Object> args) {
        requireArity("addDays", args, 2);
        return toDate(args.get(0)).plusDays((long) num(args, 1));
    }

    // Strings ------------------------------------------------------------

    private static String concatenate(final List<Object> args) {
        final StringBuilder sb = new StringBuilder();
        for (final Object a : args) {
            if (a != null) {
                sb.append(a);
            }
        }
        return sb.toString();
    }

    private static String left(final List<Object> args) {
        requireArity("left", args, 2);
        final String s = str(args, 0);
        final int n = Math.min((int) num(args, 1), s.length());
        return n <= 0 ? "" : s.substring(0, n);
    }

    private static String right(final List<Object> args) {
        requireArity("right", args, 2);
        final String s = str(args, 0);
        final int n = Math.min((int) num(args, 1), s.length());
        return n <= 0 ? "" : s.substring(s.length() - n);
    }

    private static String substring(final List<Object> args) {
        final String s = str(args, 0);
        final int start = Math.max(0, (int) num(args, 1));
        final int end = args.size() >= 3 ? Math.min(s.length(), (int) num(args, 2)) : s.length();
        if (end <= start) {
            return "";
        }
        return s.substring(start, end);
    }

    private static List<String> split(final List<Object> args) {
        requireArity("split", args, 3);
        final String s = str(args, 0);
        final String delim = Pattern.quote(str(args, 1));
        final int index = (int) num(args, 2);
        final String[] parts = s.split(delim, -1);
        if (index < 0 || index >= parts.length) {
            return List.of();
        }
        return List.of(parts[index]);
    }

    private static Boolean validatePattern(final List<Object> args) {
        requireArity("validatePattern", args, 2);
        return str(args, 0).matches(str(args, 1));
    }

    // Program-context ---------------------------------------------------

    private static LocalDate lastEventDate(final List<Object> args, final RuleContext ctx) {
        requireArity("lastEventDate", args, 1);
        LocalDate last = null;
        final String compound = args.get(0) instanceof CountKey k ? k.compound() : null;
        for (final var evt : ctx.previousEvents()) {
            if (compound != null && !evt.containsKey(compound)) {
                continue;
            }
            final Object d = evt.get("event_date");
            if (d != null) {
                final LocalDate ld = toDate(d);
                if (last == null || ld.isAfter(last)) {
                    last = ld;
                }
            }
        }
        return last;
    }

    private static Boolean inOrgUnitGroup(final List<Object> args, final RuleContext ctx) {
        requireArity("inOrgUnitGroup", args, 1);
        final Object groups = ctx.environment().get("org_unit_groups");
        if (groups instanceof List<?> list) {
            return list.contains(str(args, 0));
        }
        return false;
    }

    private static String extractDataMatrixValue(final List<Object> args) {
        requireArity("extractDataMatrixValue", args, 2);
        final String key = str(args, 0);
        final String payload = str(args, 1);
        final int idx = payload.indexOf(key);
        if (idx < 0) {
            return "";
        }
        final int start = idx + key.length();
        final int end = payload.indexOf(";", start);
        return end < 0 ? payload.substring(start) : payload.substring(start, end);
    }

    // Helpers ------------------------------------------------------------

    static void requireArity(final String name, final List<Object> args, final int min) {
        if (args.size() < min) {
            throw new RuleParseException("d2:" + name + " expects at least " + min
                    + " arg(s), got " + args.size());
        }
    }

    static double num(final List<Object> args, final int i) {
        final Object v = args.get(i);
        if (v == null) {
            return 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (NumberFormatException ex) {
            throw new RuleParseException("expected a number at arg " + i + " got '" + v + "'");
        }
    }

    static String str(final List<Object> args, final int i) {
        final Object v = args.get(i);
        return v == null ? "" : v.toString();
    }

    static LocalDate toDate(final Object v) {
        if (v instanceof LocalDate d) {
            return d;
        }
        if (v instanceof LocalDateTime dt) {
            return dt.toLocalDate();
        }
        if (v == null) {
            throw new RuleParseException("expected a date, got null");
        }
        try {
            return LocalDate.parse(v.toString());
        } catch (DateTimeParseException ex) {
            throw new RuleParseException("expected an ISO date, got '" + v + "'");
        }
    }

    static LocalDateTime toDateTime(final Object v) {
        if (v instanceof LocalDateTime dt) {
            return dt;
        }
        if (v instanceof LocalDate d) {
            return d.atStartOfDay();
        }
        if (v == null) {
            throw new RuleParseException("expected a datetime, got null");
        }
        final String s = v.toString();
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException ex) {
            try {
                return LocalDate.parse(s, DateTimeFormatter.ISO_DATE).atStartOfDay();
            } catch (DateTimeParseException ex2) {
                throw new RuleParseException("expected an ISO datetime, got '" + s + "'");
            }
        }
    }

    static boolean objectsEqual(final Object a, final Object b) {
        if (a == null || b == null) {
            return a == b;
        }
        if (a instanceof Number && b instanceof Number) {
            return ((Number) a).doubleValue() == ((Number) b).doubleValue();
        }
        return a.toString().equals(b.toString());
    }

    /** Opaque reference key used by {@code d2:count*} functions. */
    public record CountKey(String compound) {

        public static CountKey of(final String programStageUid, final String dataElementUid) {
            return new CountKey(programStageUid + "." + dataElementUid);
        }
    }
}
