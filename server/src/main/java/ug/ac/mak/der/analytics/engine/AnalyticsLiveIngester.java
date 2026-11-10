package ug.ac.mak.der.analytics.engine;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import ug.ac.mak.der.analytics.expression.Evaluator;
import ug.ac.mak.der.analytics.expression.ExpressionContext;
import ug.ac.mak.der.analytics.expression.Parser;

/**
 * Journal-stream consumer that materialises analytics cells in real
 * time as tracker events + enrollments commit.
 *
 * <p>Spec §15 Phase 2b — moves the ingestion path from the operator-
 * triggered batch job into the write path itself. The listener runs
 * {@code AFTER_COMMIT} so a rolled-back source write never reaches
 * the analytics ledger, and {@code Async} so the capture latency
 * stays independent of analytics work.</p>
 *
 * <p>Failure handling: every applied contribution is wrapped so an
 * analytics-side error logs + advances the lag counter but never
 * propagates back to the capture caller. Phase 3 wires this to a
 * dead-letter queue for retry.</p>
 */
@Component
public class AnalyticsLiveIngester {

    private static final Logger LOG =
            LoggerFactory.getLogger(AnalyticsLiveIngester.class);

    private final AnalyticsEngineRepository engineRepo;
    private final AnalyticsMaterializer materializer;
    private final AnalyticsPeriodEnumerator periods;
    private final JdbcTemplate jdbc;
    private final ObjectMapper jsonMapper;

    // Cheap in-memory counters for the /quality + /admin/jobs
    // endpoints so operators see live ingestion health without
    // peering into logs.
    private final AtomicLong applied = new AtomicLong();
    private final AtomicLong skipped = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final ConcurrentHashMap<AnalyticsSourceEvent.SourceType, Long>
            lastAppliedAt = new ConcurrentHashMap<>();

    public AnalyticsLiveIngester(final AnalyticsEngineRepository engineRepo,
                                   final AnalyticsMaterializer materializer,
                                   final AnalyticsPeriodEnumerator periods,
                                   final JdbcTemplate jdbc,
                                   final ObjectMapper jsonMapper) {
        this.engineRepo = engineRepo;
        this.materializer = materializer;
        this.periods = periods;
        this.jdbc = jdbc;
        this.jsonMapper = jsonMapper;
    }

    /** Transactional listener — runs after the capture transaction
     *  commits, so a rolled-back source never produces an analytics
     *  contribution. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT,
                                 fallbackExecution = true)
    public void onCommittedSourceChange(final AnalyticsSourceEvent event) {
        handle(event);
    }

    /** Synchronous handler — exposed for tests and for environments
     *  where the Spring transaction manager hasn't been configured.
     *  The transactional listener delegates here too. */
    void handle(final AnalyticsSourceEvent event) {
        try {
            final String code = codeFor(event.sourceType());
            final Optional<AnalyticsDefinition> defOpt =
                    engineRepo.findDefinitionByCode(code);
            if (defOpt.isEmpty()) {
                // Seed hasn't run yet (test boot, fresh DB). Not an
                // error — the operator-triggered ingest on next admin
                // POST will backfill.
                skipped.incrementAndGet();
                return;
            }
            final AnalyticsDefinition def = defOpt.get();
            final String periodKey = periods.windowContaining(
                    AnalyticsPeriodEnumerator.Type.MONTHLY,
                    event.occurredOn()).id();
            final boolean eligible = isEligible(event);
            final AnalyticsContribution contribution =
                    new AnalyticsContribution(def.id(),
                            def.definitionVersion(),
                            event.sourceKey(),
                            String.valueOf(event.sourceVersion()),
                            periodKey,
                            event.orgUnitUid(),
                            "",
                            BigDecimal.ONE,
                            eligible,
                            "COMMITTED",
                            null, null);
            materializer.applyContribution(def, contribution);
            applied.incrementAndGet();
            lastAppliedAt.put(event.sourceType(), System.currentTimeMillis());
            // Phase 3c — also evaluate every operator-authored READY
            // EVENT-type definition. Fetches data_values once per
            // event write; soft-fails per definition.
            if (event.sourceType() == AnalyticsSourceEvent.SourceType.EVENT) {
                applyOperatorDefinitions(event, periodKey);
            }
            // Phase 4d — ENROLLMENT-type indicators depend on cross-
            // event state. An EVENT write may change the latest-stage
            // value that an enrollment-grain expression references;
            // re-evaluate the parent enrollment's ENROLLMENT metrics
            // if any are READY. ENROLLMENT writes trigger the same
            // path directly.
            applyEnrollmentOperatorDefinitions(event);
        } catch (RuntimeException ex) {
            failed.incrementAndGet();
            LOG.warn("analytics live ingest failed for {} {} v{}: {}",
                    event.sourceType(), event.sourceKey(),
                    event.sourceVersion(), ex.getMessage());
        }
    }

