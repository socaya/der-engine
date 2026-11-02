package ug.ac.mak.der.orgunit;

import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * §2.3.115 R-AL — scope audit.
 *
 * <p>Enumerates every locally-stored row whose {@code org_unit_uid}
 * sits outside the current edge's bound OU subtree. The admin UI
 * uses this to show operators where data has drifted away from the
 * current binding — typically after a rebind, after a referral
 * ingested before the current binding was set, or after a smoke
 * script bypassed the normal capture path.</p>
 *
 * <p>Scope membership follows the DHIS2 metadata-mirror path:
 * {@code /root/region/district/facility}. Any row whose OU path
 * starts with the bound-OU path is considered in-scope.</p>
 */
@Service
@ConditionalOnBean(OrgUnitBindingService.class)
public class ScopeAuditService {

    private final OrgUnitBindingService binding;
    private final JdbcTemplate jdbc;

    public ScopeAuditService(final OrgUnitBindingService binding,
                               final JdbcTemplate jdbc) {
        this.binding = Objects.requireNonNull(binding, "binding");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** Snapshot of out-of-scope rows across the five journaled data
     *  tables. Caller controls whether per-row samples are included
     *  (useful for the admin UI, expensive for ops jobs). */
    public Snapshot audit(final int sampleLimit) {
        final EdgeOrgUnitBinding b = binding.current();
        if (!b.isBound()) {
            return new Snapshot(null, null, Map.of(), Map.of());
        }
        final String boundPath = b.orgUnitPath();
        final String boundId   = b.orgUnitId();

        final Map<String, Integer>              counts  = new LinkedHashMap<>();
        final Map<String, List<Map<String, Object>>> samples = new LinkedHashMap<>();

        // Each entry: (label, SQL, mapper). Mapper produces a sample
        // object; count query is derived by swapping SELECT body.
        tallyAndSample("AGGREGATE_DATA_VALUE",
                "SELECT av.value_id, av.data_element_uid, av.org_unit_uid, av.period_iso, "
              + "       av.submitted_at, mou.display_name AS ou_name "
              + "FROM der.aggregate_data_value av "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = av.org_unit_uid "
              + "WHERE NOT EXISTS ("
              + "   SELECT 1 FROM der.metadata_organisation_unit p "
              + "    WHERE p.dhis2_uid = av.org_unit_uid "
              + "      AND p.path LIKE ?)",
                boundPath + '%',
                (ResultSet rs) -> Map.<String, Object>of(
                        "entityRef",   rs.getString("value_id"),
                        "dataElement", rs.getString("data_element_uid"),
                        "orgUnit",     rs.getString("org_unit_uid"),
                        "orgUnitName", nullable(rs.getString("ou_name")),
                        "period",      rs.getString("period_iso"),
                        "submittedAt", rs.getTimestamp("submitted_at") == null ? ""
                                        : rs.getTimestamp("submitted_at").toInstant().toString()),
                sampleLimit, counts, samples);
        tallyAndSample("EVENT",
                "SELECT ev.event_id, ev.program_uid, ev.org_unit_uid, "
              + "       ev.occurred_at, mou.display_name AS ou_name "
              + "FROM der.event ev "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = ev.org_unit_uid "
              + "WHERE NOT EXISTS ("
              + "   SELECT 1 FROM der.metadata_organisation_unit p "
              + "    WHERE p.dhis2_uid = ev.org_unit_uid "
              + "      AND p.path LIKE ?)",
                boundPath + '%',
                (ResultSet rs) -> Map.<String, Object>of(
                        "entityRef",   rs.getString("event_id"),
                        "program",     rs.getString("program_uid"),
                        "orgUnit",     rs.getString("org_unit_uid"),
                        "orgUnitName", nullable(rs.getString("ou_name")),
                        "occurredAt",  rs.getTimestamp("occurred_at") == null ? ""
                                        : rs.getTimestamp("occurred_at").toInstant().toString()),
                sampleLimit, counts, samples);
        tallyAndSample("TRACKED_ENTITY",
                "SELECT te.tei_uid, te.tracked_entity_type, te.org_unit_uid, "
              + "       te.updated_at, mou.display_name AS ou_name "
              + "FROM der.tracked_entity te "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = te.org_unit_uid "
              + "WHERE NOT EXISTS ("
              + "   SELECT 1 FROM der.metadata_organisation_unit p "
              + "    WHERE p.dhis2_uid = te.org_unit_uid "
              + "      AND p.path LIKE ?)",
                boundPath + '%',
                (ResultSet rs) -> Map.<String, Object>of(
                        "entityRef",   rs.getString("tei_uid"),
                        "teType",      rs.getString("tracked_entity_type"),
                        "orgUnit",     rs.getString("org_unit_uid"),
                        "orgUnitName", nullable(rs.getString("ou_name")),
                        "updatedAt",   rs.getTimestamp("updated_at") == null ? ""
                                        : rs.getTimestamp("updated_at").toInstant().toString()),
                sampleLimit, counts, samples);
        tallyAndSample("ENROLLMENT",
                "SELECT en.enrollment_uid, en.program_uid, en.org_unit_uid, "
              + "       en.updated_at, mou.display_name AS ou_name "
              + "FROM der.edge_enrollment en "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = en.org_unit_uid "
              + "WHERE NOT EXISTS ("
              + "   SELECT 1 FROM der.metadata_organisation_unit p "
              + "    WHERE p.dhis2_uid = en.org_unit_uid "
              + "      AND p.path LIKE ?)",
                boundPath + '%',
                (ResultSet rs) -> Map.<String, Object>of(
                        "entityRef",   rs.getString("enrollment_uid"),
                        "program",     rs.getString("program_uid"),
                        "orgUnit",     rs.getString("org_unit_uid"),
                        "orgUnitName", nullable(rs.getString("ou_name")),
                        "updatedAt",   rs.getTimestamp("updated_at") == null ? ""
                                        : rs.getTimestamp("updated_at").toInstant().toString()),
                sampleLimit, counts, samples);
        tallyAndSample("PROGRAM_STAGE_EVENT",
                "SELECT ev.event_uid, ev.program_uid, ev.program_stage_uid, "
              + "       ev.org_unit_uid, ev.updated_at, mou.display_name AS ou_name "
              + "FROM der.edge_tracker_event ev "
              + "LEFT JOIN der.metadata_organisation_unit mou "
              + "       ON mou.dhis2_uid = ev.org_unit_uid "
              + "WHERE NOT EXISTS ("
              + "   SELECT 1 FROM der.metadata_organisation_unit p "
              + "    WHERE p.dhis2_uid = ev.org_unit_uid "
              + "      AND p.path LIKE ?)",
                boundPath + '%',
                (ResultSet rs) -> Map.<String, Object>of(
                        "entityRef",    rs.getString("event_uid"),
                        "program",      rs.getString("program_uid"),
                        "programStage", rs.getString("program_stage_uid"),
                        "orgUnit",      rs.getString("org_unit_uid"),
                        "orgUnitName",  nullable(rs.getString("ou_name")),
                        "updatedAt",    rs.getTimestamp("updated_at") == null ? ""
                                         : rs.getTimestamp("updated_at").toInstant().toString()),
                sampleLimit, counts, samples);
        return new Snapshot(boundId, boundPath, counts, samples);
    }

    private void tallyAndSample(final String label,
                                  final String sampleSql,
                                  final String boundPathLike,
                                  final RsMapper mapper,
                                  final int sampleLimit,
                                  final Map<String, Integer> counts,
                                  final Map<String, List<Map<String, Object>>> samples) {
        // Count query: wrap the sample SQL in SELECT COUNT(*) FROM (…).
        final Integer n = jdbc.queryForObject(
                "SELECT COUNT(*)::int FROM (" + sampleSql + ") AS q",
                Integer.class, boundPathLike);
        counts.put(label, n == null ? 0 : n);
        if (sampleLimit > 0 && n != null && n > 0) {
            final List<Map<String, Object>> rows = jdbc.query(
                    sampleSql + " LIMIT ?",
                    (ResultSet rs, int i) -> mapper.map(rs),
                    boundPathLike, sampleLimit);
            samples.put(label, rows);
        } else {
            samples.put(label, List.of());
        }
    }

    private static String nullable(final String s) {
        return s == null ? "" : s;
    }

    @FunctionalInterface
    private interface RsMapper { Map<String, Object> map(ResultSet rs) throws java.sql.SQLException; }

    /** DTO exposed by {@link #audit}; serialised 1:1 by the admin
     *  controller. {@code boundOrgUnitId}/{@code boundOrgUnitPath}
     *  are null when the edge is unbound — in which case counts /
     *  samples are both empty. */
    public record Snapshot(
            String boundOrgUnitId,
            String boundOrgUnitPath,
            Map<String, Integer> countsByEntityType,
            Map<String, List<Map<String, Object>>> samplesByEntityType) {

        public int total() {
            return countsByEntityType.values().stream().mapToInt(Integer::intValue).sum();
        }
    }
}
