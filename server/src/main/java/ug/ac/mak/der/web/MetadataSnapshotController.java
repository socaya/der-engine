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

    /** §2.3.28 — per-UID diff of a single resource between two snapshots.
     *  Returns added/removed/changed UID lists. Backed by
     *  {@code metadata_entity_version} (V060), so values populate from
     *  the first sync after that migration lands. Earlier snapshots
     *  carry zero rows and show up as "unchanged (no history)". */
    @GetMapping("/{a}/diff/{b}/{resource}")
    public ResponseEntity<Map<String, Object>> resourceDiff(
            @PathVariable final long a,
            @PathVariable final long b,
            @PathVariable final String resource) {
        final Map<String, String> aMap = fingerprintsFor(a, resource);
        final Map<String, String> bMap = fingerprintsFor(b, resource);
        final List<Map<String, String>> added = new java.util.ArrayList<>();
        final List<Map<String, String>> removed = new java.util.ArrayList<>();
        final List<Map<String, String>> changed = new java.util.ArrayList<>();
        for (final var e : bMap.entrySet()) {
            if (!aMap.containsKey(e.getKey())) {
                added.add(resolveLabel(resource, e.getKey()));
            } else if (!java.util.Objects.equals(aMap.get(e.getKey()), e.getValue())) {
                changed.add(resolveLabel(resource, e.getKey()));
            }
        }
        for (final String uid : aMap.keySet()) {
            if (!bMap.containsKey(uid)) {
                removed.add(resolveLabel(resource, uid));
            }
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("a", a);
        out.put("b", b);
        out.put("resource", resource);
        out.put("added", added);
        out.put("removed", removed);
        out.put("changed", changed);
        return ResponseEntity.ok(out);
    }

    private Map<String, String> fingerprintsFor(final long snapshotId, final String resource) {
        final Map<String, String> out = new LinkedHashMap<>();
        jdbc.query(
                "SELECT dhis2_uid, fingerprint FROM der.metadata_entity_version "
                        + "WHERE snapshot_id = ? AND resource = ?",
                (ResultSet rs) -> {
                    out.put(rs.getString(1), rs.getString(2));
                },
                snapshotId, resource);
        return out;
    }

    /** Try to resolve a UID to a human label via the live mirror tables.
     *  Falls back to the UID if the row is no longer present. */
    private Map<String, String> resolveLabel(final String resource, final String uid) {
        final Map<String, String> m = new LinkedHashMap<>();
        m.put("id", uid);
        final String table = switch (resource) {
            case "organisationUnits" -> "metadata_organisation_unit";
            case "dataElements"      -> "metadata_data_element";
            case "dataSets"          -> "metadata_data_set";
            case "programs"          -> "metadata_program";
            case "programStages"     -> "metadata_program_stage";
            case "programRules"      -> "metadata_program_rule";
            case "trackedEntityTypes" -> "metadata_tracked_entity_type";
            case "trackedEntityAttributes" -> "metadata_tracked_entity_attribute";
            default -> null;
        };
        if (table != null) {
            try {
                final String name = jdbc.queryForObject(
                        "SELECT display_name FROM der." + table
                                + " WHERE dhis2_uid = ?",
                        String.class, uid);
                m.put("displayName", name);
            } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
                m.put("displayName", null);
            }
        }
        return m;
    }

    /** §2.3.27 — pairwise diff between two snapshots.
     *  Shows per-resource counts in each snapshot + a delta so operators
     *  can see at a glance what grew / shrank. True per-UID row-level
     *  diff needs the row-versioning schema (follow-up); the mirror's
     *  upsert-overwrite semantics mean we only ever carry the latest
     *  version of each row today. */
    @GetMapping("/{a}/diff/{b}")
    public ResponseEntity<Map<String, Object>> diff(@PathVariable final long a,
                                                       @PathVariable final long b) {
        final Map<String, Object> ra = fetchCounts(a);
        final Map<String, Object> rb = fetchCounts(b);
        if (ra == null || rb == null) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> deltas = new LinkedHashMap<>();
        for (final String key : java.util.List.of(
                "organisationUnits", "dataElements", "dataSets",
                "programs", "trackedEntityTypes")) {
            final int ca = ((Integer) ((Map<?, ?>) ra.get("counts")).get(key));
            final int cb = ((Integer) ((Map<?, ?>) rb.get("counts")).get(key));
            final Map<String, Object> cell = new LinkedHashMap<>();
            cell.put("a", ca);
            cell.put("b", cb);
            cell.put("delta", cb - ca);
            deltas.put(key, cell);
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("a", ra);
        out.put("b", rb);
        out.put("deltas", deltas);
        // Also live row-tagged counts: how many rows presently carry
        // each snapshot_id. These drift to zero as later syncs overwrite.
        out.put("liveTaggedCounts", Map.of(
            "a", liveTaggedCounts(a),
            "b", liveTaggedCounts(b)));
        return ResponseEntity.ok(out);
    }

    private Map<String, Object> fetchCounts(final long snapshotId) {
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
                        + "WHERE s.snapshot_id = ?",
                (ResultSet rs, int i) -> row(rs),
                snapshotId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Integer> liveTaggedCounts(final long snapshotId) {
        final Map<String, Integer> out = new LinkedHashMap<>();
        for (final String[] res : new String[][] {
                { "organisationUnits", "metadata_organisation_unit" },
                { "dataElements",      "metadata_data_element" },
                { "dataSets",          "metadata_data_set" },
                { "programs",          "metadata_program" },
                { "programRules",      "metadata_program_rule" },
        }) {
            final Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM der." + res[1] + " WHERE snapshot_id = ?",
                    Integer.class, snapshotId);
            out.put(res[0], n == null ? 0 : n);
        }
        return out;
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
