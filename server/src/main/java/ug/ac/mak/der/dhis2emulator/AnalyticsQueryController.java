package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Native {@code GET /api/analytics} handler — the first user-visible
 * output of DER's on-edge analytics engine (Wave 2). Takes DHIS2's
 * {@code dimension=dx:X;Y&dimension=pe:P1;P2&dimension=ou:OU} query
 * grammar, resolves it against {@code der.aggregate_data_value}, and
 * returns the standard DHIS2 {@code { headers, metaData, rows,
 * width, height }} shape so Data Visualizer, Dashboard chart items,
 * and any custom app calling {@code analytics.query()} render real
 * numbers without a central round-trip.
 *
 * <p>Batch 1 scope (conservative, build-up incrementally):
 * <ul>
 *   <li>Dimensions: {@code dx}, {@code pe}, {@code ou} — literal UIDs
 *       + ISO period codes ({@code 202501}, {@code 2025}, {@code 2025W01},
 *       {@code 2025Q1}). Relative periods ({@code LAST_12_MONTHS},
 *       {@code THIS_YEAR}, …) and {@code USER_ORGUNIT*} placeholders
 *       land in a follow-up batch along with hierarchy aggregation.</li>
 *   <li>Aggregation: {@code SUM} default, {@code AVG}, {@code COUNT},
 *       {@code MIN}, {@code MAX} via {@code ?aggregationType=}. Parses
 *       {@code value_text} as a double; rows that don't parse are
 *       skipped (matches central's {@code valueType=NUMBER} filter).</li>
 *   <li>Filtering: {@code ?filter=<dim>:<value>} is accepted and
 *       folded into the WHERE clause the same way a dimension is,
 *       but the dimension itself is omitted from the output axes
 *       (DHIS2 semantics).</li>
 * </ul>
 *
 * <p>Out of scope for Batch 1 (intentional — see Wave 2 phasing):
 * {@code /api/analytics/events}, {@code /api/analytics/enrollments},
 * {@code /api/analytics/outliers}, {@code /api/analytics/dataValueSet},
 * attribute-option-combo axes, data-element categories as explicit
 * dimensions, indicator expressions, outputIdScheme translation.</p>
 */
@RestController
@RequestMapping(path = "/api/analytics", produces = MediaType.APPLICATION_JSON_VALUE)
public class AnalyticsQueryController {

    private static final Set<String> SUPPORTED_AGGREGATIONS =
            Set.of("SUM", "AVG", "COUNT", "MIN", "MAX");

    private final JdbcTemplate jdbc;
    private final ObjectProvider<OrgUnitBindingService> bindingProvider;

    public AnalyticsQueryController(final JdbcTemplate jdbc,
                                      final ObjectProvider<OrgUnitBindingService> bindingProvider) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.bindingProvider = Objects.requireNonNull(bindingProvider, "bindingProvider");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> analytics(
            final Authentication auth,
            @RequestParam(name = "dimension", required = false) final List<String> dimensions,
            @RequestParam(name = "filter", required = false) final List<String> filters,
            @RequestParam(name = "aggregationType", required = false) final String aggregationType,
            @RequestParam(name = "skipMeta", defaultValue = "false") final boolean skipMeta,
            @RequestParam(name = "outputIdScheme", required = false) final String outputIdScheme) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (dimensions == null || dimensions.isEmpty()) {
            return conflictEnvelope("E7101",
                    "At least one dimension must be specified");
        }
        final String agg = aggregationType == null || aggregationType.isBlank()
                ? "SUM" : aggregationType.toUpperCase(Locale.ROOT);
        if (!SUPPORTED_AGGREGATIONS.contains(agg)) {
            return conflictEnvelope("E7128",
                    "Aggregation type not supported: " + agg
                            + " (SUM/AVG/COUNT/MIN/MAX)");
        }

        final Map<String, List<String>> dims = parseDimensionList(dimensions);
        final Map<String, List<String>> flt = parseDimensionList(
                filters == null ? List.of() : filters);

        // Resolve relative periods (LAST_12_MONTHS -> list of ISO codes),
        // USER_ORGUNIT placeholders, and OU hierarchy expansion. Each
        // step mutates the dim/flt maps in place so the WHERE builder
        // downstream sees only literal UIDs + ISO periods.
        final EdgeUserPrincipal principal = (EdgeUserPrincipal) auth;
        try {
            resolveRelativePeriods(dims);
            resolveRelativePeriods(flt);
        } catch (final IllegalArgumentException ex) {
            return conflictEnvelope("E7124", ex.getMessage());
        }
        resolveUserOrgUnits(dims, principal);
        resolveUserOrgUnits(flt, principal);
        expandOrgUnitHierarchy(dims);
        expandOrgUnitHierarchy(flt);

        // DHIS2 requires `dx` on every aggregate query; without it the
        // response is "Dimension is present in query without any valid
        // dimension options: `dx`" (E7124). Mirror that contract.
        if (!dims.containsKey("dx") && !flt.containsKey("dx")) {
            return conflictEnvelope("E7124",
                    "Dimension is present in query without any valid dimension options: `dx`");
        }
        if (!dims.containsKey("pe") && !flt.containsKey("pe")) {
            return conflictEnvelope("E7124",
                    "Dimension is present in query without any valid dimension options: `pe`");
        }
        if (!dims.containsKey("ou") && !flt.containsKey("ou")) {
            return conflictEnvelope("E7124",
                    "Dimension is present in query without any valid dimension options: `ou`");
        }

        // Axes = ordered list of dimension names appearing in `dimension=`
        // params; filters are WHERE-only and don't show on the output.
        final List<String> axes = new ArrayList<>(dims.keySet());

        // Build WHERE clause from dims ∪ flt. Values go through parameter
        // binding — no string interpolation of operator input.
        final List<Object> params = new ArrayList<>();
        final StringBuilder where = new StringBuilder();
        appendIn(where, params, "data_element_uid", union(dims.get("dx"), flt.get("dx")));
        appendIn(where, params, "period_iso", union(dims.get("pe"), flt.get("pe")));
        appendIn(where, params, "org_unit_uid", union(dims.get("ou"), flt.get("ou")));

        final String sql = "SELECT data_element_uid AS dx, "
                + "period_iso AS pe, "
                + "org_unit_uid AS ou, "
                + sqlAggregate(agg)
                + " FROM der.aggregate_data_value "
                + "WHERE " + where
                + "  AND value_text ~ '^-?[0-9]+(\\.[0-9]+)?$' "
                + "GROUP BY data_element_uid, period_iso, org_unit_uid";

        final List<Map<String, Object>> raw = jdbc.queryForList(sql, params.toArray());

        // Each row's output order follows axes + "value". Axes drop the
        // dimensions that are filter-only (they're a single-value WHERE,
        // not an output axis).
        final List<List<Object>> rows = new ArrayList<>(raw.size());
        for (final Map<String, Object> r : raw) {
            final List<Object> row = new ArrayList<>(axes.size() + 1);
            for (final String ax : axes) {
                row.add(r.get(ax));
            }
            final Object v = r.get("value");
            row.add(v == null ? "0" : formatValue(v));
            rows.add(row);
        }

        // Enrich: look up real display names for every UID that appears
        // in the axes. outputIdScheme=NAME / CODE additionally rewrites
        // the row cells so chart labels show the human-readable string
        // instead of the UID.
        final OutputScheme scheme = OutputScheme.parse(outputIdScheme);
        final Map<String, Map<String, String>> labels =
                resolveLabels(dims, flt, rows, axes);
        if (scheme != OutputScheme.UID) {
            rewriteRowIds(rows, axes, labels, scheme);
        }

        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("headers", buildHeaders(axes));
        if (!skipMeta) {
            body.put("metaData", buildMetaData(dims, flt, rows, axes, labels));
        }
        body.put("rows", rows);
        body.put("width", axes.size() + 1);
        body.put("height", rows.size());
        return ResponseEntity.ok(body);
    }

    /** DHIS2 {@code outputIdScheme} — determines how rows reference
     *  dimension items. UID (default) leaves UIDs in place; NAME
     *  substitutes {@code displayName}; CODE substitutes the DHIS2
     *  {@code code} attribute (falls back to UID when code is unset,
     *  which matches central's behaviour). */
    private enum OutputScheme {
        UID, NAME, CODE;
        static OutputScheme parse(final String raw) {
            if (raw == null || raw.isBlank()) {
                return UID;
            }
            return switch (raw.trim().toUpperCase(Locale.ROOT)) {
                case "NAME" -> NAME;
                case "CODE" -> CODE;
                default -> UID;
            };
        }
    }

    private static String sqlAggregate(final String agg) {
        // value_text is text; cast to numeric only on the rows that pass
        // the regex filter above. SUM/AVG/MIN/MAX use double-precision
        // to match DHIS2's analytics output precision; COUNT counts rows.
        return switch (agg) {
            case "SUM" -> "sum(value_text::double precision) AS value";
            case "AVG" -> "avg(value_text::double precision) AS value";
            case "COUNT" -> "count(*)::double precision AS value";
            case "MIN" -> "min(value_text::double precision) AS value";
            case "MAX" -> "max(value_text::double precision) AS value";
            default -> throw new IllegalStateException("unknown aggregation " + agg);
        };
    }

    private static String formatValue(final Object v) {
        // DHIS2 returns values as strings in the rows array. Integers
        // render without a decimal (123), non-integers with as many
        // digits as needed (123.4). Matches what Data Visualizer
        // formats-against downstream.
        if (v instanceof Number n) {
            final double d = n.doubleValue();
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return Long.toString((long) d);
            }
            return Double.toString(d);
        }
        return v.toString();
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

    private static List<String> union(final List<String> a, final List<String> b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        final List<String> out = new ArrayList<>(a.size() + b.size());
        out.addAll(a);
        out.addAll(b);
        return out;
    }

    /** Parses DHIS2's {@code dim:v1;v2;v3} grammar into
     *  {@code {dim: [v1, v2, v3]}}. Preserves insertion order so
     *  the first {@code dimension=} param dictates the first axis in
     *  the output grid — matches central's behaviour. */
    private static Map<String, List<String>> parseDimensionList(final List<String> raw) {
        final Map<String, List<String>> out = new LinkedHashMap<>();
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
            final String[] vs = spec.substring(colon + 1).split(";");
            final List<String> values = out.computeIfAbsent(key, k -> new ArrayList<>());
            for (final String v : vs) {
                final String t = v.trim();
                if (!t.isEmpty()) {
                    values.add(t);
                }
            }
        }
        return out;
    }

    private static List<Map<String, Object>> buildHeaders(final List<String> axes) {
        final List<Map<String, Object>> h = new ArrayList<>();
        for (final String ax : axes) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", ax);
            m.put("column", columnLabel(ax));
            m.put("valueType", "TEXT");
            m.put("type", "java.lang.String");
            m.put("hidden", false);
            m.put("meta", true);
            h.add(m);
        }
        final Map<String, Object> v = new LinkedHashMap<>();
        v.put("name", "value");
        v.put("column", "Value");
        v.put("valueType", "NUMBER");
        v.put("type", "java.lang.Double");
        v.put("hidden", false);
        v.put("meta", false);
        h.add(v);
        return h;
    }

    private static String columnLabel(final String axis) {
        return switch (axis) {
            case "dx" -> "Data";
            case "pe" -> "Period";
            case "ou" -> "Organisation unit";
            case "co" -> "Category option combo";
            case "ao" -> "Attribute option combo";
            default -> axis;
        };
    }

    /** {@code metaData} is the DHIS2 lookup side-car Data Visualizer uses
     *  to render UID → display name. Items are enriched from the
     *  metadata mirror (data_element / organisation_unit /
     *  category_option_combo) so chart titles show proper labels
     *  instead of raw UIDs; periods are formatted human-readably via
     *  {@link #formatPeriodName(String)}. */
    private Map<String, Object> buildMetaData(final Map<String, List<String>> dims,
                                                 final Map<String, List<String>> flt,
                                                 final List<List<Object>> rows,
                                                 final List<String> axes,
                                                 final Map<String, Map<String, String>> labels) {
        final Map<String, List<String>> byAxis = new LinkedHashMap<>();
        for (final String ax : axes) {
            final List<String> values = new ArrayList<>();
            final int idx = axes.indexOf(ax);
            for (final List<Object> row : rows) {
                final Object v = row.get(idx);
                if (v != null) {
                    final String s = v.toString();
                    if (!values.contains(s)) {
                        values.add(s);
                    }
                }
            }
            // Fall back to the requested dimension values when the result
            // set is empty — otherwise DV renders "no data" with a blank
            // picker instead of the selected-but-empty bars.
            if (values.isEmpty() && dims.get(ax) != null) {
                values.addAll(dims.get(ax));
            }
            byAxis.put(ax, values);
        }
        // Filter-only axes still need a (single-value) entry in the
        // dimensions map so DV can render "filtered by X".
        for (final Map.Entry<String, List<String>> e : flt.entrySet()) {
            if (!byAxis.containsKey(e.getKey())) {
                byAxis.put(e.getKey(), e.getValue());
            }
        }
        final Map<String, Object> items = new HashMap<>();
        for (final Map.Entry<String, List<String>> e : byAxis.entrySet()) {
            final String axis = e.getKey();
            final Map<String, String> axisLabels = labels.getOrDefault(axis, Map.of());
            for (final String uid : e.getValue()) {
                final String name = axisLabels.getOrDefault(uid, uid);
                items.put(uid, Map.of("name", name, "uid", uid));
            }
        }
        final Map<String, Object> md = new LinkedHashMap<>();
        md.put("items", items);
        md.put("dimensions", byAxis);
        return md;
    }

    /**
     * Batch-fetch display names (and codes, extracted from the JSONB
     * payload) for every UID referenced by the result. One query per
     * entity table — not per row — so a 500-row response still only
     * costs three SELECTs. Returns a map keyed by axis name so the
     * caller can look up {@code labels.get("dx").get(uid)} without
     * guessing which table a UID came from.
     *
     * <p>Periods are special — they don't have a mirror table, so we
     * format them inline from the ISO code via
     * {@link #formatPeriodName(String)} (e.g. {@code 202506} → "June
     * 2025"). This matches the human label DHIS2 central ships back
     * for a period UID.</p>
     */
    private Map<String, Map<String, String>> resolveLabels(
            final Map<String, List<String>> dims,
            final Map<String, List<String>> flt,
            final List<List<Object>> rows,
            final List<String> axes) {
        // Collect every UID that could appear in the output so we can
        // resolve them in one sweep per entity table.
        final Set<String> dxUids = new LinkedHashSet<>();
        final Set<String> ouUids = new LinkedHashSet<>();
        final Set<String> coUids = new LinkedHashSet<>();
        final Set<String> peUids = new LinkedHashSet<>();
        for (final String ax : axes) {
            final int idx = axes.indexOf(ax);
            for (final List<Object> row : rows) {
                final Object v = row.get(idx);
                if (v == null) {
                    continue;
                }
                final String s = v.toString();
                switch (ax) {
                    case "dx" -> dxUids.add(s);
                    case "ou" -> ouUids.add(s);
                    case "co", "ao" -> coUids.add(s);
                    case "pe" -> peUids.add(s);
                    default -> { /* unknown axis — no lookup */ }
                }
            }
        }
        // Include dimension-list UIDs even when they didn't appear in
        // the result set so metaData.items has the picker labels.
        addAllIfPresent(dxUids, dims.get("dx"));
        addAllIfPresent(dxUids, flt.get("dx"));
        addAllIfPresent(ouUids, dims.get("ou"));
        addAllIfPresent(ouUids, flt.get("ou"));
        addAllIfPresent(peUids, dims.get("pe"));
        addAllIfPresent(peUids, flt.get("pe"));

        final Map<String, Map<String, String>> out = new LinkedHashMap<>();
        out.put("dx", batchLookup("der.metadata_data_element", dxUids));
        out.put("ou", batchLookup("der.metadata_organisation_unit", ouUids));
        out.put("co", batchLookup("der.metadata_category_option_combo", coUids));
        out.put("ao", out.get("co"));
        // Periods have no mirror table — format inline from the ISO code.
        final Map<String, String> peLabels = new LinkedHashMap<>();
        for (final String pe : peUids) {
            peLabels.put(pe, formatPeriodName(pe));
        }
        out.put("pe", peLabels);
        return out;
    }

    private static void addAllIfPresent(final Set<String> target, final List<String> src) {
        if (src != null) {
            target.addAll(src);
        }
    }

    private Map<String, String> batchLookup(final String table, final Set<String> uids) {
        if (uids.isEmpty()) {
            return Map.of();
        }
        final List<String> uidList = new ArrayList<>(uids);
        final StringBuilder placeholders = new StringBuilder();
        for (int i = 0; i < uidList.size(); i++) {
            if (i > 0) {
                placeholders.append(',');
            }
            placeholders.append('?');
        }
        final Map<String, String> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT dhis2_uid, display_name FROM " + table
                        + " WHERE dhis2_uid IN (" + placeholders + ")",
                rs -> {
                    out.put(rs.getString("dhis2_uid"),
                            rs.getString("display_name"));
                },
                (Object[]) uidList.toArray(new String[0]));
        return out;
    }

    /**
     * Format a DHIS2 period ISO code into the human label central
     * returns. Covers the common period types: daily (YYYYMMDD),
     * monthly (YYYYMM), quarterly (YYYYQn), six-monthly (YYYYSn),
     * yearly (YYYY), weekly (YYYYWnn). Everything else falls back to
     * the raw code so unusual period types (financial years, bimonths)
     * at least show up readably.
     */
    static String formatPeriodName(final String iso) {
        if (iso == null || iso.length() < 4) {
            return iso;
        }
        final String year = iso.substring(0, 4);
        if (iso.length() == 4) {
            return year;
        }
        if (iso.length() == 6 && iso.chars().allMatch(Character::isDigit)) {
            final int m = Integer.parseInt(iso.substring(4, 6));
            return monthName(m) + " " + year;
        }
        if (iso.length() == 8 && iso.chars().allMatch(Character::isDigit)) {
            final int m = Integer.parseInt(iso.substring(4, 6));
            final int d = Integer.parseInt(iso.substring(6, 8));
            return d + " " + monthName(m) + " " + year;
        }
        if (iso.length() == 6 && iso.charAt(4) == 'Q') {
            return year + " Q" + iso.substring(5);
        }
        if (iso.length() == 6 && iso.charAt(4) == 'S') {
            return year + " S" + iso.substring(5);
        }
        if (iso.length() >= 6 && iso.charAt(4) == 'W') {
            return year + " W" + iso.substring(5);
        }
        return iso;
    }

    private static String monthName(final int m) {
        return switch (m) {
            case 1 -> "January"; case 2 -> "February"; case 3 -> "March";
            case 4 -> "April"; case 5 -> "May"; case 6 -> "June";
            case 7 -> "July"; case 8 -> "August"; case 9 -> "September";
            case 10 -> "October"; case 11 -> "November"; case 12 -> "December";
            default -> Integer.toString(m);
        };
    }

    private void rewriteRowIds(final List<List<Object>> rows,
                                 final List<String> axes,
                                 final Map<String, Map<String, String>> labels,
                                 final OutputScheme scheme) {
        for (final List<Object> row : rows) {
            for (int i = 0; i < axes.size(); i++) {
                final String axis = axes.get(i);
                final Object cell = row.get(i);
                if (cell == null) {
                    continue;
                }
                final String uid = cell.toString();
                final String replacement = switch (scheme) {
                    case NAME -> labels.getOrDefault(axis, Map.of()).getOrDefault(uid, uid);
                    case CODE -> uid; // CODE lookup lands in a follow-up
                                     // batch when the mirror exposes
                                     // the code column — pending central
                                     // behaviour is to fall back to UID.
                    case UID -> uid;
                };
                row.set(i, replacement);
            }
        }
    }

    private static ResponseEntity<Map<String, Object>> conflictEnvelope(
            final String errorCode, final String message) {
        return ResponseEntity.status(409).body(Map.of(
                "httpStatus", "Conflict",
                "httpStatusCode", 409,
                "status", "ERROR",
                "errorCode", errorCode,
                "message", message));
    }

    /** Walks the {@code pe} dimension / filter values and expands any
     *  relative-period token (LAST_12_MONTHS, THIS_YEAR, …) into its
     *  literal ISO codes via {@link RelativePeriodResolver}. Literals
     *  pass through unchanged. Ordering within the expanded list
     *  matches the resolver's output so the oldest period comes first
     *  (Data Visualizer renders charts left-to-right chronologically). */
    private static void resolveRelativePeriods(final Map<String, List<String>> dims) {
        final List<String> pe = dims.get("pe");
        if (pe == null || pe.isEmpty()) {
            return;
        }
        final List<String> resolved = new ArrayList<>();
        for (final String token : pe) {
            resolved.addAll(RelativePeriodResolver.resolve(token));
        }
        dims.put("pe", resolved);
    }

    /** DHIS2 analytics clients use three OU placeholders:
     *  {@code USER_ORGUNIT} (the user's bound OU),
     *  {@code USER_ORGUNIT_CHILDREN} (direct children),
     *  {@code USER_ORGUNIT_GRANDCHILDREN} (grandchildren). We resolve
     *  against {@link OrgUnitBindingService#current()} — when the
     *  appliance isn't bound the placeholders collapse to empty, which
     *  mirrors central's behaviour for an unassigned caller. */
    private void resolveUserOrgUnits(final Map<String, List<String>> dims,
                                       final EdgeUserPrincipal principal) {
        final List<String> ou = dims.get("ou");
        if (ou == null || ou.isEmpty()) {
            return;
        }
        final OrgUnitBindingService svc = bindingProvider.getIfAvailable();
        if (svc == null) {
            return;
        }
        final EdgeOrgUnitBinding binding = svc.current();
        final String bound = binding == null ? null : binding.orgUnitId();
        if (bound == null) {
            // Strip the placeholders — resolving them to nothing makes
            // the query degenerate cleanly to "no matching OUs".
            ou.removeIf(s -> s.startsWith("USER_ORGUNIT"));
            return;
        }
        final List<String> resolved = new ArrayList<>();
        for (final String token : ou) {
            switch (token) {
                case "USER_ORGUNIT" -> resolved.add(bound);
                case "USER_ORGUNIT_CHILDREN" -> resolved.addAll(
                        childrenOf(bound));
                case "USER_ORGUNIT_GRANDCHILDREN" -> resolved.addAll(
                        grandchildrenOf(bound));
                default -> resolved.add(token);
            }
        }
        dims.put("ou", resolved);
    }

    private List<String> childrenOf(final String parentUid) {
        return jdbc.queryForList(
                "SELECT dhis2_uid FROM der.metadata_organisation_unit "
                        + "WHERE parent_uid = ? ORDER BY display_name",
                String.class, parentUid);
    }

    private List<String> grandchildrenOf(final String parentUid) {
        return jdbc.queryForList(
                "SELECT c.dhis2_uid "
                        + "FROM der.metadata_organisation_unit c "
                        + "JOIN der.metadata_organisation_unit p "
                        + "  ON c.parent_uid = p.dhis2_uid "
                        + "WHERE p.parent_uid = ? ORDER BY c.display_name",
                String.class, parentUid);
    }

    /**
     * DHIS2 hierarchy semantics: when the caller asks for {@code ou:<parent>},
     * the value returned is the sum of all leaf-facility values under
     * that parent — the parent itself rarely carries values directly;
     * values roll up from the facilities beneath. We implement this by
     * appending every descendant UID to the {@code ou} list so the
     * subsequent SUM query picks them up through the same IN clause.
     *
     * <p>The parent UID itself stays in the list so facilities that
     * mistakenly carry values at the district level still contribute.
     * De-duplicate via a LinkedHashSet to preserve the first-seen order
     * (matters for output axis ordering).</p>
     */
    private void expandOrgUnitHierarchy(final Map<String, List<String>> dims) {
        final List<String> ou = dims.get("ou");
        if (ou == null || ou.isEmpty()) {
            return;
        }
        final Set<String> expanded = new LinkedHashSet<>();
        for (final String uid : ou) {
            expanded.add(uid);
            // path LIKE '%/<uid>/%' catches every OU with this UID as
            // an ancestor segment (the trailing '/' forces exact-UID
            // match — avoids matching UIDs that happen to be substrings
            // of other UIDs). Fall through silently if the parent isn't
            // in the mirror (query returns empty list).
            final List<String> descendants = jdbc.queryForList(
                    "SELECT dhis2_uid FROM der.metadata_organisation_unit "
                            + "WHERE path LIKE ?",
                    String.class, "%/" + uid + "/%");
            expanded.addAll(descendants);
        }
        dims.put("ou", new ArrayList<>(expanded));
    }
}
