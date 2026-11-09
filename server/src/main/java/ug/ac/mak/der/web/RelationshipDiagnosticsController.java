package ug.ac.mak.der.web;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Relationship admin diagnostics (spec §REL-S-015 / §REL-S-016).
 *
 * <p>A single endpoint that answers "how is the relationships
 * subsystem doing on this edge?" for the admin console:
 *
 * <ul>
 *  <li>Metadata inventory — how many relationship types are
 *      mirrored, grouped by class (DHIS2_NATIVE vs DER-only).</li>
 *  <li>Instance inventory — how many relationships live locally,
 *      grouped by sync_status + class.</li>
 *  <li>Attention queue — the N most recent rows that need
 *      operator review (FAILED / BLOCKED / CONFLICT sync states),
 *      with the context fields needed to triage them from the
 *      admin UI without a database shell.</li>
 * </ul>
 *
 * <p>Read-only, ADMIN-gated, zero side-effects. The admin UI calls
 * this on diagnostics screen open + on manual refresh; no polling
 * is wired yet since relationships volume is low enough that an
 * on-demand fetch is accurate for the operator's visit.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/relationships/diagnostics",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class RelationshipDiagnosticsController {

    private final JdbcTemplate jdbc;

    public RelationshipDiagnosticsController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> get(
            final Authentication authentication,
            @RequestParam(value = "attentionLimit", required = false,
                    defaultValue = "25") final int attentionLimit) {
        final int cappedLimit = Math.max(1, Math.min(attentionLimit, 200));
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("asOf", Instant.now().toString());
        out.put("metadata", metadataCounts());
        out.put("instances", instanceCounts());
        out.put("attention", attentionList(cappedLimit));
        return ResponseEntity.ok(out);
    }

    /** Count relationship-type metadata rows grouped by rel_class
     *  so the admin can see at a glance how many types the operator
     *  has to work with and which classes dominate the catalogue. */
    private Map<String, Object> metadataCounts() {
        final Map<String, Object> out = new LinkedHashMap<>();
        final List<Map<String, Object>> byClass =
                jdbc.query("SELECT rel_class, COUNT(*) AS n "
                                + "FROM der.metadata_relationship_type "
                                + "GROUP BY rel_class ORDER BY rel_class",
                        (rs, n) -> {
                            final Map<String, Object> row =
                                    new LinkedHashMap<>();
                            row.put("relClass", rs.getString("rel_class"));
                            row.put("count", rs.getInt("n"));
                            return row;
                        });
        out.put("byClass", byClass);
        out.put("total", jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.metadata_relationship_type",
                Long.class));
        out.put("withDirectionalNames", jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.metadata_relationship_type "
                    + "WHERE payload ? 'fromToName' "
                    + "   OR payload ? 'toFromName'", Long.class));
        return out;
    }

    /** Edge-table counts by (sync_status, rel_class) so the admin
     *  sees both "how much is pending sync" and "how much is
     *  edge-only" in one grid. Total includes soft-deleted rows
     *  so the admin can spot leftover tombstones that haven't
     *  purged yet. */
    private Map<String, Object> instanceCounts() {
        final Map<String, Object> out = new LinkedHashMap<>();
        final List<Map<String, Object>> grid = jdbc.query(
                "SELECT sync_status, rel_class, COUNT(*) AS n "
                    + "FROM der.edge_tracker_relationship "
                    + "WHERE deleted_at IS NULL "
                    + "GROUP BY sync_status, rel_class "
                    + "ORDER BY sync_status, rel_class",
                (rs, n) -> {
                    final Map<String, Object> row = new LinkedHashMap<>();
                    row.put("syncStatus", rs.getString("sync_status"));
                    row.put("relClass", rs.getString("rel_class"));
                    row.put("count", rs.getInt("n"));
                    return row;
                });
        out.put("byStatusAndClass", grid);
        out.put("live", jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.edge_tracker_relationship "
                    + "WHERE deleted_at IS NULL", Long.class));
        out.put("softDeleted", jdbc.queryForObject(
                "SELECT COUNT(*) FROM der.edge_tracker_relationship "
                    + "WHERE deleted_at IS NOT NULL", Long.class));
        return out;
    }

    /** Rows needing operator review — anything FAILED, BLOCKED, or
     *  CONFLICT. Ordered newest-first so the operator sees the
     *  most recent breakage first (often what prompted them to
     *  open the diagnostics screen). Each row carries enough
     *  context for triage without a second lookup. */
    private List<Map<String, Object>> attentionList(final int limit) {
        final List<Map<String, Object>> rows = new ArrayList<>();
        jdbc.query(
                "SELECT relationship_uid, relationship_type, "
                    + "from_entity_type, from_entity_uid, "
                    + "to_entity_type, to_entity_uid, "
                    + "sync_status, rel_class, "
                    + "created_at, updated_at, central_uid, "
                    + "relationship_version "
                    + "FROM der.edge_tracker_relationship "
                    + "WHERE sync_status IN ('FAILED','BLOCKED','CONFLICT') "
                    + "  AND deleted_at IS NULL "
                    + "ORDER BY updated_at DESC LIMIT ?",
                rs -> {
                    final Map<String, Object> row = new LinkedHashMap<>();
                    row.put("relationshipUid",
                            rs.getString("relationship_uid"));
                    row.put("relationshipType",
                            rs.getString("relationship_type"));
                    row.put("fromEntityType",
                            rs.getString("from_entity_type"));
                    row.put("fromEntityUid",
                            rs.getString("from_entity_uid"));
                    row.put("toEntityType",
                            rs.getString("to_entity_type"));
                    row.put("toEntityUid",
                            rs.getString("to_entity_uid"));
                    row.put("syncStatus", rs.getString("sync_status"));
                    row.put("relClass", rs.getString("rel_class"));
                    final Timestamp created = rs.getTimestamp("created_at");
                    row.put("createdAt",
                            created == null ? null
                                : created.toInstant().toString());
                    final Timestamp updated = rs.getTimestamp("updated_at");
                    row.put("updatedAt",
                            updated == null ? null
                                : updated.toInstant().toString());
                    row.put("centralUid", rs.getString("central_uid"));
                    row.put("version",
                            rs.getInt("relationship_version"));
                    rows.add(row);
                }, limit);
        return rows;
    }
}
