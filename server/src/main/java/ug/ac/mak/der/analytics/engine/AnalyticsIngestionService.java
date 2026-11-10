package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.analytics.expression.ExpressionContext;
import ug.ac.mak.der.analytics.expression.Evaluator;
import ug.ac.mak.der.analytics.expression.Parser;

/**
 * Batch ingestion for the two built-in event-/enrollment-count
 * metrics seeded by {@link AnalyticsSeed}.
 *
 * <p>Spec §15 Phase 2 scope: "event count, enrollment count, stable-
 * tally states". Phase 2 ships this as a batch job (operator /
 * admin-triggered) rather than a streaming journal consumer so the
 * materialization path can be exercised end-to-end before the
 * journal plumbing lands. Phase 2b will wire this to the operation
 * journal's change stream.</p>
 *
 * <p>Ingestion strategy:</p>
 * <ol>
 *   <li>For each source row (event / enrollment), resolve its
 *       canonical monthly period via {@link
 *       AnalyticsPeriodEnumerator#windowContaining}.</li>
 *   <li>Upsert a count=1 contribution keyed by the source UID +
 *       version — replays are a no-op.</li>
 *   <li>Collect the distinct affected cells and materialise each one
 *       by re-aggregating over the contribution ledger.</li>
 * </ol>
 *
 * <p>Out of scope for Phase 2: soft-deleted source handling requires
 * the source tables to carry a {@code deleted_at} column that the
 * capture surface doesn't yet publish uniformly. The ingestion job
 * filters by status on both event + enrollment so cancelled /
 * skipped records aren't silently counted.</p>
 */
@Service
public class AnalyticsIngestionService {

    private final JdbcTemplate jdbc;
    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsContributionRepository contributions;
    private final AnalyticsMaterializer materializer;
    private final AnalyticsPeriodEnumerator periods;
    private final AnalyticsSeed seed;
    private final ObjectMapper jsonMapper;

    public AnalyticsIngestionService(final JdbcTemplate jdbc,
                                       final AnalyticsEngineRepository engineRepo,
                                       final AnalyticsContributionRepository contributions,
                                       final AnalyticsMaterializer materializer,
                                       final AnalyticsPeriodEnumerator periods,
                                       final AnalyticsSeed seed,
                                       final ObjectMapper jsonMapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.materializer = Objects.requireNonNull(materializer, "materializer");
        this.periods = Objects.requireNonNull(periods, "periods");
        this.seed = Objects.requireNonNull(seed, "seed");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
    }

    public record IngestResult(
            String metricCode,
            long rowsScanned,
            long contributionsWritten,
            long cellsMaterialised) {
    }

    /** Scope for the batch ingestion job. {@code null} values widen
     *  the scan to "every row" in that dimension. */
    public record IngestScope(
            String orgUnitUid,
            String programUid,
            LocalDate fromDate,
            LocalDate toDate) {
    }

    /** Run both built-in metrics against the current source tables.
     *  Returns a per-metric summary suitable for the admin endpoint
     *  response. */
    @Transactional
    public List<IngestResult> ingestBuiltIns(final IngestScope scope) {
        Objects.requireNonNull(scope, "scope");
        final List<IngestResult> out = new ArrayList<>(8);
        seed.definition(AnalyticsSeed.EVENT_COUNT_CODE)
                .ifPresent(d -> out.add(ingestEventCount(d, scope)));
        seed.definition(AnalyticsSeed.ENROLLMENT_COUNT_CODE)
                .ifPresent(d -> out.add(ingestEnrollmentCount(d, scope)));
        // Phase 3c — evaluate every READY operator-authored EVENT-type
        // definition against the same event scan. One pass scans the
        // source table once, then applies every definition per row.
        out.addAll(ingestOperatorEventDefinitions(scope));
        // Phase 4d — ENROLLMENT-type indicators traverse every event
        // under one enrollment and resolve latest-stage values.
        out.addAll(ingestOperatorEnrollmentDefinitions(scope));
        return out;
    }

