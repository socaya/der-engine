package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/analytics/events/**} + {@code /api/analytics/
 * enrollments/**} — event and enrollment analytics used by Event
 * Reports, Event Visualizer, Line List, and the Event Report widget
 * in Dashboard. Backed by {@code der.event}, {@code der.event_data_value},
 * {@code der.enrollment} with per-period aggregation that mirrors the
 * aggregate pivot engine ({@link AnalyticsQueryController}).
 *
 * <p>Two shapes per entity:
 * <ul>
 *   <li>{@code /aggregate/{program}} — COUNT (default) of events /
 *       enrollments grouped by {@code pe} + {@code ou} dimensions,
 *       with relative-period resolution via
 *       {@link RelativePeriodResolver}. Response matches the aggregate
 *       {@link AnalyticsQueryController} shape so DV / Dashboard chart
 *       items render without an adapter.</li>
 *   <li>{@code /query/{program}} — one row per event / enrollment,
 *       with headers for the fixed columns (event UID, occurred-at,
 *       org unit, status). Used by Line List to dump the raw rows.</li>
 * </ul>
 *
 * <p>Posture: enrollments are included for API-shape parity even
 * though the dev appliance has zero rows; the shape is what matters
 * at boot time, and the live-data case is covered the moment an
 * operator does their first enrollment.</p>
 */
@RestController
@RequestMapping(path = "/api/analytics", produces = MediaType.APPLICATION_JSON_VALUE)
public class EventAnalyticsController {

    private final JdbcTemplate jdbc;

    public EventAnalyticsController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    // ---- events ----

    @GetMapping("/events/aggregate/{program}")
    public ResponseEntity<Map<String, Object>> eventsAggregate(
            final Authentication auth,
            @PathVariable("program") final String program,
            @RequestParam(name = "dimension", required = false) final List<String> dimensions,
            @RequestParam(name = "stage", required = false) final String stage) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, List<String>> dims = parseDimensions(dimensions);
        resolveRelativePeriods(dims);
        final List<String> axes = new ArrayList<>(dims.keySet());

        final List<Object> params = new ArrayList<>();
        final StringBuilder where = new StringBuilder();
        appendEq(where, params, "program_uid", program);
        if (stage != null && !stage.isBlank()) {
            appendEq(where, params, "program_stage_uid", stage);
        }
        appendPeriodIn(where, params, "occurred_at", dims.get("pe"));
        appendIn(where, params, "org_unit_uid", dims.get("ou"));

        final String selectCols = buildSelectCols(axes);
        final String groupByCols = buildGroupCols(axes);
        final String sql = "SELECT " + selectCols
                + (selectCols.isEmpty() ? "" : ", ")
                + "count(*)::double precision AS value "
                + "FROM der.event "
                + "WHERE " + where
                + (groupByCols.isEmpty() ? "" : " GROUP BY " + groupByCols);

