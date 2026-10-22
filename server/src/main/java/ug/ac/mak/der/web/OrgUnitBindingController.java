package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** ADR-0015 orgUnit binding surface — read current + bind/rebind. */
@RestController
@RequestMapping(path = "/edge-api/v1/system/org-unit", produces = MediaType.APPLICATION_JSON_VALUE)
public class OrgUnitBindingController {

    private final OrgUnitBindingService service;

    public OrgUnitBindingController(final OrgUnitBindingService service) {
        this.service = Objects.requireNonNull(service, "service");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get() {
        return ResponseEntity.ok(toJson(service.current()));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> bind(final Authentication authentication,
                                                      @RequestBody final BindRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.orgUnitId() == null || body.orgUnitId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ORG_UNIT_REQUIRED",
                    "message", "orgUnitId is required"));
        }
        final EdgeOrgUnitBinding existing = service.current();
        if (existing.isBound() && !existing.orgUnitId().equals(body.orgUnitId()) && !body.confirm()) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "REBIND_REQUIRES_CONFIRMATION",
                    "message", "edge is already bound to " + existing.orgUnitId()
                            + "; set confirm=true to rebind. "
                            + "Local data from the previous OU is retained for admin triage."));
        }
        try {
            final EdgeOrgUnitBinding bound = service.bind(body.orgUnitId(), principal.userId());
            return ResponseEntity.ok(toJson(bound));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ORG_UNIT_NOT_IN_MIRROR",
                    "message", ex.getMessage()));
        }
    }

    private static Map<String, Object> toJson(final EdgeOrgUnitBinding b) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("bound", b.isBound());
        m.put("orgUnitId", b.orgUnitId());
        m.put("orgUnitDisplayName", b.orgUnitDisplayName());
        m.put("orgUnitPath", b.orgUnitPath());
        m.put("boundAt", b.boundAt() == null ? null : b.boundAt().toString());
        m.put("boundBy", b.boundBy() == null ? null : b.boundBy().toString());
        return m;
    }

    public record BindRequest(
            @JsonProperty("orgUnitId") String orgUnitId,
            @JsonProperty("confirm") boolean confirm) { }
}
