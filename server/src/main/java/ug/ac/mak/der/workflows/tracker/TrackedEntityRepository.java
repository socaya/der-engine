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
                        + " created_by, created_at, updated_at, tei_version) "
                        + "VALUES (?, ?, ?, CAST(? AS jsonb), ?, ?, ?, ?) "
                        + "ON CONFLICT (tei_uid) DO UPDATE SET "
                        + "  attributes = EXCLUDED.attributes, "
                        + "  updated_at = EXCLUDED.updated_at, "
                        + "  tei_version = der.tracked_entity.tei_version + 1",
                tei.teiUid(), tei.trackedEntityType(), tei.orgUnitUid(), attrJson,
                tei.createdBy(), Timestamp.from(tei.createdAt()),
                Timestamp.from(tei.updatedAt()), tei.teiVersion());
        return tei;
    }

    public Optional<TrackedEntity> findById(final String teiUid) {
        if (teiUid == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT tei_uid, tracked_entity_type, org_unit_uid, attributes::text AS attributes, "
                            + "created_by, created_at, updated_at, tei_version "
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
     */
    public List<TrackedEntity> search(final String type, final String orgUnit,
                                        final Map<String, String> attrFilter,
                                        final int limit) {
        final int capped = Math.max(1, Math.min(limit, 200));
        final StringBuilder sql = new StringBuilder(
                "SELECT tei_uid, tracked_entity_type, org_unit_uid, attributes::text AS attributes, "
                        + "created_by, created_at, updated_at, tei_version "
                        + "FROM der.tracked_entity WHERE 1=1");
        final List<Object> args = new java.util.ArrayList<>();
        if (type != null) {
            sql.append(" AND tracked_entity_type = ?");
            args.add(type);
        }
        if (orgUnit != null) {
            sql.append(" AND org_unit_uid = ?");
            args.add(orgUnit);
        }
        if (attrFilter != null && !attrFilter.isEmpty()) {
            sql.append(" AND attributes @> CAST(? AS jsonb)");
            args.add(writeJson(attrFilter));
        }
        sql.append(" ORDER BY updated_at DESC LIMIT ?");
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
                rs.getInt("tei_version"));
    }

    public record TrackedEntity(String teiUid, String trackedEntityType,
                                  String orgUnitUid, Map<String, String> attributes,
                                  UUID createdBy, Instant createdAt, Instant updatedAt,
                                  int teiVersion) { }
}
