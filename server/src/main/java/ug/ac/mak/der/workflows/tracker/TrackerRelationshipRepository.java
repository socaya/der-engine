package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** FR-08-06: typed-relationship persistence. */
@Repository
public class TrackerRelationshipRepository {

    private final JdbcTemplate jdbc;

    public TrackerRelationshipRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public TrackerRelationship upsert(final TrackerRelationship r) {
        Objects.requireNonNull(r, "relationship");
        jdbc.update(
                "INSERT INTO der.edge_tracker_relationship "
                        + "(relationship_uid, relationship_type, "
                        + "from_entity_type, from_entity_uid, "
                        + "to_entity_type, to_entity_uid, bidirectional, "
                        + "created_by, created_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (relationship_uid) DO UPDATE SET "
                        + "bidirectional = EXCLUDED.bidirectional",
                r.relationshipUid(), r.relationshipType(),
                r.fromEntityType().name(), r.fromEntityUid(),
                r.toEntityType().name(), r.toEntityUid(),
                r.bidirectional(), r.createdBy(),
                Timestamp.from(r.createdAt()));
        return r;
    }

    public Optional<TrackerRelationship> findById(final String uid) {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT * FROM der.edge_tracker_relationship WHERE relationship_uid = ?",
                    mapper(), uid));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public List<TrackerRelationship> findForEntity(final TrackerRelationship.EntityType type,
                                                     final String uid) {
        return jdbc.query(
                "SELECT * FROM der.edge_tracker_relationship "
                        + "WHERE (from_entity_type = ? AND from_entity_uid = ?) "
                        + "   OR (to_entity_type = ? AND to_entity_uid = ? AND bidirectional = TRUE) "
                        + "ORDER BY created_at DESC",
                mapper(), type.name(), uid, type.name(), uid);
    }

    public int delete(final String uid) {
        return jdbc.update(
                "DELETE FROM der.edge_tracker_relationship WHERE relationship_uid = ?", uid);
    }

    private static RowMapper<TrackerRelationship> mapper() {
        return (ResultSet rs, int n) -> new TrackerRelationship(
                rs.getString("relationship_uid"),
                rs.getString("relationship_type"),
                TrackerRelationship.EntityType.valueOf(rs.getString("from_entity_type")),
                rs.getString("from_entity_uid"),
                TrackerRelationship.EntityType.valueOf(rs.getString("to_entity_type")),
                rs.getString("to_entity_uid"),
                rs.getBoolean("bidirectional"),
                rs.getObject("created_by", UUID.class),
                rs.getTimestamp("created_at").toInstant());
    }
}