    /** Evaluate every READY operator-authored EVENT-type definition
     *  against a single event. Called from the hot path so soft-
     *  failures only bump the per-metric failure counter, never
     *  propagate. */
    private void applyOperatorDefinitions(
            final AnalyticsSourceEvent event, final String periodKey) {
        if (jdbc == null || jsonMapper == null) {
            return; // Test contexts may omit these.
        }
        final List<AnalyticsDefinition> defs = engineRepo
                .listDefinitions("READY", 500).stream()
                .filter(d -> "EVENT".equals(d.analyticsType()))
                .filter(d -> !AnalyticsSeed.EVENT_COUNT_CODE.equals(d.code())
                          && !AnalyticsSeed.ENROLLMENT_COUNT_CODE.equals(d.code()))
                .toList();
        if (defs.isEmpty()) {
            return;
        }
        final String dvRow = loadEventPayload(event.sourceKey());
        if (dvRow == null) {
            return; // Event already moved / deleted; nothing to do.
        }
        final String[] parts = dvRow.split("\\|", 2);
        final String stageUid = parts.length > 1 ? parts[0] : null;
        final String dvJson = parts.length > 1 ? parts[1] : parts[0];
        final ExpressionContext ctx = EventExpressionContext.of(jsonMapper,
                stageUid, dvJson, event.occurredOn(),
                event.orgUnitUid(), event.status());
        for (final AnalyticsDefinition def : defs) {
            final String body = loadDefinitionBody(def);
            final String expr = extractExpressionFromBody(body);
            if (expr == null || expr.isBlank()) {
                continue;
            }
            try {
                // Phase 4c — evaluate filter (if any) first; skip if
                // false/null.
                final String filterExpr = AnalyticsDefinitionService
                        .parseFilterExpression(jsonMapper, body);
                final Evaluator ev = new Evaluator(ctx);
                if (filterExpr != null && !filterExpr.isBlank()) {
                    final Object fv = ev.eval(Parser.parse(filterExpr));
                    if (!isTruthy(fv)) {
                        continue;
                    }
                }
                final Object value = ev.eval(Parser.parse(expr));
                final List<AnalyticsDimension> dims =
                        AnalyticsDefinitionService.parseDimensions(
                                jsonMapper, body);
                final String dimensionKey = DimensionKey.encode(dims, ctx);
                final AnalyticsContribution c = contributionFor(def,
                        event.sourceKey(), event.sourceVersion(),
                        periodKey, event.orgUnitUid(),
                        dimensionKey, value);
                if (c != null) {
                    materializer.applyContribution(def, c);
                }
            } catch (RuntimeException ex) {
                failed.incrementAndGet();
                LOG.warn("operator-defined metric {} failed on {} v{}: {}",
                        def.code(), event.sourceKey(),
                        event.sourceVersion(), ex.getMessage());
            }
        }
    }

