package ug.ac.mak.der.analytics.drilldown;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.security.EdgeRole;

/**
 * Spec §11 drilldown + privacy contract. Takes a cell identifier
 * (metric, period, orgUnit, dimensionKey) and returns the authorised
 * list of source records (events / enrollments) that contributed to
 * it. The service:
 *
 * <ol>
 *   <li>Rechecks role-based authorisation per call. Aggregate viewers
 *       (OPERATOR without the drilldown role) get a 403; only ADMIN
 *       / REVIEWER can open contributing rows.</li>
 *   <li>Enforces the small-cell suppression threshold from
 *       {@code der.analytics.min-cell-size}. Suppressed cells return
 *       {@code suppressed = true} + zero rows, never identities.</li>
 *   <li>Applies PHI masking by default — the TEI UID is replaced by a
 *       stable hash so the UI can render a pseudonym while the
 *       authoritative identity stays off the wire.</li>
 *   <li>Writes one {@code analytics_drilldown_audit} row <em>before</em>
 *       returning results so an aborted response still leaves a
 *       trail (AN-FR-050 / AN-FR-051).</li>
 * </ol>
 */
@Service
public class AnalyticsDrilldownService {

    private final AnalyticsEngineRepository engineRepo;
    private final JdbcTemplate jdbc;
    private final AnalyticsDrilldownAuditRepository audit;

    @Value("${der.analytics.min-cell-size:0}")
    private int minCellSize;

    public AnalyticsDrilldownService(final AnalyticsEngineRepository engineRepo,
                                       final JdbcTemplate jdbc,
                                       final AnalyticsDrilldownAuditRepository audit) {
        this.engineRepo = Objects.requireNonNull(engineRepo, "engineRepo");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.audit = Objects.requireNonNull(audit, "audit");
    }

    public record Caller(UUID userId, EdgeRole role, String clientIp) { }

    public record Request(UUID metricId, String periodKey,
                            String orgUnitUid, String dimensionKey,
                            String purpose, int limit) { }

    public record SourceRow(String sourceKey, String sourceType,
                              LocalDate occurredOn, String status,
                              String orgUnitUid, String stageUid,
                              String maskedSubjectId) { }

    public record Result(UUID auditId, DrilldownOutcome outcome,
                           boolean suppressed, int rowCount,
                           List<SourceRow> rows, String reason) { }

    public enum DrilldownOutcome {
        OK, SUPPRESSED, UNAUTHORISED, METRIC_NOT_FOUND,
        CELL_NOT_FOUND
    }

    @Transactional
    public Result drilldown(final Caller caller, final Request req) {
        Objects.requireNonNull(caller, "caller");
        Objects.requireNonNull(req, "request");

        // §11 — authorisation is rechecked by the server on every
        // drilldown page and export request. Only ADMIN / REVIEWER
        // may see contributing source rows. OPERATORs can see
        // aggregate numbers (via /query) but not patient lineage.
        if (caller.role() != EdgeRole.ADMIN
                && caller.role() != EdgeRole.REVIEWER) {
            final UUID auditId = writeAudit(caller, req, 0, false,
                    "role " + caller.role() + " not permitted");
            return new Result(auditId, DrilldownOutcome.UNAUTHORISED,
                    false, 0, List.of(),
                    "drilldown requires ADMIN or REVIEWER");
        }

        final Optional<AnalyticsDefinition> defOpt =
                engineRepo.findDefinition(req.metricId());
        if (defOpt.isEmpty()) {
            final UUID auditId = writeAudit(caller, req, 0, false,
                    "metric not found");
            return new Result(auditId, DrilldownOutcome.METRIC_NOT_FOUND,
                    false, 0, List.of(), "unknown metric");
        }
        final AnalyticsDefinition def = defOpt.get();
        final String dim = req.dimensionKey() == null ? ""
                : req.dimensionKey();

        // Locate the cell + its count so we can honour the
        // small-cell threshold without a second query per source row.
        final Optional<AnalyticsCell> cellOpt = engineRepo.findCell(
                def.id(), def.definitionVersion(),
                req.periodKey(), req.orgUnitUid(), dim);
        if (cellOpt.isEmpty()) {
            final UUID auditId = writeAudit(caller, req, 0, false,
                    "cell not found");
            return new Result(auditId, DrilldownOutcome.CELL_NOT_FOUND,
                    false, 0, List.of(), "cell not materialised");
        }
        final AnalyticsCell cell = cellOpt.get();
        final boolean suppress = minCellSize > 0
                && cell.countValue() != null
                && cell.countValue() < minCellSize;
        if (suppress) {
            final UUID auditId = writeAudit(caller, req, 0, true,
                    "below min-cell-size " + minCellSize);
            return new Result(auditId, DrilldownOutcome.SUPPRESSED,
                    true, 0, List.of(),
                    "cell suppressed by small-cell threshold");
        }

        final List<SourceRow> rows = loadSources(def, req);
        final UUID auditId = writeAudit(caller, req, rows.size(), false,
                req.purpose());
        return new Result(auditId, DrilldownOutcome.OK, false,
                rows.size(), rows, null);
    }

    private List<SourceRow> loadSources(final AnalyticsDefinition def,
                                          final Request req) {
        final String dim = req.dimensionKey() == null ? ""
                : req.dimensionKey();
        final int limit = Math.max(1, Math.min(500,
                req.limit() == 0 ? 100 : req.limit()));
        return switch (def.analyticsType() == null
                ? "EVENT" : def.analyticsType()) {
            case "ENROLLMENT" -> loadEnrollmentSources(def, req, dim, limit);
            default -> loadEventSources(def, req, dim, limit);
        };
    }