    /** Scan ENROLLMENT-type operator-authored definitions and
     *  materialise cells by iterating enrollments in scope. One
     *  cross-event {@link EnrollmentExpressionContext} is built per
     *  enrollment; each definition evaluates against it. */
    private List<IngestResult> ingestOperatorEnrollmentDefinitions(
            final IngestScope scope) {
        final List<AnalyticsDefinition> defs = engineRepo
                .listDefinitions("READY", 500).stream()
                .filter(d -> "ENROLLMENT".equals(d.analyticsType()))
                .filter(d -> !AnalyticsSeed.EVENT_COUNT_CODE.equals(d.code())
                          && !AnalyticsSeed.ENROLLMENT_COUNT_CODE.equals(d.code()))
                .toList();
        if (defs.isEmpty()) {
            return List.of();
        }

        record Compiled(AnalyticsDefinition def,
                          ug.ac.mak.der.analytics.expression.Expression ast,
                          ug.ac.mak.der.analytics.expression.Expression filter,
                          List<AnalyticsDimension> dimensions) { }
        final List<Compiled> compiled = new ArrayList<>(defs.size());
        for (final AnalyticsDefinition d : defs) {
            final String row = loadDefinitionBody(d);
            if (row == null) {
                continue;
            }
            final String expr = extractExpressionFromBody(row);
            if (expr == null || expr.isBlank()) {
                continue;
            }
            try {
                final String filterExpr = AnalyticsDefinitionService
                        .parseFilterExpression(jsonMapper, row);
                final var filterAst = filterExpr == null ? null
                        : Parser.parse(filterExpr);
                compiled.add(new Compiled(d, Parser.parse(expr),
                        filterAst,
                        AnalyticsDefinitionService.parseDimensions(
                                jsonMapper, row)));
            } catch (RuntimeException ex) {
                engineRepo.updateSupportState(d.id(), "UNSUPPORTED",
                        "re-compile failed: " + ex.getMessage());
            }
        }
        if (compiled.isEmpty()) {
            return List.of();
        }

        // Fetch enrollments in scope.
        final StringBuilder enSql = new StringBuilder(
                "SELECT enrollment_uid, tei_uid, program_uid, "
              + "       org_unit_uid, enrollment_date, incident_date, "
              + "       status, version "
              + "  FROM der.edge_enrollment WHERE 1 = 1 ");
        final List<Object> enArgs = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            enSql.append(" AND org_unit_uid = ?");
            enArgs.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            enSql.append(" AND program_uid = ?");
            enArgs.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            enSql.append(" AND enrollment_date >= ?");
            enArgs.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            enSql.append(" AND enrollment_date <= ?");
            enArgs.add(java.sql.Date.valueOf(scope.toDate()));
        }

        final Map<java.util.UUID, List<AnalyticsContribution>> batchByMetric
                = new java.util.HashMap<>();
        final Map<java.util.UUID, Set<AnalyticsContributionRepository.CellRef>>
                touchedByMetric = new java.util.HashMap<>();
        final long[] scanned = { 0L };