    private String loadEventPayload(final String eventUid) {
        try {
            return jdbc.queryForObject(
                    "SELECT program_stage_uid || '|' || "
                  + "       data_values::text "
                  + "  FROM der.edge_tracker_event "
                  + " WHERE event_uid = ?",
                    String.class, eventUid);
        } catch (EmptyResultDataAccessException ex) {
            return null;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    /** Phase 4d — evaluate every READY ENROLLMENT-type definition
     *  against the enrollment implicated by this source change.
     *  For EVENT source: find the parent enrollment UID; for
     *  ENROLLMENT: it's the source key itself. */
    private void applyEnrollmentOperatorDefinitions(
            final AnalyticsSourceEvent event) {
        if (jdbc == null || jsonMapper == null) {
            return;
        }
        final List<AnalyticsDefinition> defs = engineRepo
                .listDefinitions("READY", 500).stream()
                .filter(d -> "ENROLLMENT".equals(d.analyticsType()))
                .filter(d -> !AnalyticsSeed.EVENT_COUNT_CODE.equals(d.code())
                          && !AnalyticsSeed.ENROLLMENT_COUNT_CODE.equals(d.code()))
                .toList();
        if (defs.isEmpty()) {
            return;
        }
        final String enrollmentUid = resolveEnrollmentFor(event);
        if (enrollmentUid == null) {
            return;
        }
        final EnrollmentExpressionContext.Enrollment enRow =
                loadEnrollment(enrollmentUid);
        if (enRow == null) {
            return;
        }
        final List<EnrollmentExpressionContext.EventRow> events =
                loadEnrollmentEvents(enrollmentUid);
        final ExpressionContext ctx = EnrollmentExpressionContext.of(
                jsonMapper, enRow, events);
        final String periodKey = periods.windowContaining(
                AnalyticsPeriodEnumerator.Type.MONTHLY,
                enRow.enrollmentDate() == null
                        ? java.time.LocalDate.now()
                        : enRow.enrollmentDate()).id();

        for (final AnalyticsDefinition def : defs) {
            final String body = loadDefinitionBody(def);
            final String expr = extractExpressionFromBody(body);
            if (expr == null || expr.isBlank()) {
                continue;
            }
            try {
                final Evaluator ev = new Evaluator(ctx);
                final String filterExpr = AnalyticsDefinitionService
                        .parseFilterExpression(jsonMapper, body);
                if (filterExpr != null && !filterExpr.isBlank()) {
                    final Object fv = ev.eval(Parser.parse(filterExpr));
                    if (!isTruthy(fv)) {
                        continue;
                    }
                }
                final Object value = ev.eval(Parser.parse(expr));
                final List<AnalyticsDimension> dims =
                        AnalyticsDefinitionService.parseDimensions(
                                jsonMapper, body);
                final String dimensionKey = DimensionKey.encode(dims, ctx);
                final int version = enRow.enrollmentDate() == null
                        ? 1 : enRow.enrollmentDate().hashCode();
                final AnalyticsContribution c = contributionFor(def,
                        enrollmentUid, version, periodKey,
                        enRow.orgUnitUid() == null
                                ? event.orgUnitUid() : enRow.orgUnitUid(),
                        dimensionKey, value);
                if (c != null) {
                    materializer.applyContribution(def, c);
                }
            } catch (RuntimeException ex) {
                failed.incrementAndGet();
                LOG.warn("enrollment metric {} failed on enrollment {}: {}",
                        def.code(), enrollmentUid, ex.getMessage());
            }
        }
    }

    private String resolveEnrollmentFor(final AnalyticsSourceEvent event) {
        if (event.sourceType() == AnalyticsSourceEvent.SourceType.ENROLLMENT) {
            return event.sourceKey();
        }
        try {
            return jdbc.queryForObject(
                    "SELECT enrollment_uid FROM der.edge_tracker_event "
                  + " WHERE event_uid = ?", String.class,
                    event.sourceKey());
        } catch (EmptyResultDataAccessException ex) {
            return null;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private EnrollmentExpressionContext.Enrollment loadEnrollment(
            final String enrollmentUid) {
        try {
            return jdbc.queryForObject(
                    "SELECT enrollment_uid, tei_uid, program_uid, "
                  + "       org_unit_uid, enrollment_date, "
                  + "       incident_date, status "
                  + "  FROM der.edge_enrollment WHERE enrollment_uid = ?",
                    (rs, i) -> new EnrollmentExpressionContext.Enrollment(
                            rs.getString("enrollment_uid"),
                            rs.getString("program_uid"),
                            rs.getString("tei_uid"),
                            rs.getString("org_unit_uid"),
                            rs.getDate("enrollment_date") == null
                                    ? null
                                    : rs.getDate("enrollment_date").toLocalDate(),
                            rs.getDate("incident_date") == null
                                    ? null
                                    : rs.getDate("incident_date").toLocalDate(),
                            rs.getString("status")),
                    enrollmentUid);
        } catch (EmptyResultDataAccessException ex) {
            return null;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private List<EnrollmentExpressionContext.EventRow> loadEnrollmentEvents(
            final String enrollmentUid) {
        final List<EnrollmentExpressionContext.EventRow> out =
                new java.util.ArrayList<>();
        try {
            jdbc.query(
                    "SELECT event_uid, program_stage_uid, occurred_date, "
                  + "       updated_at, status, "
                  + "       data_values::text AS data_values "
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
                                        : rs.getTimestamp("updated_at").toInstant().toString(),
                                rs.getString("status"),
                                rs.getString("data_values")));
                        return null;
                    }, enrollmentUid);
        } catch (RuntimeException ex) {
            // tolerate — return whatever we accumulated
        }
        return out;
    }

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
            final com.fasterxml.jackson.databind.JsonNode e =
                    node.get("expression");
            return e == null ? null : e.asText(null);
        } catch (RuntimeException | java.io.IOException ex) {
            return null;
        }
    }

    private static AnalyticsContribution contributionFor(
            final AnalyticsDefinition def, final String key,
            final int version, final String periodKey,
            final String orgUnit, final String dimensionKey,
            final Object value) {
        final String agg = def.aggregationType() == null
                ? "COUNT" : def.aggregationType();
        final BigDecimal numeric;
        final boolean eligible;
        if ("COUNT".equals(agg) || "COUNT_DISTINCT".equals(agg)
                || "NONE".equals(agg)) {
            eligible = isTruthy(value);
            numeric = eligible ? BigDecimal.ONE : BigDecimal.ZERO;
        } else {
            if (value == null) {
                return null;
            }
            final BigDecimal n = toBigDecimal(value);
            if (n == null) {
                return null;
            }
            numeric = n;
            eligible = true;
        }
        return new AnalyticsContribution(def.id(), def.definitionVersion(),
                key, String.valueOf(version), periodKey, orgUnit,
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
        if (v instanceof BigDecimal d) {
            return d.signum() != 0;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0.0;
        }
        return !v.toString().isBlank();
    }

    private static BigDecimal toBigDecimal(final Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof BigDecimal d) {
            return d;
        }
        if (v instanceof Number n) {
            return new BigDecimal(n.toString());
        }
        try {
            return new BigDecimal(v.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String codeFor(final AnalyticsSourceEvent.SourceType t) {
        return switch (t) {
            case EVENT -> AnalyticsSeed.EVENT_COUNT_CODE;
            case ENROLLMENT -> AnalyticsSeed.ENROLLMENT_COUNT_CODE;
        };
    }

    private static boolean isEligible(final AnalyticsSourceEvent e) {
        return switch (e.sourceType()) {
            // Skip SKIPPED events — the operator explicitly declared
            // the stage didn't happen; counting it would be wrong.
            case EVENT -> !"SKIPPED".equalsIgnoreCase(e.status());
            // Cancelled enrolments shouldn't pad the count either.
            case ENROLLMENT -> !"CANCELLED".equalsIgnoreCase(e.status());
        };
    }

    /** Snapshot of the live counters for the /quality + /admin/jobs
     *  endpoints. */
    public LiveStats stats() {
        return new LiveStats(
                applied.get(), skipped.get(), failed.get(),
                lastAppliedAt.getOrDefault(
                        AnalyticsSourceEvent.SourceType.EVENT, 0L),
                lastAppliedAt.getOrDefault(
                        AnalyticsSourceEvent.SourceType.ENROLLMENT, 0L));
    }

    public record LiveStats(long applied, long skipped, long failed,
                              long lastEventAppliedAt,
                              long lastEnrollmentAppliedAt) { }
}