    private List<SourceRow> loadEventSources(final AnalyticsDefinition def,
                                               final Request req,
                                               final String dim,
                                               final int limit) {
        return jdbc.query(
                "SELECT c.source_key, e.occurred_date, e.status, "
              + "       e.org_unit_uid, e.program_stage_uid, "
              + "       en.tei_uid "
              + "  FROM der.analytics_contribution c "
              + "  JOIN der.edge_tracker_event e "
              + "    ON e.event_uid = c.source_key "
              + "  LEFT JOIN der.edge_enrollment en "
              + "    ON en.enrollment_uid = e.enrollment_uid "
              + " WHERE c.metric_id = ? AND c.definition_version = ? "
              + "   AND c.period_key = ? AND c.org_unit_uid = ? "
              + "   AND c.dimension_key = ? AND c.eligibility = TRUE "
              + "   AND c.source_state = 'COMMITTED' "
              + " ORDER BY e.occurred_date DESC, e.updated_at DESC "
              + " LIMIT ?",
                (rs, i) -> new SourceRow(
                        rs.getString("source_key"), "EVENT",
                        rs.getDate("occurred_date") == null ? null
                                : rs.getDate("occurred_date").toLocalDate(),
                        rs.getString("status"),
                        rs.getString("org_unit_uid"),
                        rs.getString("program_stage_uid"),
                        mask(rs.getString("tei_uid"))),
                def.id(), def.definitionVersion(),
                req.periodKey(), req.orgUnitUid(), dim, limit);
    }

    private List<SourceRow> loadEnrollmentSources(final AnalyticsDefinition def,
                                                    final Request req,
                                                    final String dim,
                                                    final int limit) {
        return jdbc.query(
                "SELECT c.source_key, en.enrollment_date, en.status, "
              + "       en.org_unit_uid, en.tei_uid "
              + "  FROM der.analytics_contribution c "
              + "  JOIN der.edge_enrollment en "
              + "    ON en.enrollment_uid = c.source_key "
              + " WHERE c.metric_id = ? AND c.definition_version = ? "
              + "   AND c.period_key = ? AND c.org_unit_uid = ? "
              + "   AND c.dimension_key = ? AND c.eligibility = TRUE "
              + "   AND c.source_state = 'COMMITTED' "
              + " ORDER BY en.enrollment_date DESC, en.updated_at DESC "
              + " LIMIT ?",
                (rs, i) -> new SourceRow(
                        rs.getString("source_key"), "ENROLLMENT",
                        rs.getDate("enrollment_date") == null ? null
                                : rs.getDate("enrollment_date").toLocalDate(),
                        rs.getString("status"),
                        rs.getString("org_unit_uid"), null,
                        mask(rs.getString("tei_uid"))),
                def.id(), def.definitionVersion(),
                req.periodKey(), req.orgUnitUid(), dim, limit);
    }

    /** PHI masking by default (§11). Replace the real TEI UID with a
     *  stable short hash so the UI can render a pseudonym while the
     *  authoritative identity stays off the wire. A separate
     *  "reveal identity" action (not yet shipped) would re-authorise
     *  then look up the real UID. */
    static String mask(final String teiUid) {
        if (teiUid == null || teiUid.isBlank()) {
            return null;
        }
        final int h = teiUid.hashCode();
        final String hex = Integer.toHexString(h & 0x00FFFFFF);
        return "pt-" + ("00000" + hex).substring(hex.length());
    }

    private UUID writeAudit(final Caller caller, final Request req,
                               final int rowCount, final boolean suppressed,
                               final String purpose) {
        final AnalyticsDrilldownAuditRepository.AnalyticsDrilldownAudit a =
                new AnalyticsDrilldownAuditRepository.AnalyticsDrilldownAudit(
                        UUID.randomUUID(), caller.userId(),
                        caller.role() == null ? "UNKNOWN"
                                : caller.role().name(),
                        req.metricId(), 1,
                        req.periodKey(), req.orgUnitUid(),
                        req.dimensionKey() == null ? ""
                                : req.dimensionKey(),
                        rowCount, suppressed,
                        purpose, caller.clientIp(), Instant.now());
        return audit.insert(a);
    }

    /** JSON-friendly projection helper for the controller. */
    public static Map<String, Object> asMap(final Result r) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("auditId", r.auditId() == null ? null
                : r.auditId().toString());
        out.put("outcome", r.outcome().name());
        out.put("suppressed", r.suppressed());
        out.put("rowCount", r.rowCount());
        if (r.reason() != null) {
            out.put("reason", r.reason());
        }
        final List<Map<String, Object>> rows = new ArrayList<>(r.rows().size());
        for (final SourceRow s : r.rows()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("sourceKey", s.sourceKey());
            m.put("sourceType", s.sourceType());
            m.put("occurredOn", s.occurredOn() == null ? null
                    : s.occurredOn().toString());
            m.put("status", s.status());
            m.put("orgUnitUid", s.orgUnitUid());
            m.put("stageUid", s.stageUid());
            m.put("maskedSubjectId", s.maskedSubjectId());
            rows.add(m);
        }
        out.put("rows", rows);
        return out;
    }
}
