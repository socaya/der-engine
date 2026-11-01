package ug.ac.mak.der.web;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflow.CaptureWorkflow;
import ug.ac.mak.der.workflow.CaptureWorkflowService;

/**
 * §62–§63 — pilot peer-to-peer workflow exchange. Operators register
 * peer edge URLs here; pushing a workflow POSTs its canonical JSON to
 * the peer's {@code /edge-api/v1/workflows/import} endpoint.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/workflows/peers",
                 produces = MediaType.APPLICATION_JSON_VALUE)
public class WorkflowPeerController {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowPeerController.class);

    private final JdbcTemplate jdbc;
    private final CaptureWorkflowService workflows;
    private final HttpClient http;
    private final ObjectMapper mapper;

    public WorkflowPeerController(final JdbcTemplate jdbc,
                                    final CaptureWorkflowService workflows,
                                    final HttpClient http,
                                    final ObjectMapper mapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.workflows = Objects.requireNonNull(workflows, "workflows");
        this.http = Objects.requireNonNull(http, "http");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        final List<Map<String, Object>> rows = jdbc.query(
                "SELECT peer_id, display_name, base_url, added_at, added_by, "
                        + "last_push_at, last_push_status, auth_username "
                        + "FROM der.workflow_peer ORDER BY added_at DESC",
                (rs, i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("peerId", rs.getString("peer_id"));
                    m.put("displayName", rs.getString("display_name"));
                    m.put("baseUrl", rs.getString("base_url"));
                    m.put("addedAt", rs.getTimestamp("added_at").toInstant().toString());
                    final String addedBy = rs.getString("added_by");
                    m.put("addedBy", addedBy);
                    final var lastPushAt = rs.getTimestamp("last_push_at");
                    m.put("lastPushAt", lastPushAt == null ? null : lastPushAt.toInstant().toString());
                    m.put("lastPushStatus", rs.getString("last_push_status"));
                    // §2.3.35 — surface the username only; the password
                    // stays server-side (never exposed over the API).
                    m.put("authUsername", rs.getString("auth_username"));
                    return m;
                });
        return ResponseEntity.ok(Map.of("peers", rows));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> add(final Authentication auth,
                                                      @RequestBody final PeerBody body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.displayName == null || body.displayName.isBlank()
                || body.baseUrl == null || body.baseUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "DISPLAY_NAME_AND_URL_REQUIRED"));
        }
        final UUID id = UUID.randomUUID();
        final String user = body.authUsername == null ? null
                : (body.authUsername.isBlank() ? null : body.authUsername.trim());
        final String pass = body.authPassword == null ? null
                : (body.authPassword.isEmpty() ? null : body.authPassword);
        jdbc.update("INSERT INTO der.workflow_peer "
                + "(peer_id, display_name, base_url, added_by, "
                + " auth_username, auth_password) "
                + "VALUES (?, ?, ?, ?, ?, ?)",
                id, body.displayName.trim(),
                body.baseUrl.trim().replaceAll("/$", ""),
                principal.userId(),
                user, pass);
        return ResponseEntity.ok(Map.of(
                "peerId", id.toString(),
                "displayName", body.displayName.trim(),
                "baseUrl", body.baseUrl.trim(),
                "authUsername", user == null ? "" : user));
    }

    /** §2.3.35 — set / clear the stored service-account credentials
     *  for an existing peer. Separate from the create path so an
     *  operator can rotate the password without recreating the peer. */
    @PostMapping(path = "/{peerId}/credentials",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> setCredentials(
            final Authentication auth, @PathVariable final UUID peerId,
            @RequestBody final PeerBody body) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String user = body == null || body.authUsername == null ? null
                : (body.authUsername.isBlank() ? null : body.authUsername.trim());
        final String pass = body == null || body.authPassword == null ? null
                : (body.authPassword.isEmpty() ? null : body.authPassword);
        final int n = jdbc.update(
                "UPDATE der.workflow_peer SET auth_username = ?, auth_password = ? "
                        + "WHERE peer_id = ?",
                user, pass, peerId);
        return n == 0 ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(Map.of("peerId", peerId.toString(),
                                             "authUsername", user == null ? "" : user));
    }

    @DeleteMapping("/{peerId}")
    public ResponseEntity<Map<String, Object>> remove(@PathVariable final UUID peerId) {
        final int n = jdbc.update(
                "DELETE FROM der.workflow_peer WHERE peer_id = ?", peerId);
        return n == 0 ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(Map.of("deleted", true));
    }

    /** Push one workflow's canonical JSON to a peer. */
    @PostMapping("/{peerId}/push/{workflowId}")
    public ResponseEntity<Map<String, Object>> push(final Authentication auth,
                                                      @PathVariable final UUID peerId,
                                                      @PathVariable final UUID workflowId) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Map<String, Object>> peers = jdbc.query(
                "SELECT base_url, auth_username, auth_password "
                        + "FROM der.workflow_peer WHERE peer_id = ?",
                (rs, i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("baseUrl", rs.getString(1));
                    m.put("authUsername", rs.getString(2));
                    m.put("authPassword", rs.getString(3));
                    return m;
                },
                peerId);
        if (peers.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final String base = (String) peers.get(0).get("baseUrl");
        final String authUser = (String) peers.get(0).get("authUsername");
        final String authPass = (String) peers.get(0).get("authPassword");
        final CaptureWorkflow w = workflows.get(workflowId)
                .orElse(null);
        if (w == null) {
            return ResponseEntity.notFound().build();
        }
        final Map<String, Object> canonical = canonicalFromCapture(w);
        try {
            // §2.3.35 — if the peer carries creds, sign in first and
            // extract the DER_SESSION cookie; replay it on the actual
            // import POST. Peers without creds attempt the push
            // anonymously (pre-2.3.35 behaviour).
            String cookie = null;
            if (authUser != null && authPass != null) {
                final String signInBody = mapper.writeValueAsString(Map.of(
                    "username", authUser, "password", authPass));
                final HttpRequest signIn = HttpRequest.newBuilder()
                        .uri(URI.create(base + "/edge-api/v1/auth/sign-in"))
                        .timeout(Duration.ofSeconds(30))
                        .header("Content-Type", "application/json")
                        .header("Accept", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(
                                signInBody, StandardCharsets.UTF_8))
                        .build();
                final HttpResponse<String> sr = http.send(signIn,
                        HttpResponse.BodyHandlers.ofString());
                if (sr.statusCode() < 200 || sr.statusCode() >= 300) {
                    final String reason = "sign-in HTTP " + sr.statusCode();
                    jdbc.update(
                            "UPDATE der.workflow_peer SET last_push_at = ?, "
                                    + "last_push_status = ? WHERE peer_id = ?",
                            java.sql.Timestamp.from(Instant.now()), reason, peerId);
                    return ResponseEntity.status(502).body(Map.of(
                            "peerId", peerId.toString(),
                            "workflowId", workflowId.toString(),
                            "status", reason));
                }
                cookie = sr.headers().firstValue("set-cookie")
                        .map(c -> c.split(";", 2)[0])
                        .orElse(null);
            }
            final String body = mapper.writeValueAsString(canonical);
            // §2.3.38 — default to inbox mode so pushes don't silently
            // overwrite the receiver's workflow catalogue. Receivers can
            // still opt out of inbox mode by not having the inbox table
            // (older edges) — the receiver falls back to direct import.
            final String fromLabel = "peer-" + peerId.toString().substring(0, 8);
            final HttpRequest.Builder reqB = HttpRequest.newBuilder()
                    .uri(URI.create(base + "/edge-api/v1/workflows/import"
                            + "?inbox=true&fromLabel="
                            + java.net.URLEncoder.encode(fromLabel,
                                    StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            if (cookie != null) {
                reqB.header("Cookie", cookie);
            }
            final HttpRequest req = reqB.build();
            final HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            final String outcome = resp.statusCode() >= 200 && resp.statusCode() < 300
                    ? "OK" : "HTTP " + resp.statusCode();
            jdbc.update(
                    "UPDATE der.workflow_peer SET last_push_at = ?, last_push_status = ? "
                            + "WHERE peer_id = ?",
                    java.sql.Timestamp.from(Instant.now()), outcome, peerId);
            return ResponseEntity.status(resp.statusCode()).body(Map.of(
                    "peerId", peerId.toString(),
                    "workflowId", workflowId.toString(),
                    "status", outcome,
                    "peerBody", resp.body().length() > 2000
                            ? resp.body().substring(0, 2000) + "…"
                            : resp.body()));
        } catch (Exception ex) {
            final String reason = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            LOG.warn("peer push {} → {} failed: {}", workflowId, peerId, reason);
            jdbc.update(
                    "UPDATE der.workflow_peer SET last_push_at = ?, last_push_status = ? "
                            + "WHERE peer_id = ?",
                    java.sql.Timestamp.from(Instant.now()), reason, peerId);
            return ResponseEntity.status(502).body(Map.of(
                    "peerId", peerId.toString(),
                    "workflowId", workflowId.toString(),
                    "status", reason));
        }
    }

    /** Shape the stored workflow into the canonical import format. */
    private Map<String, Object> canonicalFromCapture(final CaptureWorkflow w) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("schemaVersion", 1);
        out.put("displayName", w.displayName());
        out.put("boundMetadataKind", w.boundMetadataKind().name());
        out.put("boundMetadataId", w.boundMetadataId());
        out.put("enabled", w.enabled());
        final List<Map<String, Object>> steps = new java.util.ArrayList<>();
        w.steps().forEach((s) -> {
            final Map<String, Object> sm = new LinkedHashMap<>();
            sm.put("ordinal", s.ordinal());
            sm.put("displayName", s.displayName());
            sm.put("ownerRole", s.ownerRole().name());
            sm.put("ownerDeviceId", s.ownerDeviceId() == null ? null : s.ownerDeviceId().toString());
            sm.put("stepKind", s.stepKind().name());
            sm.put("sectionKind", s.sectionKind() == null ? null : s.sectionKind().name());
            sm.put("sectionRef", s.sectionRef());
            final List<Map<String, Object>> fields = new java.util.ArrayList<>();
            s.fields().forEach((f) -> fields.add(Map.of(
                    "fieldRef", f.fieldRef(),
                    "requirement", f.requirement().name())));
            sm.put("fields", fields);
            steps.add(sm);
        });
        out.put("steps", steps);
        final List<Map<String, Object>> deps = new java.util.ArrayList<>();
        for (int i = 0; i < w.dependencies().size(); i++) {
            final var d = w.dependencies().get(i);
            // Resolve step UUIDs → ordinals to make the canonical doc
            // portable across edges.
            final int fromOrd = ordinalFor(w, d.dependsOnStepId());
            final int toOrd   = ordinalFor(w, d.stepId());
            deps.add(Map.of(
                    "fromOrdinal", fromOrd,
                    "toOrdinal", toOrd,
                    "kind", d.kind().name()));
        }
        out.put("dependencies", deps);
        return out;
    }

    private int ordinalFor(final CaptureWorkflow w, final UUID stepId) {
        for (final var s : w.steps()) {
            if (s.stepId().equals(stepId)) {
                return s.ordinal();
            }
        }
        return -1;
    }

    public static final class PeerBody {
        public String displayName;
        public String baseUrl;
        public String authUsername;
        public String authPassword;
    }
}