        jdbc.query(enSql.toString(), (rs, i) -> {
            scanned[0]++;
            final String enrollmentUid = rs.getString("enrollment_uid");
            final java.time.LocalDate enrolledOn =
                    rs.getDate("enrollment_date").toLocalDate();
            final java.sql.Date incidentSql = rs.getDate("incident_date");
            final java.time.LocalDate incidentOn = incidentSql == null
                    ? null : incidentSql.toLocalDate();
            final String orgUnit = rs.getString("org_unit_uid");
            final String teiUid = rs.getString("tei_uid");
            final String programUid = rs.getString("program_uid");
            final String status = rs.getString("status");
            final int srcVersion = rs.getInt("version");

            final EnrollmentExpressionContext.Enrollment en =
                    new EnrollmentExpressionContext.Enrollment(
                            enrollmentUid, programUid, teiUid,
                            orgUnit, enrolledOn, incidentOn, status);

            final List<EnrollmentExpressionContext.EventRow> events =
                    fetchEventsFor(enrollmentUid);
            final ExpressionContext ctx = EnrollmentExpressionContext.of(
                    jsonMapper, en, events);

            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY,
                    enrolledOn).id();

            for (final Compiled c : compiled) {
                final Evaluator ev = new Evaluator(ctx);
                if (c.filter() != null) {
                    try {
                        if (!isTruthy(ev.eval(c.filter()))) {
                            continue;
                        }
                    } catch (Evaluator.EvalException ex) {
                        continue;
                    }
                }
                final Object value;
                try {
                    value = ev.eval(c.ast());
                } catch (Evaluator.EvalException ex) {
                    continue;
                }
                final String dimensionKey = DimensionKey.encode(
                        c.dimensions(), ctx);
                final AnalyticsContribution ctb = contributionFor(
                        c.def(), enrollmentUid, srcVersion, periodKey,
                        orgUnit, dimensionKey, value);
                if (ctb == null) {
                    continue;
                }
                batchByMetric.computeIfAbsent(c.def().id(),
                        k -> new ArrayList<>()).add(ctb);
                touchedByMetric.computeIfAbsent(c.def().id(),
                        k -> new java.util.HashSet<>())
                        .add(new AnalyticsContributionRepository.CellRef(
                                periodKey, orgUnit, dimensionKey));
            }
            return null;
        }, enArgs.toArray());

        final List<IngestResult> out = new ArrayList<>(compiled.size());
        for (final Compiled c : compiled) {
            final List<AnalyticsContribution> rows =
                    batchByMetric.getOrDefault(c.def().id(), List.of());
            final Set<AnalyticsContributionRepository.CellRef> touched =
                    touchedByMetric.getOrDefault(c.def().id(), Set.of());
            out.add(commitBatch(c.def(), rows, touched, scanned[0]));
        }
        return out;
    }

    private List<EnrollmentExpressionContext.EventRow> fetchEventsFor(
            final String enrollmentUid) {
        final List<EnrollmentExpressionContext.EventRow> out =
                new ArrayList<>();
        jdbc.query(
                "SELECT event_uid, program_stage_uid, occurred_date, "
              + "       updated_at, status, data_values::text AS data_values "
              + "  FROM der.edge_tracker_event "
              + " WHERE enrollment_uid = ? "
              + " ORDER BY occurred_date DESC, updated_at DESC",
                (rs, i) -> {
                    out.add(new EnrollmentExpressionContext.EventRow(
                            rs.getString("event_uid"),
                            rs.getString("program_stage_uid"),
                            rs.getDate("occurred_date") == null
                                    ? null
                                    : rs.getDate("occurred_date").toLocalDate(),
                            rs.getTimestamp("updated_at") == null
                                    ? null
                                    : rs.getTimestamp("updated_at").toInstant()
                                            .toString(),
                            rs.getString("status"),
                            rs.getString("data_values")));
                    return null;
                }, enrollmentUid);
        return out;
    }

    /** Evaluate every READY, non-built-in, EVENT-type definition against
     *  the current {@code edge_tracker_event} table in the supplied
     *  scope. Returns one IngestResult per definition. */
    private List<IngestResult> ingestOperatorEventDefinitions(
            final IngestScope scope) {
        final List<AnalyticsDefinition> defs = engineRepo
                .listDefinitions("READY", 500)
                .stream()
                .filter(d -> "EVENT".equals(d.analyticsType()))
                .filter(d -> !AnalyticsSeed.EVENT_COUNT_CODE.equals(d.code())
                          && !AnalyticsSeed.ENROLLMENT_COUNT_CODE.equals(d.code()))
                .toList();
        if (defs.isEmpty()) {
            return List.of();
        }

        // Compile every definition once per batch. A definition whose
        // stored expression no longer parses (e.g. metadata drift)
        // gets a FAILED result + its support_state flipped to
        // UNSUPPORTED so operators see the regression.
        record Compiled(AnalyticsDefinition def,
                          ug.ac.mak.der.analytics.expression.Expression ast,
                          ug.ac.mak.der.analytics.expression.Expression filter,
                          List<AnalyticsDimension> dimensions) { }
        final List<Compiled> compiled = new ArrayList<>(defs.size());
        for (final AnalyticsDefinition d : defs) {
            final String row = loadDefinitionBody(d);
            if (row == null) {
                continue;
            }
            final String expr = extractExpressionFromBody(row);
            if (expr == null || expr.isBlank()) {
                continue;
            }
            try {
                final List<AnalyticsDimension> dims =
                        AnalyticsDefinitionService.parseDimensions(
                                jsonMapper, row);
                final String filterExpr = AnalyticsDefinitionService
                        .parseFilterExpression(jsonMapper, row);
                final ug.ac.mak.der.analytics.expression.Expression filterAst =
                        filterExpr == null ? null : Parser.parse(filterExpr);
                compiled.add(new Compiled(d, Parser.parse(expr),
                        filterAst, dims));
            } catch (RuntimeException ex) {
                engineRepo.updateSupportState(d.id(), "UNSUPPORTED",
                        "re-compile failed: " + ex.getMessage());
            }
        }
        if (compiled.isEmpty()) {
            return List.of();
        }

        // SQL + arg list reused from the built-in event ingest.
        final StringBuilder sql = new StringBuilder(
                "SELECT event_uid, program_stage_uid, org_unit_uid, "
              + "       occurred_date, version, status, "
              + "       data_values::text AS data_values "
              + "  FROM der.edge_tracker_event WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            sql.append(" AND program_uid = ?");
            args.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            sql.append(" AND occurred_date >= ?");
            args.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            sql.append(" AND occurred_date <= ?");
            args.add(java.sql.Date.valueOf(scope.toDate()));
        }

        // One batch per definition. HashMaps hold scanned/written totals
        // so we only need one scan of the source table.
        final Map<java.util.UUID, List<AnalyticsContribution>> batchByMetric
                = new java.util.HashMap<>();
        final Map<java.util.UUID, Set<AnalyticsContributionRepository.CellRef>>
                touchedByMetric = new java.util.HashMap<>();
        final long[] scanned = { 0L };
        jdbc.query(sql.toString(), (rs, i) -> {
            scanned[0]++;
            final java.time.LocalDate occurred =
                    rs.getDate("occurred_date").toLocalDate();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY,
                    occurred).id();
            final String orgUnit = rs.getString("org_unit_uid");
            final String stageUid = rs.getString("program_stage_uid");
            final String status = rs.getString("status");
            final String eventUid = rs.getString("event_uid");
            final int srcVersion = rs.getInt("version");
            final String dvJson = rs.getString("data_values");
            final ExpressionContext ctx = EventExpressionContext.of(
                    jsonMapper, stageUid, dvJson, occurred, orgUnit,
                    status);
            for (final Compiled c : compiled) {
                final Evaluator ev = new Evaluator(ctx);
                // Phase 4c — gate on the filter expression. DHIS2 PI
                // semantics: a false-y filter result means the event
                // doesn't contribute. Null (unresolved reference)
                // is also treated as "not eligible".
                if (c.filter() != null) {
                    try {
                        final Object fv = ev.eval(c.filter());
                        if (!isTruthy(fv)) {
                            continue;
                        }
                    } catch (Evaluator.EvalException ex) {
                        continue;
                    }
                }
                final Object value;
                try {
                    value = ev.eval(c.ast());
                } catch (Evaluator.EvalException ex) {
                    // Per-event evaluation failure doesn't poison the
                    // batch — the operator sees it later via an
                    // UNSUPPORTED flip if it's structural.
                    continue;
                }
                final String dimensionKey = DimensionKey.encode(
                        c.dimensions(), ctx);
                final AnalyticsContribution ctb = contributionFor(
                        c.def(), eventUid, srcVersion, periodKey,
                        orgUnit, dimensionKey, value);
                if (ctb == null) {
                    continue;
                }
                batchByMetric.computeIfAbsent(c.def().id(),
                        k -> new ArrayList<>()).add(ctb);
                touchedByMetric.computeIfAbsent(c.def().id(),
                        k -> new java.util.HashSet<>())
                        .add(new AnalyticsContributionRepository.CellRef(
                                periodKey, orgUnit, dimensionKey));
            }
            return null;
        }, args.toArray());

        final List<IngestResult> out = new ArrayList<>(compiled.size());
        for (final Compiled c : compiled) {
            final List<AnalyticsContribution> rows =
                    batchByMetric.getOrDefault(c.def().id(), List.of());
            final Set<AnalyticsContributionRepository.CellRef> touched =
                    touchedByMetric.getOrDefault(c.def().id(), Set.of());
            out.add(commitBatch(c.def(), rows, touched, scanned[0]));
        }
        return out;
    }

    /** Produce a contribution for one (metric, event) pair based on
     *  the definition's aggregation type + the evaluated value.
     *  Returns null when the source should contribute nothing. */
    private AnalyticsContribution contributionFor(
            final AnalyticsDefinition def,
            final String eventUid, final int srcVersion,
            final String periodKey, final String orgUnit,
            final String dimensionKey,
            final Object value) {
        final String agg = def.aggregationType() == null
                ? "COUNT" : def.aggregationType();
        final java.math.BigDecimal numeric;
        final boolean eligible;
        if ("COUNT".equals(agg) || "COUNT_DISTINCT".equals(agg)
                || "NONE".equals(agg)) {
            // Count aggregations fire once per truthy evaluation.
            eligible = isTruthy(value);
            numeric = eligible ? java.math.BigDecimal.ONE
                    : java.math.BigDecimal.ZERO;
        } else {
            if (value == null) {
                return null;
            }
            final java.math.BigDecimal n = toBigDecimal(value);
            if (n == null) {
                return null;
            }
            numeric = n;
            eligible = true;
        }
        return new AnalyticsContribution(def.id(),
                def.definitionVersion(), eventUid,
                String.valueOf(srcVersion), periodKey, orgUnit,
                dimensionKey == null ? "" : dimensionKey,
                numeric, eligible, "COMMITTED", null, null);
    }

    private static boolean isTruthy(final Object v) {
        if (v == null) {
            return false;
        }
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof java.math.BigDecimal d) {
            return d.signum() != 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0.0;
        }
        return !v.toString().isBlank();
    }

    private static java.math.BigDecimal toBigDecimal(final Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof java.math.BigDecimal d) {
            return d;
        }
        if (v instanceof Number n) {
            return new java.math.BigDecimal(n.toString());
        }
        try {
            return new java.math.BigDecimal(v.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** Load the raw JSONB body for one definition — one DB round
     *  trip per metric per batch. Callers extract expression +
     *  dimensions without re-querying. */
    private String loadDefinitionBody(final AnalyticsDefinition def) {
        try {
            return jdbc.queryForObject(
                    "SELECT definition::text FROM der.analytics_definition "
                  + " WHERE id = ?", String.class, def.id());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String extractExpressionFromBody(final String body) {
        if (body == null) {
            return null;
        }
        try {
            final com.fasterxml.jackson.databind.JsonNode node =
                    jsonMapper.readTree(body);
            final com.fasterxml.jackson.databind.JsonNode exprNode =
                    node.get("expression");
            return exprNode == null ? null : exprNode.asText(null);
        } catch (RuntimeException | java.io.IOException ex) {
            return null;
        }
    }

    private IngestResult ingestEventCount(final AnalyticsDefinition def,
                                            final IngestScope scope) {
        final StringBuilder sql = new StringBuilder(
                "SELECT event_uid, org_unit_uid, occurred_date, "
              + "       version, status "
              + "  FROM der.edge_tracker_event WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            sql.append(" AND program_uid = ?");
            args.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            sql.append(" AND occurred_date >= ?");
            args.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            sql.append(" AND occurred_date <= ?");
            args.add(java.sql.Date.valueOf(scope.toDate()));
        }

        final List<AnalyticsContribution> batch = new ArrayList<>();
        final Set<AnalyticsContributionRepository.CellRef> touched = new HashSet<>();
        final long[] scanned = { 0L };
        jdbc.query(sql.toString(), (rs, i) -> {
            scanned[0]++;
            final String status = rs.getString("status");
            final LocalDate occurred = rs.getDate("occurred_date")
                    .toLocalDate();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY, occurred).id();
            final String orgUnit = rs.getString("org_unit_uid");
            final boolean eligible = !"SKIPPED".equals(status);
            batch.add(new AnalyticsContribution(def.id(),
                    def.definitionVersion(),
                    rs.getString("event_uid"),
                    String.valueOf(rs.getInt("version")),
                    periodKey,
                    orgUnit,
                    "",
                    BigDecimal.ONE,
                    eligible,
                    "COMMITTED",
                    null, null));
            touched.add(new AnalyticsContributionRepository.CellRef(
                    periodKey, orgUnit, ""));
            return null;
        }, args.toArray());

        return commitBatch(def, batch, touched, scanned[0]);
    }

    private IngestResult ingestEnrollmentCount(final AnalyticsDefinition def,
                                                 final IngestScope scope) {
        final StringBuilder sql = new StringBuilder(
                "SELECT enrollment_uid, org_unit_uid, enrollment_date, "
              + "       version, status "
              + "  FROM der.edge_enrollment WHERE 1 = 1 ");
        final List<Object> args = new ArrayList<>();
        if (scope.orgUnitUid() != null && !scope.orgUnitUid().isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(scope.orgUnitUid());
        }
        if (scope.programUid() != null && !scope.programUid().isBlank()) {
            sql.append(" AND program_uid = ?");
            args.add(scope.programUid());
        }
        if (scope.fromDate() != null) {
            sql.append(" AND enrollment_date >= ?");
            args.add(java.sql.Date.valueOf(scope.fromDate()));
        }
        if (scope.toDate() != null) {
            sql.append(" AND enrollment_date <= ?");
            args.add(java.sql.Date.valueOf(scope.toDate()));
        }

        final List<AnalyticsContribution> batch = new ArrayList<>();
        final Set<AnalyticsContributionRepository.CellRef> touched = new HashSet<>();
        final long[] scanned = { 0L };
        jdbc.query(sql.toString(), (rs, i) -> {
            scanned[0]++;
            final String status = rs.getString("status");
            final LocalDate enrolledOn = rs.getDate("enrollment_date")
                    .toLocalDate();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY, enrolledOn).id();
            final String orgUnit = rs.getString("org_unit_uid");
            // CANCELLED enrolments still land as ineligible so the ledger
            // reflects attempted enrolment without inflating counts.
            final boolean eligible = !"CANCELLED".equals(status);
            batch.add(new AnalyticsContribution(def.id(),
                    def.definitionVersion(),
                    rs.getString("enrollment_uid"),
                    String.valueOf(rs.getInt("version")),
                    periodKey, orgUnit, "",
                    BigDecimal.ONE, eligible, "COMMITTED",
                    null, null));
            touched.add(new AnalyticsContributionRepository.CellRef(
                    periodKey, orgUnit, ""));
            return null;
        }, args.toArray());

        return commitBatch(def, batch, touched, scanned[0]);
    }

    private IngestResult commitBatch(final AnalyticsDefinition def,
                                       final List<AnalyticsContribution> batch,
                                       final Set<AnalyticsContributionRepository.CellRef> touched,
                                       final long scanned) {
        int[] updates = new int[0];
        if (!batch.isEmpty()) {
            updates = contributions.upsertBatch(batch);
        }
        long cells = 0;
        for (final AnalyticsContributionRepository.CellRef ref : touched) {
            materializer.materializeCell(def, ref.periodKey(),
                    ref.orgUnitUid(), ref.dimensionKey());
            cells++;
        }
        return new IngestResult(def.code(), scanned, updates.length, cells);
    }

    /** Clear the Phase-2 contribution ledger + materialised cells for
     *  the built-in metrics. Admin-only — used before a fresh
     *  re-ingest when operators want a known-clean baseline. */
    @Transactional
    public Map<String, Integer> resetBuiltIns() {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final String code : List.of(
                AnalyticsSeed.EVENT_COUNT_CODE,
                AnalyticsSeed.ENROLLMENT_COUNT_CODE)) {
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinitionByCode(code);
            if (defOpt.isEmpty()) {
                out.put(code, 0);
                continue;
            }
            final AnalyticsDefinition def = defOpt.get();
            final int contribs = jdbc.update(
                    "DELETE FROM der.analytics_contribution "
                  + " WHERE metric_id = ? AND definition_version = ?",
                    def.id(), def.definitionVersion());
            jdbc.update(
                    "DELETE FROM der.analytics_cell "
                  + " WHERE metric_id = ? AND definition_version = ?",
                    def.id(), def.definitionVersion());
            out.put(code, contribs);
        }
        return out;
    }
}
