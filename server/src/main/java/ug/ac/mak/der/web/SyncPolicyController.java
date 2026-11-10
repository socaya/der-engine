package ug.ac.mak.der.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
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

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.sync.policy.SyncPolicy;
import ug.ac.mak.der.sync.policy.SyncPolicyMode;
import ug.ac.mak.der.sync.policy.SyncPolicyService;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/** SM-2 — admin REST surface for the sync-policy model.
 *
 *  <ul>
 *    <li>{@code GET /edge-api/v1/sync/policy} — list all scopes with
 *        effective mode, including per-entity inheritance.</li>
 *    <li>{@code PUT /edge-api/v1/sync/policy/{scope}} — upsert a
 *        policy row for a scope. Body carries
 *        {@code {mode, cron?, reason?}}. Scope is {@code GLOBAL}
 *        or an {@link OperationJournalEntry.EntityType} name.</li>
 *    <li>{@code DELETE /edge-api/v1/sync/policy/{scope}} — reset
 *        (remove) a per-entity override so the scope inherits
 *        GLOBAL. GLOBAL itself cannot be deleted.</li>
 *  </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/sync/policy",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SyncPolicyController {

    private final SyncPolicyService service;

    public SyncPolicyController(final SyncPolicyService service) {
        this.service = Objects.requireNonNull(service, "service");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, SyncPolicy> byScope = service.all();
        final List<Map<String, Object>> rows = new ArrayList<>();
        // GLOBAL first for operator clarity.
        final SyncPolicy global = byScope.get(SyncPolicyService.GLOBAL_SCOPE);
        rows.add(renderRow(global, SyncPolicyService.GLOBAL_SCOPE,
                SyncPolicyService.GLOBAL_SCOPE));
        for (OperationJournalEntry.EntityType t
                : OperationJournalEntry.EntityType.values()) {
            final SyncPolicy perEntity = byScope.get(t.name());
            final SyncPolicyService.ResolvedPolicy eff = service.effectiveFor(t);
            final Map<String, Object> row = renderRow(perEntity, t.name(),
                    eff.decidedBy());
            // When this entity inherits, surface the effective mode
            // too so the UI doesn't have to resolve it again.
            if (perEntity == null) {
                row.put("mode", eff.mode().name());
                row.put("cron", eff.scheduleCron());
                row.put("pausedReason", eff.pausedReason());
                row.put("inherited", true);
            } else {
                row.put("inherited", false);
            }
            rows.add(row);
        }
        return ResponseEntity.ok(Map.of("policies", rows));
    }

    @PutMapping(path = "/{scope}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @PathVariable("scope") final String scope,
                                                        @RequestBody final PolicyBody body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.mode() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_INVALID",
                    "message", "mode is required"));
        }
        if (!isValidScope(scope)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_SCOPE_INVALID",
                    "message", "scope must be GLOBAL or a known EntityType"));
        }
        final SyncPolicyMode mode;
        try {
            mode = SyncPolicyMode.valueOf(body.mode());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_MODE_INVALID",
                    "message", "mode must be INSTANT, SCHEDULED or PAUSED"));
        }
        try {
            final SyncPolicy stored = service.upsert(scope, mode,
                    body.cron(), body.reason(), principal.userId());
            return ResponseEntity.ok(renderRow(stored, scope, scope));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_INVALID", "message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{scope}")
    public ResponseEntity<Map<String, Object>> reset(final Authentication authentication,
                                                       @PathVariable("scope") final String scope) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (SyncPolicyService.GLOBAL_SCOPE.equals(scope)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_GLOBAL_PROTECTED",
                    "message", "GLOBAL policy cannot be deleted "
                        + "— set mode explicitly instead"));
        }
        if (!isValidScope(scope)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_SCOPE_INVALID",
                    "message", "scope must be a known EntityType"));
        }
        final int n = service.reset(scope);
        return ResponseEntity.ok(Map.of("deleted", n));
    }

    private static boolean isValidScope(final String scope) {
        if (SyncPolicyService.GLOBAL_SCOPE.equals(scope)) {
            return true;
        }
        for (OperationJournalEntry.EntityType t
                : OperationJournalEntry.EntityType.values()) {
            if (t.name().equals(scope)) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> renderRow(final SyncPolicy p,
                                                   final String scope,
                                                   final String decidedBy) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("scope", scope);
        m.put("decidedBy", decidedBy);
        if (p != null) {
            m.put("mode", p.mode().name());
            m.put("cron", p.scheduleCron());
            m.put("pausedReason", p.pausedReason());
            m.put("updatedBy", p.updatedBy() == null ? null
                    : p.updatedBy().toString());
            m.put("updatedAt", p.updatedAt().toString());
        }
        return m;
    }

    public record PolicyBody(
            @JsonProperty("mode") String mode,
            @JsonProperty("cron") String cron,
            @JsonProperty("reason") String reason) { }
}
