package ug.ac.mak.der.web;

import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * §37–§42 — browse mirrored metadata snapshots. Pilots use this to
 * decide which snapshot a workflow should be pinned to.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/metadata/snapshots",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataSnapshotController {

    private final JdbcTemplate jdbc;

    public MetadataSnapshotController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT s.snapshot_id, s.imported_from, s.imported_by, s.imported_at, "
                        + "s.organisation_units_count, s.data_elements_count, "
                        + "s.data_sets_count, s.programs_count, "
                        + "s.tracked_entity_types_count, "
                        + "s.central_version, s.central_revision, s.fingerprint, "
                        + "s.retired_at, s.retired_by, "
                        + "(SELECT COUNT(*) FROM der.capture_workflow w "
                        + "   WHERE w.pinned_snapshot_id = s.snapshot_id) AS pinned_workflows "
                        + "FROM der.metadata_snapshot s "
                        + "ORDER BY s.imported_at DESC LIMIT 100",
                (ResultSet rs, int i) -> row(rs));
        return ResponseEntity.ok(Map.of("snapshots", rows));
    }

    @PostMapping("/{snapshotId}/retire")
    public ResponseEntity<Map<String, Object>> retire(final Authentication auth,
                                                        @PathVariable final long snapshotId) {
        if (!(auth instanceof EdgeUserPrincipal p)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = jdbc.update(
                "UPDATE der.metadata_snapshot "
                        + "SET retired_at = now(), retired_by = ? "
                        + "WHERE snapshot_id = ? AND retired_at IS NULL",
                p.userId(), snapshotId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("snapshotId", snapshotId, "retired", true));
    }

    @PostMapping("/{snapshotId}/reinstate")
    public ResponseEntity<Map<String, Object>> reinstate(final Authentication auth,
                                                            @PathVariable final long snapshotId) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = jdbc.update(
                "UPDATE der.metadata_snapshot "
                        + "SET retired_at = NULL, retired_by = NULL "
                        + "WHERE snapshot_id = ?", snapshotId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("snapshotId", snapshotId, "retired", false));
    }

    private Map<String, Object> row(final ResultSet rs) throws java.sql.SQLException {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("snapshotId",     rs.getLong("snapshot_id"));
        m.put("importedFrom",   rs.getString("imported_from"));
        final UUID importedBy = rs.getObject("imported_by", UUID.class);
        m.put("importedBy",     importedBy == null ? null : importedBy.toString());
        m.put("importedAt",     rs.getTimestamp("imported_at").toInstant().toString());
        final Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("organisationUnits", rs.getInt("organisation_units_count"));
        counts.put("dataElements",      rs.getInt("data_elements_count"));
        counts.put("dataSets",          rs.getInt("data_sets_count"));
        counts.put("programs",          rs.getInt("programs_count"));
        counts.put("trackedEntityTypes", rs.getInt("tracked_entity_types_count"));
        m.put("counts", counts);
        m.put("centralVersion",  rs.getString("central_version"));
        m.put("centralRevision", rs.getString("central_revision"));
        m.put("fingerprint",     rs.getString("fingerprint"));
        final java.sql.Timestamp retiredAt = rs.getTimestamp("retired_at");
        m.put("retiredAt",       retiredAt == null ? null : retiredAt.toInstant().toString());
        final UUID retiredBy = rs.getObject("retired_by", UUID.class);
        m.put("retiredBy",       retiredBy == null ? null : retiredBy.toString());
        m.put("pinnedWorkflows", rs.getInt("pinned_workflows"));
        // Expose a bounded "status" so the UI can colour-code without
        // reading timestamps.
        m.put("status", retiredAt != null ? "RETIRED" : "ACTIVE");
        return m;
    }
}
