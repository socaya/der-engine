package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
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
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.EdgeUserDhis2Mapping;
import ug.ac.mak.der.attribution.EdgeUserDhis2MappingRepository;
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

    public UserAttributionController(final EdgeUserDhis2MappingRepository repo,
                                       final SecurityAuditRepository audit,
                                       final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
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
