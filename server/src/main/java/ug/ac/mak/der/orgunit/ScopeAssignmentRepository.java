package ug.ac.mak.der.orgunit;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JDBC layer over the pre-existing {@code der.scope_assignment} table.
 *
 * <p>The table predates DER-APPS-DHIS2-001 and supports three scope
 * types (ORG_UNIT, PROGRAM, DATA_SET). FR-OU-005 only needs the
 * {@code ORG_UNIT} rows, and only the most-recently-written one per
 * user — DER's current semantics treat per-user scope as a single
 * narrowed OU within the device-wide bound facility.</p>
 *
 * <p>Multiple ORG_UNIT rows for one user are tolerated (they can come
 * from a central-side import or a separate admin flow) but Phase 5h's
 * admin surface stays strictly one-OU-per-user: {@link #upsertOrgUnit}
 * replaces any existing ORG_UNIT row for the user.</p>
 */
@Repository
public class ScopeAssignmentRepository {

    private static final String ORG_UNIT = "ORG_UNIT";

    private final JdbcTemplate jdbc;

    public ScopeAssignmentRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /** The current single-row ORG_UNIT scope for the user, if any. */
    public Optional<Row> findOrgUnitScope(final UUID userId) {
        Objects.requireNonNull(userId, "userId");
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT assignment_id, user_id, scope_ref, "
                            + "include_descendants, imported_at "
                            + "FROM der.scope_assignment "
                            + "WHERE user_id = ? AND scope_type = ? "
                            + "ORDER BY imported_at DESC LIMIT 1",
                    (rs, n) -> new Row(
                            rs.getLong("assignment_id"),
                            (UUID) rs.getObject("user_id"),
                            rs.getString("scope_ref"),
                            rs.getBoolean("include_descendants"),
                            rs.getTimestamp("imported_at").toInstant()),
                    userId, ORG_UNIT));
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    /** Replace the user's ORG_UNIT scope. Deletes any existing
     *  ORG_UNIT rows for the user before inserting. */
    public void upsertOrgUnit(final UUID userId,
                                final String orgUnitId,
                                final boolean includeDescendants) {
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(orgUnitId, "orgUnitId");
        jdbc.update(
                "DELETE FROM der.scope_assignment "
                        + "WHERE user_id = ? AND scope_type = ?",
                userId, ORG_UNIT);
        jdbc.update(
                "INSERT INTO der.scope_assignment "
                        + "(user_id, scope_type, scope_ref, include_descendants, "
                        + " imported_at) "
                        + "VALUES (?, ?, ?, ?, now())",
                userId, ORG_UNIT, orgUnitId, includeDescendants);
    }

    public int deleteOrgUnit(final UUID userId) {
        if (userId == null) {
            return 0;
        }
        return jdbc.update(
                "DELETE FROM der.scope_assignment "
                        + "WHERE user_id = ? AND scope_type = ?",
                userId, ORG_UNIT);
    }

    public record Row(long assignmentId,
                       UUID userId,
                       String scopeRef,
                       boolean includeDescendants,
                       Instant importedAt) { }
}
