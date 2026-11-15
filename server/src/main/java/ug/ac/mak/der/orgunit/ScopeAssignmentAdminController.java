package ug.ac.mak.der.orgunit;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER-APPS-DHIS2-001 FR-OU-005 — admin surface for per-user OU
 * scope assignments. ADMIN-only. The {@code PUT} path validates
 * the target OU is in the mirror AND falls under the current
 * device-wide bound subtree — the whole point of the feature is to
 * narrow within the bound facility, not to pick anything DHIS2 knows
 * about.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/users",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class ScopeAssignmentAdminController {

    private final ScopeAssignmentRepository scopes;
    private final OrgUnitBindingService binding;
    private final EdgeOrgUnitBindingRepository bindingRepo;

    public ScopeAssignmentAdminController(final ScopeAssignmentRepository scopes,
                                           final OrgUnitBindingService binding,
                                           final EdgeOrgUnitBindingRepository bindingRepo) {
        this.scopes = Objects.requireNonNull(scopes, "scopes");
        this.binding = Objects.requireNonNull(binding, "binding");
        this.bindingRepo = Objects.requireNonNull(bindingRepo, "bindingRepo");
    }

    @GetMapping("/{userId}/scope-assignment")
    public ResponseEntity<Map<String, Object>> get(final Authentication auth,
                                                    @PathVariable("userId") final UUID userId) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        final Optional<ScopeAssignmentRepository.Row> row =
                scopes.findOrgUnitScope(userId);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toJson(row.get()));
    }

    @PutMapping("/{userId}/scope-assignment")
    public ResponseEntity<Map<String, Object>> put(final Authentication auth,
                                                     @PathVariable("userId") final UUID userId,
                                                     @RequestBody final Request body) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        if (body == null || body.orgUnitId == null || body.orgUnitId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "orgUnitId required in body"));
        }
        final EdgeOrgUnitBinding current = binding.current();
        if (current == null || !current.isBound()) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "EDGE_NOT_BOUND",
                    "message", "the edge must be bound before a per-user "
                            + "scope can be assigned"));
        }
        final String path = bindingRepo.resolveOrgUnitPath(body.orgUnitId);
        if (path == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ORG_UNIT_NOT_IN_MIRROR",
                    "message", "orgUnit " + body.orgUnitId
                            + " is not in the local metadata mirror"));
        }
        if (!bindingRepo.isUnderBoundSubtree(current, path)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ORG_UNIT_OUTSIDE_BOUND_SUBTREE",
                    "message", "the per-user scope OU must fall under the "
                            + "device-wide bound subtree"));
        }
        scopes.upsertOrgUnit(userId, body.orgUnitId,
                body.includeDescendants != null ? body.includeDescendants : true);
        return ResponseEntity.ok(toJson(
                scopes.findOrgUnitScope(userId).orElseThrow()));
    }

    @DeleteMapping("/{userId}/scope-assignment")
    public ResponseEntity<Map<String, Object>> delete(final Authentication auth,
                                                        @PathVariable("userId") final UUID userId) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        final int rows = scopes.deleteOrgUnit(userId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    private static ResponseEntity<Map<String, Object>> requireAdmin(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        return null;
    }

    private static Map<String, Object> toJson(final ScopeAssignmentRepository.Row r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", r.userId().toString());
        m.put("orgUnitId", r.scopeRef());
        m.put("includeDescendants", r.includeDescendants());
        m.put("assignedAt", r.importedAt().toString());
        return m;
    }

    public record Request(String orgUnitId, Boolean includeDescendants) { }
}
