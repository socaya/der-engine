package ug.ac.mak.der.workflows.tracker;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** FR-08-06: typed-relationship persistence. Slice 2 (full emulation)
 *  adds the sync-tracking read/write helpers: {@link #findDirty},
 *  {@link #markSynced}, {@link #softDelete}, and the extended
 *  {@link #upsert} that preserves sync state on in-place updates. */
@Repository
public class TrackerRelationshipRepository {

    private final JdbcTemplate jdbc;

    public TrackerRelationshipRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @Transactional
    public TrackerRelationship upsert(final TrackerRelationship r) {
        Objects.requireNonNull(r, "relationship");
        jdbc.update(
                "INSERT INTO der.edge_tracker_relationship "
                        + "(relationship_uid, relationship_type, "
                        + "from_entity_type, from_entity_uid, "
                        + "to_entity_type, to_entity_uid, bidirectional, "
                        + "created_by, created_at, updated_at, "
                        + "deleted_at, central_uid, relationship_version) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                        + "ON CONFLICT (relationship_uid) DO UPDATE SET "
                        + "bidirectional = EXCLUDED.bidirectional, "
                        + "updated_at = EXCLUDED.updated_at, "
                        + "deleted_at = EXCLUDED.deleted_at, "
                        + "central_uid = EXCLUDED.central_uid, "
                        + "relationship_version = EXCLUDED.relationship_version",
                r.relationshipUid(), r.relationshipType(),
                r.fromEntityType().name(), r.fromEntityUid(),
                r.toEntityType().name(), r.toEntityUid(),
                r.bidirectional(), r.createdBy(),
                Timestamp.from(r.createdAt()),
                Timestamp.from(r.updatedAt()),
                r.deletedAt() == null ? null : Timestamp.from(r.deletedAt()),
                r.centralUid(),
                r.version());
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
                        + "WHERE deleted_at IS NULL "
                        + "  AND ((from_entity_type = ? AND from_entity_uid = ?) "
                        + "    OR (to_entity_type = ? AND to_entity_uid = ? "
                        + "          AND bidirectional = TRUE)) "
                        + "ORDER BY created_at DESC",
                mapper(), type.name(), uid, type.name(), uid);
    }

    /** Dirty subset the drain worker pulls: rows that still need a
     *  central round-trip (centralUid NULL for creates, OR deleted
     *  rows that haven't been purged yet). Ordered by updatedAt so
     *  the drain preserves write ordering (a later soft-delete
     *  after a create goes out after the create). */
    public List<TrackerRelationship> findDirty(final int limit) {
        final int cap = Math.max(1, Math.min(limit, 500));
        return jdbc.query(
                "SELECT * FROM der.edge_tracker_relationship "
                        + "WHERE central_uid IS NULL "
                        + "   OR (deleted_at IS NOT NULL AND central_uid IS NOT NULL) "
                        + "ORDER BY updated_at ASC "
                        + "LIMIT ?",
                mapper(), cap);
    }

    /** Called by the drain on a successful central POST. Stamps the
     *  server-assigned UID (expected to match relationship_uid when
     *  central accepts client UIDs) and bumps the version. */
    public int markSynced(final String uid, final String centralUid,
                            final Instant at) {
        return jdbc.update(
                "UPDATE der.edge_tracker_relationship "
                        + "SET central_uid = ?, updated_at = ?, "
                        + "    relationship_version = relationship_version + 1 "
                        + "WHERE relationship_uid = ?",
                centralUid, Timestamp.from(at), uid);
    }

    /** Soft-delete the row so the drain can POST a DELETE to central
     *  before the physical purge happens. Version bump so a replayed
     *  drain can't resurrect. */
    @Transactional
    public int softDelete(final String uid, final Instant at) {
        return jdbc.update(
                "UPDATE der.edge_tracker_relationship "
                        + "SET deleted_at = ?, updated_at = ?, "
                        + "    relationship_version = relationship_version + 1 "
                        + "WHERE relationship_uid = ? "
                        + "  AND deleted_at IS NULL",
                Timestamp.from(at), Timestamp.from(at), uid);
    }

    /** Physical purge — the drain calls this once central has
     *  acknowledged the DELETE. Separate from {@link #softDelete}
     *  so a partial sync (soft-deleted but central round-trip
     *  failed) retains the row for the next drain attempt. */
    public int purge(final String uid) {
        return jdbc.update(
                "DELETE FROM der.edge_tracker_relationship "
                        + "WHERE relationship_uid = ? "
                        + "  AND deleted_at IS NOT NULL",
                uid);
    }

    /** Hard-delete — used only by the pre-slice-2 controller + tests
     *  that haven't been migrated to soft-delete+drain yet. Prefer
     *  {@link #softDelete} for new call sites. */
    public int delete(final String uid) {
        return jdbc.update(
                "DELETE FROM der.edge_tracker_relationship WHERE relationship_uid = ?", uid);
    }

    private static RowMapper<TrackerRelationship> mapper() {
        return (ResultSet rs, int n) -> {
            final Timestamp updated = rs.getTimestamp("updated_at");
            final Timestamp deleted = rs.getTimestamp("deleted_at");
            final Timestamp created = rs.getTimestamp("created_at");
            return new TrackerRelationship(
                    rs.getString("relationship_uid"),
                    rs.getString("relationship_type"),
                    TrackerRelationship.EntityType.valueOf(rs.getString("from_entity_type")),
                    rs.getString("from_entity_uid"),
                    TrackerRelationship.EntityType.valueOf(rs.getString("to_entity_type")),
                    rs.getString("to_entity_uid"),
                    rs.getBoolean("bidirectional"),
                    rs.getObject("created_by", UUID.class),
                    created.toInstant(),
                    updated == null ? created.toInstant() : updated.toInstant(),
                    deleted == null ? null : deleted.toInstant(),
                    rs.getString("central_uid"),
                    rs.getInt("relationship_version"));
        };
    }
}
