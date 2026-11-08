package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** FR-08-01 / FR-08-02 persistence. */
@Repository
public class TrackedEntityRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public TrackedEntityRepository(final JdbcTemplate jdbc, final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public TrackedEntity upsert(final TrackedEntity tei) {
        Objects.requireNonNull(tei, "tei");
        final String attrJson = writeJson(tei.attributes());
        jdbc.update(
                "INSERT INTO der.tracked_entity "
                        + "(tei_uid, tracked_entity_type, org_unit_uid, attributes, "
                        + " created_by, created_at, updated_at, tei_version, workflow_run_id) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (tei_uid) DO UPDATE SET "
                        + "  attributes = EXCLUDED.attributes, "
                        + "  updated_at = EXCLUDED.updated_at, "
                        + "  tei_version = der.tracked_entity.tei_version + 1, "
                        + "  workflow_run_id = COALESCE(EXCLUDED.workflow_run_id, "
                        + "                              der.tracked_entity.workflow_run_id)",
                tei.teiUid(), tei.trackedEntityType(), tei.orgUnitUid(), attrJson,
                tei.createdBy(), Timestamp.from(tei.createdAt()),
                Timestamp.from(tei.updatedAt()), tei.teiVersion(),
                tei.workflowRunId());
        return tei;
    }

    public Optional<TrackedEntity> findById(final String teiUid) {
        if (teiUid == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT tei_uid, tracked_entity_type, org_unit_uid, attributes::text AS attributes, "
                            + "created_by, created_at, updated_at, tei_version, workflow_run_id "
                            + "FROM der.tracked_entity WHERE tei_uid = ?",
                    mapper(), teiUid));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /**
     * FR-08-02: search by (type, orgUnit) + optional attribute equality
     * filter. The GIN index on `attributes` makes containment lookups
     * fast; limit is capped at 200 to avoid oversize payloads.
     *
     * <p>Back-compat overload — delegates with {@code programUid=null}
     * so existing callers keep their current unfiltered semantics.</p>
     */
    public List<TrackedEntity> search(final String type, final String orgUnit,
                                        final Map<String, String> attrFilter,
                                        final int limit) {
        return search(type, orgUnit, attrFilter, limit, null);
    }

    /**
     * FR-08-02 (+DHIS2 /api/tracker/trackedEntities?program=X parity).
     * Adds an optional {@code programUid} filter so results mirror the
     * DHIS2 tracker API: only TEIs with an enrollment in the given
     * program are returned. Without this, multiple programs that share
     * a tracked-entity type would surface the same TEI rows on every
     * program's working list (which is wrong vs. DHIS2 semantics).
     *
     * <p>Join is a {@code DISTINCT} inner join on {@code edge_enrollment}
     * — any enrollment (ACTIVE, COMPLETED, CANCELLED) qualifies the TEI
     * for appearance in that program's list, matching DHIS2's default.
     * The {@code idx_edge_enrollment_program} index keeps the join
     * cheap at facility scale.</p>
     */
    public List<TrackedEntity> search(final String type, final String orgUnit,
                                        final Map<String, String> attrFilter,
                                        final int limit,
                                        final String programUid) {
        final int capped = Math.max(1, Math.min(limit, 200));
        final StringBuilder sql = new StringBuilder();
        final List<Object> args = new java.util.ArrayList<>();
        if (programUid != null && !programUid.isBlank()) {
            // DISTINCT because a TEI can hold multiple enrollments in
            // the same program over its lifetime; we want one row per
            // TEI, not per enrollment.
            sql.append("SELECT DISTINCT t.tei_uid, t.tracked_entity_type, "
                    + "t.org_unit_uid, t.attributes::text AS attributes, "
                    + "t.created_by, t.created_at, t.updated_at, "
                    + "t.tei_version, t.workflow_run_id "
                    + "FROM der.tracked_entity t "
                    + "INNER JOIN der.edge_enrollment e "
                    + "  ON e.tei_uid = t.tei_uid "
                    + "  AND e.program_uid = ? "
                    + "WHERE 1=1");
            args.add(programUid);
        } else {
            sql.append("SELECT tei_uid, tracked_entity_type, org_unit_uid, "
                    + "attributes::text AS attributes, "
                    + "created_by, created_at, updated_at, tei_version, workflow_run_id "
                    + "FROM der.tracked_entity WHERE 1=1");
        }
        final String colPrefix = (programUid != null && !programUid.isBlank())
                ? "t." : "";
        if (type != null) {
            sql.append(" AND ").append(colPrefix).append("tracked_entity_type = ?");
            args.add(type);
        }
        if (orgUnit != null) {
            sql.append(" AND ").append(colPrefix).append("org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (attrFilter != null && !attrFilter.isEmpty()) {
            sql.append(" AND ").append(colPrefix)
                    .append("attributes @> CAST(? AS jsonb)");
            args.add(writeJson(attrFilter));
        }
        sql.append(" ORDER BY ").append(colPrefix)
                .append("updated_at DESC LIMIT ?");
        args.add(capped);
        return jdbc.query(sql.toString(), mapper(), args.toArray());
    }

    private String writeJson(final Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("TEI JSON serialisation failed", ex);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> readAttrs(final String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return mapper.readValue(raw, Map.class);
        } catch (java.io.IOException ex) {
            return Map.of();
        }
    }

    private RowMapper<TrackedEntity> mapper() {
        return (ResultSet rs, int row) -> new TrackedEntity(
                rs.getString("tei_uid"),
                rs.getString("tracked_entity_type"),
                rs.getString("org_unit_uid"),
                readAttrs(rs.getString("attributes")),
                (UUID) rs.getObject("created_by"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(),
                rs.getInt("tei_version"),
                rs.getObject("workflow_run_id", UUID.class));
    }

    public record TrackedEntity(String teiUid, String trackedEntityType,
                                  String orgUnitUid, Map<String, String> attributes,
                                  UUID createdBy, Instant createdAt, Instant updatedAt,
                                  int teiVersion,
                                  /** §2.3.89 R-C/3 — capture workflow run that
                                   *  produced this TEI. See
                                   *  {@link Enrollment#workflowRunId()}. */
                                  UUID workflowRunId) {

        /** Back-compat ctor — nulls {@link #workflowRunId}. */
        public TrackedEntity(final String teiUid, final String trackedEntityType,
                               final String orgUnitUid,
                               final Map<String, String> attributes,
                               final UUID createdBy, final Instant createdAt,
                               final Instant updatedAt, final int teiVersion) {
            this(teiUid, trackedEntityType, orgUnitUid, attributes, createdBy,
                 createdAt, updatedAt, teiVersion, null);
        }
    }
}