        final List<Map<String, Object>> raw = jdbc.queryForList(sql, params.toArray());
        final List<List<Object>> rows = toRows(axes, raw);
        return ResponseEntity.ok(buildBody(axes, rows, dims));
    }

    @GetMapping("/events/query/{program}")
    public ResponseEntity<Map<String, Object>> eventsQuery(
            final Authentication auth,
            @PathVariable("program") final String program,
            @RequestParam(name = "dimension", required = false) final List<String> dimensions,
            @RequestParam(name = "stage", required = false) final String stage,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, List<String>> dims = parseDimensions(dimensions);
        resolveRelativePeriods(dims);

        final List<Object> params = new ArrayList<>();
        final StringBuilder where = new StringBuilder();
        appendEq(where, params, "program_uid", program);
        if (stage != null && !stage.isBlank()) {
            appendEq(where, params, "program_stage_uid", stage);
        }
        appendPeriodIn(where, params, "occurred_at", dims.get("pe"));
        appendIn(where, params, "org_unit_uid", dims.get("ou"));

        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final int offset = (safePage - 1) * safeSize;

        final String sql = "SELECT event_id, program_uid, program_stage_uid, "
                + "org_unit_uid, occurred_at, status "
                + "FROM der.event WHERE " + where
                + " ORDER BY occurred_at DESC "
                + " LIMIT " + safeSize + " OFFSET " + offset;
        final List<Map<String, Object>> raw = jdbc.queryForList(sql, params.toArray());

        final List<List<Object>> rows = new ArrayList<>(raw.size());
        for (final Map<String, Object> r : raw) {
            final List<Object> row = new ArrayList<>();
            row.add(r.get("event_id"));
            row.add(r.get("program_uid"));
            row.add(r.get("program_stage_uid"));
            row.add(r.get("org_unit_uid"));
            row.add(r.get("occurred_at") == null ? "" : r.get("occurred_at").toString());
            row.add(r.get("status"));
            rows.add(row);
        }

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("headers", List.of(
                header("psi", "Event", "TEXT"),
                header("program", "Program", "TEXT"),
                header("programStage", "Program stage", "TEXT"),
                header("ou", "Organisation unit", "TEXT"),
                header("eventdate", "Event date", "DATE"),
                header("eventstatus", "Event status", "TEXT")));
        final Integer total = jdbc.queryForObject(
                "SELECT count(*) FROM der.event WHERE " + where,
                Integer.class, params.toArray());
        body.put("metaData", Map.of(
                "pager", Map.of("page", safePage, "pageSize", safeSize,
                        "total", total == null ? 0 : total,
                        "pageCount", total == null ? 0
                                : (int) Math.ceil(total / (double) safeSize))));
        body.put("rows", rows);
        body.put("width", 6);
        body.put("height", rows.size());
        return ResponseEntity.ok(body);
    }

    // ---- enrollments (same shape, der.enrollment backing) ----

    @GetMapping("/enrollments/aggregate/{program}")
    public ResponseEntity<Map<String, Object>> enrollmentsAggregate(
            final Authentication auth,
            @PathVariable("program") final String program,
            @RequestParam(name = "dimension", required = false) final List<String> dimensions) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, List<String>> dims = parseDimensions(dimensions);
        resolveRelativePeriods(dims);
        final List<String> axes = new ArrayList<>(dims.keySet());

        final List<Object> params = new ArrayList<>();
        final StringBuilder where = new StringBuilder();
        appendEq(where, params, "program_uid", program);
        appendPeriodIn(where, params, "enrolled_at", dims.get("pe"));
        appendIn(where, params, "org_unit_uid", dims.get("ou"));

        final String selectCols = buildSelectColsEnrollment(axes);
        final String groupByCols = buildGroupColsEnrollment(axes);
        final String sql = "SELECT " + selectCols
                + (selectCols.isEmpty() ? "" : ", ")
                + "count(*)::double precision AS value "
                + "FROM der.enrollment "
                + "WHERE " + where
                + (groupByCols.isEmpty() ? "" : " GROUP BY " + groupByCols);
        final List<Map<String, Object>> raw = jdbc.queryForList(sql, params.toArray());
        return ResponseEntity.ok(buildBody(axes, toRows(axes, raw), dims));
    }

    @GetMapping("/enrollments/query/{program}")
    public ResponseEntity<Map<String, Object>> enrollmentsQuery(
            final Authentication auth,
            @PathVariable("program") final String program,
            @RequestParam(name = "pageSize", defaultValue = "100") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final int offset = (safePage - 1) * safeSize;
        final List<Map<String, Object>> raw = jdbc.queryForList(
                "SELECT enrollment_id, tei_id, program_uid, org_unit_uid, "
                        + "enrolled_at, status "
                        + "FROM der.enrollment WHERE program_uid = ? "
                        + "ORDER BY enrolled_at DESC LIMIT ? OFFSET ?",
                program, safeSize, offset);
        final List<List<Object>> rows = new ArrayList<>(raw.size());
        for (final Map<String, Object> r : raw) {
            rows.add(List.of(
                    r.get("enrollment_id") == null ? "" : r.get("enrollment_id").toString(),
                    r.get("tei_id") == null ? "" : r.get("tei_id").toString(),
                    r.get("program_uid") == null ? "" : r.get("program_uid").toString(),
                    r.get("org_unit_uid") == null ? "" : r.get("org_unit_uid").toString(),
                    r.get("enrolled_at") == null ? "" : r.get("enrolled_at").toString(),
                    r.get("status") == null ? "" : r.get("status").toString()));
        }
        final Integer total = jdbc.queryForObject(
                "SELECT count(*) FROM der.enrollment WHERE program_uid = ?",
                Integer.class, program);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("headers", List.of(
                header("pi", "Enrollment", "TEXT"),
                header("tei", "Tracked entity instance", "TEXT"),
                header("program", "Program", "TEXT"),
                header("ou", "Organisation unit", "TEXT"),
                header("enrollmentdate", "Enrollment date", "DATE"),
                header("enrollmentstatus", "Enrollment status", "TEXT")));
        body.put("metaData", Map.of(
                "pager", Map.of("page", safePage, "pageSize", safeSize,
                        "total", total == null ? 0 : total,
                        "pageCount", total == null ? 0
                                : (int) Math.ceil(total / (double) safeSize))));
        body.put("rows", rows);
        body.put("width", 6);
        body.put("height", rows.size());
        return ResponseEntity.ok(body);
    }

    // ---- helpers ----

    private static Map<String, List<String>> parseDimensions(final List<String> raw) {
        final Map<String, List<String>> out = new LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        for (final String spec : raw) {
            if (spec == null || spec.isBlank()) {
                continue;
            }
            final int colon = spec.indexOf(':');
            if (colon < 0) {
                out.computeIfAbsent(spec.trim(), k -> new ArrayList<>());
                continue;
            }
            final String key = spec.substring(0, colon).trim();
            final List<String> values = out.computeIfAbsent(key, k -> new ArrayList<>());
            for (final String v : spec.substring(colon + 1).split(";")) {
                final String t = v.trim();
                if (!t.isEmpty()) {
                    values.add(t);
                }
            }
        }
        return out;
    }

    private static void resolveRelativePeriods(final Map<String, List<String>> dims) {
        final List<String> pe = dims.get("pe");
        if (pe == null || pe.isEmpty()) {
            return;
        }
        final List<String> resolved = new ArrayList<>();
        for (final String t : pe) {
            resolved.addAll(RelativePeriodResolver.resolve(t));
        }
        dims.put("pe", resolved);
    }

    private static void appendEq(final StringBuilder sb, final List<Object> params,
                                   final String column, final String value) {
        if (sb.length() > 0) {
            sb.append(" AND ");
        }
        sb.append(column).append(" = ?");
        params.add(value);
    }

    private static void appendIn(final StringBuilder sb, final List<Object> params,
                                   final String column, final List<String> values) {
        if (values == null || values.isEmpty()) {
            return;
        }
        if (sb.length() > 0) {
            sb.append(" AND ");
        }
        sb.append(column).append(" IN (");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('?');
            params.add(values.get(i));
        }
        sb.append(')');
    }

    /** Events don't have a period_iso column — they carry a
     *  {@code occurred_at timestamptz}. For now we support monthly
     *  period filtering by extracting YYYYMM from the timestamp; a
     *  follow-up batch will handle daily/weekly/quarterly period
     *  shapes by period-type-switching the SQL extract. */
    private static void appendPeriodIn(final StringBuilder sb, final List<Object> params,
                                         final String column, final List<String> periods) {
        if (periods == null || periods.isEmpty()) {
            return;
        }
        if (sb.length() > 0) {
            sb.append(" AND ");
        }
        sb.append("to_char(").append(column).append(", 'YYYYMM') IN (");
        for (int i = 0; i < periods.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('?');
            // If the period is already a YYYYMM literal, pass through;
            // otherwise fall back to the first 6 chars (e.g. 20250115 ->
            // 202501).
            params.add(periods.get(i).length() >= 6
                    ? periods.get(i).substring(0, 6) : periods.get(i));
        }
        sb.append(')');
    }

    /** Build the SELECT projection with AS-aliases (for buildBody to
     *  find keys) OR the bare GROUP BY expressions (Postgres doesn't
     *  accept AS aliases in GROUP BY). Callers use the matching one. */
    private static String buildSelectCols(final List<String> axes) {
        final List<String> cols = new ArrayList<>();
        for (final String ax : axes) {
            switch (ax) {
                case "pe" -> cols.add("to_char(occurred_at, 'YYYYMM') AS pe");
                case "ou" -> cols.add("org_unit_uid AS ou");
                default -> { /* unknown — skip */ }
            }
        }
        return String.join(", ", cols);
    }

    private static String buildGroupCols(final List<String> axes) {
        final List<String> cols = new ArrayList<>();
        for (final String ax : axes) {
            switch (ax) {
                case "pe" -> cols.add("to_char(occurred_at, 'YYYYMM')");
                case "ou" -> cols.add("org_unit_uid");
                default -> { /* unknown — skip */ }
            }
        }
        return String.join(", ", cols);
    }

    // Enrollment uses enrolled_at instead of occurred_at.
    private static String buildSelectColsEnrollment(final List<String> axes) {
        final List<String> cols = new ArrayList<>();
        for (final String ax : axes) {
            switch (ax) {
                case "pe" -> cols.add("to_char(enrolled_at, 'YYYYMM') AS pe");
                case "ou" -> cols.add("org_unit_uid AS ou");
                default -> { /* unknown — skip */ }
            }
        }
        return String.join(", ", cols);
    }

    private static String buildGroupColsEnrollment(final List<String> axes) {
        final List<String> cols = new ArrayList<>();
        for (final String ax : axes) {
            switch (ax) {
                case "pe" -> cols.add("to_char(enrolled_at, 'YYYYMM')");
                case "ou" -> cols.add("org_unit_uid");
                default -> { /* unknown — skip */ }
            }
        }
        return String.join(", ", cols);
    }

    private static List<List<Object>> toRows(final List<String> axes,
                                               final List<Map<String, Object>> raw) {
        final List<List<Object>> rows = new ArrayList<>(raw.size());
        for (final Map<String, Object> r : raw) {
            final List<Object> row = new ArrayList<>(axes.size() + 1);
            for (final String ax : axes) {
                row.add(r.get(ax));
            }
            final Object v = r.get("value");
            row.add(v == null ? "0" : formatNumber(v));
            rows.add(row);
        }
        return rows;
    }

    private static String formatNumber(final Object v) {
        if (v instanceof Number n) {
            final double d = n.doubleValue();
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return Long.toString((long) d);
            }
            return Double.toString(d);
        }
        return v.toString();
    }

    private static Map<String, Object> buildBody(final List<String> axes,
                                                    final List<List<Object>> rows,
                                                    final Map<String, List<String>> dims) {
        final List<Map<String, Object>> headers = new ArrayList<>();
        for (final String ax : axes) {
            headers.add(header(ax, columnLabel(ax), "TEXT"));
        }
        headers.add(header("value", "Value", "NUMBER"));

        final Map<String, List<String>> byAxis = new LinkedHashMap<>();
        for (final String ax : axes) {
            final Set<String> values = new LinkedHashSet<>();
            final int idx = axes.indexOf(ax);
            for (final List<Object> row : rows) {
                final Object v = row.get(idx);
                if (v != null) {
                    values.add(v.toString());
                }
            }
            if (values.isEmpty() && dims.get(ax) != null) {
                values.addAll(dims.get(ax));
            }
            byAxis.put(ax, new ArrayList<>(values));
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("headers", headers);
        body.put("metaData", Map.of("dimensions", byAxis, "items", Map.of()));
        body.put("rows", rows);
        body.put("width", axes.size() + 1);
        body.put("height", rows.size());
        return body;
    }

    private static Map<String, Object> header(final String name, final String column,
                                                 final String valueType) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("column", column);
        m.put("valueType", valueType);
        m.put("type", switch (valueType.toUpperCase(Locale.ROOT)) {
            case "NUMBER" -> "java.lang.Double";
            case "DATE" -> "java.util.Date";
            default -> "java.lang.String";
        });
        m.put("hidden", false);
        m.put("meta", !"NUMBER".equalsIgnoreCase(valueType));
        return m;
    }

    private static String columnLabel(final String axis) {
        return switch (axis) {
            case "pe" -> "Period";
            case "ou" -> "Organisation unit";
            default -> axis;
        };
    }
}
