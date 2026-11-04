package ug.ac.mak.der.web;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.AuthorityCatalog;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.RoleDefinition;
import ug.ac.mak.der.security.RoleDefinitionRepository;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * Dynamic role catalogue management.  Role names are no longer a fixed
 * enum: admins create and edit roles, each with a set of authorities drawn
 * from {@link AuthorityCatalog}.  The four built-in roles
 * (ADMIN/OPERATOR/REVIEWER/SYNC_WORKER) cannot be renamed or deleted;
 * their authority lists remain editable so compliance can tighten them.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/roles",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class RoleManagementController {

    private final RoleDefinitionRepository repo;
    private final SecurityAuditRepository audit;
    private final Clock clock;

    public RoleManagementController(final RoleDefinitionRepository repo,
                                    final SecurityAuditRepository audit,
                                    final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        final List<RoleDefinition> all = repo.findAll();
        final List<Map<String, Object>> rows = new java.util.ArrayList<>(all.size());
        for (final RoleDefinition r : all) {
            rows.add(serialise(r));
        }
        return ResponseEntity.ok(Map.of("roles", rows));
    }

    @GetMapping("/{roleId}")
    public ResponseEntity<Map<String, Object>> get(@PathVariable final UUID roleId,
                                                   final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        return repo.findById(roleId)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(serialise(r)))
                .orElseGet(() -> ResponseEntity.status(404).build());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(@RequestBody final RoleBody body,
                                                      final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        if (body == null || body.name == null || body.name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "name_required"));
        }
        if (repo.findByName(body.name).isPresent()) {
            return ResponseEntity.status(409).body(Map.of("error", "duplicate_name"));
        }
        final Set<String> authorities = body.authorities == null
                ? Set.of()
                : Set.copyOf(body.authorities);
        final RoleDefinition created;
        try {
            created = repo.create(body.name, body.description, authorities);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        logAudit(auth, "ROLE_CREATED", Map.of(
                "roleId", created.roleId().toString(),
                "name", created.name(),
                "authorities", String.join(",", created.authorities())));
        return ResponseEntity.ok(serialise(created));
    }

    @PutMapping(path = "/{roleId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> update(@PathVariable final UUID roleId,
                                                      @RequestBody final RoleBody body,
                                                      final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "body_required"));
        }
        final Set<String> authorities = body.authorities == null
                ? Set.of()
                : Set.copyOf(body.authorities);
        final RoleDefinition updated;
        try {
            updated = repo.update(roleId, body.name, body.description, authorities);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
        logAudit(auth, "ROLE_UPDATED", Map.of(
                "roleId", updated.roleId().toString(),
                "name", updated.name(),
                "authorities", String.join(",", updated.authorities())));
        return ResponseEntity.ok(serialise(updated));
    }

    @DeleteMapping("/{roleId}")
    public ResponseEntity<Map<String, Object>> delete(@PathVariable final UUID roleId,
                                                      final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        try {
            repo.delete(roleId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of("error", ex.getMessage()));
        }
        logAudit(auth, "ROLE_DELETED", Map.of("roleId", roleId.toString()));
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @GetMapping("/authorities/catalog")
    public ResponseEntity<Map<String, Object>> authorityCatalog(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        final List<Map<String, String>> entries = new java.util.ArrayList<>();
        for (final AuthorityCatalog a : AuthorityCatalog.all()) {
            final Map<String, String> row = new LinkedHashMap<>();
            row.put("authority", a.authority());
            row.put("module", a.module());
            row.put("description", a.description());
            entries.add(row);
        }
        return ResponseEntity.ok(Map.of("authorities", entries));
    }

    private Map<String, Object> serialise(final RoleDefinition r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("roleId", r.roleId().toString());
        m.put("name", r.name());
        m.put("description", r.description());
        m.put("builtin", r.builtin());
        m.put("builtinKey", r.builtinKey());
        m.put("authorities", List.copyOf(r.authorities()));
        m.put("userCount", repo.countUsersWithRole(r.roleId()));
        m.put("createdAt", r.createdAt().toString());
        m.put("updatedAt", r.updatedAt().toString());
        return m;
    }

    private ResponseEntity<Map<String, Object>> requireAdmin(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final boolean allowed = auth.getAuthorities().stream()
                .anyMatch(a -> AuthorityCatalog.ROLES_WRITE.authority().equals(a.getAuthority())
                        || "ROLE_ADMIN".equals(a.getAuthority()));
        if (!allowed) {
            return ResponseEntity.status(403).build();
        }
        return null;
    }

    private void logAudit(final Authentication auth, final String type, final Map<String, String> details) {
        final EdgeUserPrincipal p = auth instanceof EdgeUserPrincipal eup ? eup : null;
        final Map<String, Object> detail = new LinkedHashMap<>(details);
        audit.append(new AuditEvent(
                type,
                AuditEvent.Outcome.SUCCESS,
                p == null ? null : p.userId(),
                null,
                null,
                null,
                detail), clock.instant());
    }

    public static final class RoleBody {
        public String name;
        public String description;
        public List<String> authorities;
    }
}
