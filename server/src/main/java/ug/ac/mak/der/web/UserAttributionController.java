package ug.ac.mak.der.web;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.EdgeUserDhis2Mapping;
import ug.ac.mak.der.attribution.EdgeUserDhis2MappingRepository;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * ADR-0032: admin-only maintenance of the edge-user ↔ DHIS2-user map.
 * Operators map themselves at provisioning time; this controller lets
 * ADMINs patch and audit the map.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/users",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class UserAttributionController {

    private final EdgeUserDhis2MappingRepository repo;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final Dhis2ReferenceClient dhis2;

    public UserAttributionController(final EdgeUserDhis2MappingRepository repo,
                                       final SecurityAuditRepository audit,
                                       final Clock clock,
                                       final Dhis2ReferenceClient dhis2) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
    }

    @GetMapping("/dhis2-mappings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> list() {
        final List<EdgeUserDhis2Mapping> rows = repo.findAll();
        return ResponseEntity.ok(Map.of("mappings",
                rows.stream().map(UserAttributionController::toJson).toList()));
    }

    @GetMapping("/{id}/dhis2-mapping")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final UUID id) {
        return repo.findByEdgeUser(id)
                .<ResponseEntity<Map<String, Object>>>map(m -> ResponseEntity.ok(toJson(m)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(path = "/{id}/dhis2-mapping",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> put(final Authentication authentication,
                                                     @PathVariable("id") final UUID id,
                                                     @RequestBody final MappingRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.dhis2UserUid() == null
                || body.dhis2Username() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MAPPING_INVALID",
                    "message", "dhis2UserUid and dhis2Username are required"));
        }
        final Instant now = Instant.now(clock);
        final EdgeUserDhis2Mapping mapping;
        try {
            mapping = new EdgeUserDhis2Mapping(id, body.dhis2UserUid(),
                    body.dhis2Username(), body.dhis2DisplayName(),
                    now, principal.userId(), now);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MAPPING_INVALID", "message", ex.getMessage()));
        }
        repo.upsert(mapping);
        audit.append(new AuditEvent("USER_DHIS2_MAPPING_SET",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("edgeUserId", id.toString(),
                        "dhis2UserUid", body.dhis2UserUid())), now);
        return ResponseEntity.ok(toJson(mapping));
    }

    @DeleteMapping("/{id}/dhis2-mapping")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> delete(final Authentication authentication,
                                                        @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.delete(id);
        audit.append(new AuditEvent("USER_DHIS2_MAPPING_CLEARED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("edgeUserId", id.toString())), Instant.now(clock));
        return ResponseEntity.ok(Map.of("cleared", rows > 0));
    }

    /**
     * Search the bound DHIS2 central for user candidates to map against.
     * Proxies {@code GET /api/users} with the query filter + a compact
     * fields selector so the admin UI can render a typeahead picker.
     *
     * <p>Query semantics match DHIS2's native {@code query=} parameter
     * — match-anywhere across username, displayName, email.  Empty
     * query returns the first page of users (default sort).</p>
     */
    @GetMapping("/dhis2-candidates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> candidates(
            @RequestParam(name = "q", required = false) final String q,
            @RequestParam(name = "pageSize", required = false, defaultValue = "20")
            final int pageSize) {
        final int size = Math.max(1, Math.min(100, pageSize));
        final String path;
        if (q != null && !q.isBlank()) {
            path = "/api/users.json?fields=id,username,displayName,disabled"
                    + "&pageSize=" + size
                    + "&query=" + URLEncoder.encode(q.trim(), StandardCharsets.UTF_8);
        } else {
            path = "/api/users.json?fields=id,username,displayName,disabled"
                    + "&pageSize=" + size;
        }
        try {
            final JsonNode body = dhis2.fetchJson(path);
            final JsonNode users = body.get("users");
            if (users == null || !users.isArray()) {
                return ResponseEntity.ok(Map.of(
                        "candidates", List.of(),
                        "query", q == null ? "" : q));
            }
            final List<Map<String, Object>> rows = new ArrayList<>();
            for (final JsonNode u : users) {
                final Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("id", textOrNull(u.get("id")));
                entry.put("username", textOrNull(u.get("username")));
                entry.put("displayName", textOrNull(u.get("displayName")));
                final JsonNode disabled = u.get("disabled");
                entry.put("disabled", disabled != null && disabled.asBoolean(false));
                rows.add(entry);
            }
            return ResponseEntity.ok(Map.of(
                    "candidates", rows,
                    "query", q == null ? "" : q));
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "DHIS2_UNREACHABLE",
                    "message", ex.getMessage() == null ? "DHIS2 central unreachable" : ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "code", "DHIS2_RESPONSE_INVALID",
                    "message", ex.getMessage() == null ? "DHIS2 central returned an invalid response" : ex.getMessage()));
        }
    }

    private static String textOrNull(final JsonNode node) {
        return node == null || !node.isTextual() ? null : node.asText();
    }

    private static Map<String, Object> toJson(final EdgeUserDhis2Mapping m) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("edgeUserId", m.edgeUserId().toString());
        out.put("dhis2UserUid", m.dhis2UserUid());
        out.put("dhis2Username", m.dhis2Username());
        out.put("dhis2DisplayName", m.dhis2DisplayName());
        out.put("mappedAt", m.mappedAt().toString());
        out.put("mappedBy", m.mappedBy().toString());
        out.put("lastVerifiedAt",
                m.lastVerifiedAt() == null ? null : m.lastVerifiedAt().toString());
        return out;
    }

    public record MappingRequest(
            @JsonProperty("dhis2UserUid") String dhis2UserUid,
            @JsonProperty("dhis2Username") String dhis2Username,
            @JsonProperty("dhis2DisplayName") String dhis2DisplayName) { }
}
