package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code GET /api/geoFeatures} — returns the org-unit geometry
 * DHIS2 Maps renders as thematic layers (points for facilities,
 * polygons for admin boundaries). The response is NOT GeoJSON; it's
 * DHIS2's compact two-letter-field format where {@code ty} encodes
 * the geometry type (1=Point, 2=Polygon, 3=MultiPolygon) and
 * {@code co} carries the coordinates as a JSON-encoded string.
 *
 * <p>Query grammar:
 * <ul>
 *   <li>{@code ou=ou:LEVEL-N} — every OU at level N</li>
 *   <li>{@code ou=ou:LEVEL-N-&lt;parentUid&gt;} — every OU at level N
 *       rooted under the given parent (comma for multiple parents)</li>
 *   <li>{@code ou=ou:&lt;uid&gt;;&lt;uid&gt;} — explicit UID list</li>
 *   <li>{@code ou=ou:USER_ORGUNIT_CHILDREN} — bound OU's children</li>
 *   <li>{@code displayProperty=NAME|SHORTNAME} — which label to return
 *       in the {@code na} field (default NAME)</li>
 * </ul>
 *
 * <p>Source: {@code der.metadata_organisation_unit.payload->geometry}
 * — populated by the metadata sync from central's own geometry data.
 * Facilities without geometry are omitted (they can't be rendered on
 * a map anyway); the Maps app degrades gracefully to "no features".</p>
 */
@RestController
@RequestMapping(path = "/api/geoFeatures", produces = MediaType.APPLICATION_JSON_VALUE)
public class GeoFeaturesController {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public GeoFeaturesController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> geoFeatures(
            final Authentication auth,
            @RequestParam(name = "ou", required = false) final String ou,
            @RequestParam(name = "displayProperty", required = false) final String displayProperty) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (ou == null || ou.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        // Spec is prefixed with `ou:` per DHIS2's dimension grammar.
        final String body = ou.startsWith("ou:") ? ou.substring(3) : ou;
        final List<Map<String, Object>> rows;
        if (body.startsWith("LEVEL-")) {
            rows = byLevel(body);
        } else {
            rows = byUids(List.of(body.split(";")));
        }
        return ResponseEntity.ok(rows);
    }

    /** {@code LEVEL-N} or {@code LEVEL-N-<parentUid>[;<parentUid>...]} */
    private List<Map<String, Object>> byLevel(final String spec) {
        final String[] parts = spec.substring("LEVEL-".length()).split("-", 2);
        final int level;
        try {
            level = Integer.parseInt(parts[0]);
        } catch (final NumberFormatException ex) {
            return List.of();
        }
        if (parts.length == 1) {
            return rowsFromQuery(
                    "SELECT dhis2_uid, display_name, parent_uid, path, level, payload "
                            + "FROM der.metadata_organisation_unit "
                            + "WHERE level = ? AND payload->>'geometry' IS NOT NULL",
                    level);
        }
        // Scope to parent subtree via path prefix.
        final String[] parents = parts[1].split(";");
        final List<Map<String, Object>> out = new ArrayList<>();
        for (final String parent : parents) {
            out.addAll(rowsFromQuery(
                    "SELECT dhis2_uid, display_name, parent_uid, path, level, payload "
                            + "FROM der.metadata_organisation_unit "
                            + "WHERE level = ? "
                            + "  AND path LIKE ? "
                            + "  AND payload->>'geometry' IS NOT NULL",
                    level, "%/" + parent + "/%"));
        }
        return out;
    }

    private List<Map<String, Object>> byUids(final List<String> uids) {
        if (uids.isEmpty()) {
            return List.of();
        }
        final StringBuilder placeholders = new StringBuilder();
        for (int i = 0; i < uids.size(); i++) {
            if (i > 0) {
                placeholders.append(',');
            }
            placeholders.append('?');
        }
        return rowsFromQuery(
                "SELECT dhis2_uid, display_name, parent_uid, path, level, payload "
                        + "FROM der.metadata_organisation_unit "
                        + "WHERE dhis2_uid IN (" + placeholders + ") "
                        + "  AND payload->>'geometry' IS NOT NULL",
                (Object[]) uids.toArray(new String[0]));
    }

    private List<Map<String, Object>> rowsFromQuery(final String sql, final Object... params) {
        final List<Map<String, Object>> out = new ArrayList<>();
        jdbc.query(sql, rs -> {
            final String uid = rs.getString("dhis2_uid");
            final String displayName = rs.getString("display_name");
            final String parentUid = rs.getString("parent_uid");
            final String path = rs.getString("path");
            final int level = rs.getInt("level");
            final String payloadJson = rs.getString("payload");
            final Map<String, Object> f = toFeature(uid, displayName, parentUid,
                    path, level, payloadJson);
            if (f != null) {
                out.add(f);
            }
        }, params);
        return out;
    }

    private Map<String, Object> toFeature(final String uid, final String displayName,
                                            final String parentUid, final String path,
                                            final int level, final String payloadJson) {
        try {
            final JsonNode payload = MAPPER.readTree(payloadJson);
            final JsonNode geom = payload.path("geometry");
            if (geom.isMissingNode() || geom.isNull()) {
                return null;
            }
            final String type = geom.path("type").asText("");
            final int ty = switch (type) {
                case "Point" -> 1;
                case "Polygon" -> 2;
                case "MultiPolygon" -> 3;
                default -> 0;
            };
            if (ty == 0) {
                return null;
            }
            final JsonNode coords = geom.path("coordinates");
            if (coords.isMissingNode()) {
                return null;
            }
            final Map<String, Object> f = new LinkedHashMap<>();
            f.put("id", uid);
            f.put("code", payload.path("code").asText(""));
            f.put("na", displayName);
            f.put("hcd", "false");
            f.put("hcu", "false");
            f.put("le", level);
            f.put("pg", path == null ? "" : stripLeadingSlash(path));
            f.put("pi", parentUid == null ? "" : parentUid);
            f.put("pn", "");
            f.put("ty", ty);
            // DHIS2's wire format stores co as a JSON-encoded string
            // (not a native array) — Maps parses it on the client.
            f.put("co", coords.toString());
            return f;
        } catch (final Exception ex) {
            return null;
        }
    }

    private static String stripLeadingSlash(final String s) {
        return s.startsWith("/") ? s.substring(1) : s;
    }
}
