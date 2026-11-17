package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Local CRUD for user-created DHIS2 analytics artifacts —
 * {@code visualizations}, {@code dashboards}, {@code maps},
 * {@code reports}, {@code eventReports}, {@code eventCharts},
 * {@code charts}. These are distinct from {@link MetadataListController}'s
 * catalog reads: catalog rows come from central metadata sync, while
 * artifact rows are authored on-edge by operators using Data Visualizer,
 * Dashboard, Maps, etc.
 *
 * <p>Persistence: V131 {@code der.metadata_artifact} table —
 * {@code (resource, uid)} primary key so each artifact type has its own
 * namespace; the full DHIS2 object is stored verbatim as JSONB and
 * served back on GET with round-trip fidelity. No schema interpretation
 * — DER doesn't need to understand chart semantics to persist them; the
 * on-edge analytics engine (Wave 2 later batches) will consume these
 * payloads when the operator asks for a saved chart's data.</p>
 *
 * <p>Routes mounted via one {@code @RequestMapping("/api/{resource}")}
 * variable so one controller covers all seven artifact types. The
 * resource names are validated against {@link #ARTIFACT_RESOURCES} to
 * prevent this path pattern from shadowing other {@code /api/{thing}}
 * endpoints (Spring routes most-specific-first, but the explicit
 * whitelist here is belt-and-braces).</p>
 */
@RestController
@RequestMapping(path = "/api/{resource:visualizations|dashboards|maps|reports|eventReports|eventCharts|charts}",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AnalyticsArtifactsController {

    private static final Set<String> ARTIFACT_RESOURCES = Set.of(
            "visualizations", "dashboards", "maps", "reports",
            "eventReports", "eventCharts", "charts");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public AnalyticsArtifactsController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page,
            @RequestParam(name = "filter", required = false) final List<String> filters) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final Integer totalBoxed = jdbc.queryForObject(
                "SELECT count(*) FROM der.metadata_artifact WHERE resource = ?",
                Integer.class, resource);
        final int total = totalBoxed == null ? 0 : totalBoxed;
        final List<String> rows = jdbc.queryForList(
                "SELECT payload::text FROM der.metadata_artifact "
                        + "WHERE resource = ? "
                        + "ORDER BY coalesce(display_name, uid) "
                        + "LIMIT ? OFFSET ?",
                String.class, resource, safeSize, (safePage - 1) * safeSize);
        final List<JsonNode> payloads = new ArrayList<>(rows.size());
        for (final String r : rows) {
            payloads.add(parseJson(r));
        }
        final Map<String, Object> pager = Map.of(
                "page", safePage,
                "pageSize", safeSize,
                "total", total,
                "pageCount", (int) Math.ceil(total / (double) safeSize));
        return ResponseEntity.ok(Map.of("pager", pager, resource, payloads));
    }

    @GetMapping("/{uid}")
    public ResponseEntity<JsonNode> getByUid(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        try {
            final String payload = jdbc.queryForObject(
                    "SELECT payload::text FROM der.metadata_artifact "
                            + "WHERE resource = ? AND uid = ?",
                    String.class, resource, uid);
            if (payload == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(parseJson(payload));
        } catch (final org.springframework.dao.EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        final String uid = body.get("id") instanceof String s && !s.isBlank()
                ? s : generateUid();
        body.put("id", uid);
        final String displayName = body.get("displayName") instanceof String n ? n
                : body.get("name") instanceof String n2 ? n2 : uid;
        final String payload = serialise(body);
        jdbc.update(
                "INSERT INTO der.metadata_artifact "
                        + "(resource, uid, display_name, created_by, updated_by, payload) "
                        + "VALUES (?, ?, ?, ?, ?, ?::jsonb) "
                        + "ON CONFLICT (resource, uid) DO UPDATE SET "
                        + "display_name = EXCLUDED.display_name, "
                        + "updated_by = EXCLUDED.updated_by, "
                        + "updated_at = now(), "
                        + "payload = EXCLUDED.payload",
                resource, uid, displayName,
                principal.user().userId(), principal.user().userId(),
                payload);
        return ResponseEntity.status(201).body(Map.of(
                "httpStatus", "Created",
                "httpStatusCode", 201,
                "status", "OK",
                "message", singularOf(resource) + " " + uid + " created",
                "response", Map.of(
                        "uid", uid,
                        "responseType", "ImportSummary",
                        "status", "SUCCESS",
                        "importCount", Map.of(
                                "imported", 1, "updated", 0,
                                "ignored", 0, "deleted", 0))));
    }

    @PutMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> replace(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @PathVariable("uid") final String uid,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        body.put("id", uid);
        final String displayName = body.get("displayName") instanceof String n ? n
                : body.get("name") instanceof String n2 ? n2 : uid;
        final String payload = serialise(body);
        final int rows = jdbc.update(
                "INSERT INTO der.metadata_artifact "
                        + "(resource, uid, display_name, created_by, updated_by, payload) "
                        + "VALUES (?, ?, ?, ?, ?, ?::jsonb) "
                        + "ON CONFLICT (resource, uid) DO UPDATE SET "
                        + "display_name = EXCLUDED.display_name, "
                        + "updated_by = EXCLUDED.updated_by, "
                        + "updated_at = now(), "
                        + "payload = EXCLUDED.payload",
                resource, uid, displayName,
                principal.user().userId(), principal.user().userId(),
                payload);
        return ResponseEntity.ok(Map.of(
                "httpStatus", "OK",
                "status", "OK",
                "message", singularOf(resource) + " " + uid + " updated",
                "response", Map.of(
                        "uid", uid,
                        "responseType", "ImportSummary",
                        "status", "SUCCESS",
                        "importCount", Map.of(
                                "imported", 0, "updated", rows,
                                "ignored", 0, "deleted", 0))));
    }

    @PatchMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> patch(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @PathVariable("uid") final String uid,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        // Read-modify-write: merge the patch keys into the stored payload
        // so clients that PATCH a subset don't lose other fields.
        final String current;
        try {
            current = jdbc.queryForObject(
                    "SELECT payload::text FROM der.metadata_artifact "
                            + "WHERE resource = ? AND uid = ?",
                    String.class, resource, uid);
        } catch (final org.springframework.dao.EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
        if (current == null) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> merged;
        try {
            @SuppressWarnings("unchecked")
            final Map<String, Object> existing = MAPPER.readValue(current, Map.class);
            existing.putAll(body);
            merged = existing;
        } catch (final Exception ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "httpStatus", "InternalServerError",
                    "message", "stored payload is not a JSON object"));
        }
        return replace(auth, resource, uid, merged);
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> delete(
            final Authentication auth,
            @PathVariable("resource") final String resource,
            @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (!ARTIFACT_RESOURCES.contains(resource)) {
            return ResponseEntity.status(404).build();
        }
        final int n = jdbc.update(
                "DELETE FROM der.metadata_artifact "
                        + "WHERE resource = ? AND uid = ?",
                resource, uid);
        if (n == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "httpStatus", "OK",
                "status", "OK",
                "message", singularOf(resource) + " " + uid + " deleted"));
    }

    // ---- helpers ----

    private static String singularOf(final String resource) {
        return switch (resource) {
            case "visualizations" -> "Visualization";
            case "dashboards" -> "Dashboard";
            case "maps" -> "Map";
            case "reports" -> "Report";
            case "eventReports" -> "EventReport";
            case "eventCharts" -> "EventChart";
            case "charts" -> "Chart";
            default -> resource;
        };
    }

    private static String serialise(final Object body) {
        try {
            return MAPPER.writeValueAsString(body);
        } catch (final Exception ex) {
            throw new IllegalArgumentException("payload not serialisable", ex);
        }
    }

    private static JsonNode parseJson(final String s) {
        try {
            return MAPPER.readTree(s);
        } catch (final Exception ex) {
            throw new IllegalStateException("could not parse artifact payload", ex);
        }
    }

    /** 11-char DHIS2-shape UID — same alphabet DHIS2 uses. */
    private static String generateUid() {
        final char[] alphabet = ("ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                + "abcdefghijklmnopqrstuvwxyz0123456789").toCharArray();
        final java.util.Random rng = new java.util.Random();
        final StringBuilder sb = new StringBuilder(11);
        sb.append(alphabet[rng.nextInt(52)]);
        for (int i = 1; i < 11; i++) {
            sb.append(alphabet[rng.nextInt(alphabet.length)]);
        }
        return sb.toString();
    }
}
