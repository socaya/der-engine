package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

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

import org.springframework.web.bind.annotation.RequestParam;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.sync.policy.SyncPolicy;
import ug.ac.mak.der.sync.policy.SyncPolicyMode;
import ug.ac.mak.der.sync.policy.SyncPolicyService;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

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
    private final OperationJournalRepository journal;
    private final SecurityAuditRepository audit;
    private final Clock clock;

    public SyncPolicyController(final SyncPolicyService service,
                                  final OperationJournalRepository journal,
                                  final SecurityAuditRepository audit,
                                  final Clock clock) {
        this.service = Objects.requireNonNull(service, "service");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** UI-10 — pull-side + background job scopes added to the
     *  policy model in V109. Each maps to a Quartz job that gates
     *  itself through SyncPolicyService before every tick. */
    public static final List<String> SCHEDULED_SCOPES = List.of(
            "METADATA_SYNC",
            "DATA_PULL",
            "COMPAT_REFRESH",
            "DRIFT_SNAPSHOT",
            "ANALYTICS_REFRESH",
            "REFERRAL_INBOX",
            "REFERRAL_ESCALATION",
            "BACKUP_DRAIN"
    );

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
            rows.add(renderOne(byScope, t.name(), "WRITE"));
        }
        for (String s : SCHEDULED_SCOPES) {
            rows.add(renderOne(byScope, s, "SCHEDULED"));
        }
        return ResponseEntity.ok(Map.of("policies", rows));
    }

    private Map<String, Object> renderOne(final Map<String, SyncPolicy> byScope,
                                            final String scope,
                                            final String kind) {
        final SyncPolicy stored = byScope.get(scope);
        final SyncPolicyService.ResolvedPolicy eff = service.effectiveForScope(scope);
        final Map<String, Object> row = renderRow(stored, scope, eff.decidedBy());
        row.put("kind", kind);
        if (stored == null) {
            row.put("mode", eff.mode().name());
            row.put("cron", eff.scheduleCron());
            row.put("pausedReason", eff.pausedReason());
            row.put("inherited", true);
        } else {
            row.put("inherited", false);
        }
        return row;
    }

    @PutMapping(path = "/{scope}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upsert(final Authentication authentication,
                                                        @PathVariable("scope") final String scope,
                                                        @RequestBody final PolicyBody body,
                                                        final HttpServletRequest http) {
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
        final SyncPolicy prior = service.get(scope).orElse(null);
        try {
            final SyncPolicy stored = service.upsert(scope, mode,
                    body.cron(), body.reason(), principal.userId());
            // SM-4b — audit every policy change with before/after so
            // operators can see who flipped what and when on the
            // /sync/policy audit panel.
            logChange(principal.userId(), http, "SYNC_POLICY_UPSERT",
                    scope, prior, stored);
            return ResponseEntity.ok(renderRow(stored, scope, scope));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "POLICY_INVALID", "message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{scope}")
    public ResponseEntity<Map<String, Object>> reset(final Authentication authentication,
                                                       @PathVariable("scope") final String scope,
                                                       final HttpServletRequest http) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
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
        final SyncPolicy prior = service.get(scope).orElse(null);
        final int n = service.reset(scope);
        if (n > 0) {
            logChange(principal.userId(), http, "SYNC_POLICY_RESET",
                    scope, prior, null);
        }
        return ResponseEntity.ok(Map.of("deleted", n));
    }

    /** SM-4a + SM-4c — one call that returns effective policy per
     *  scope along with the current backlog count for that scope.
     *  Used by the dashboard / worker / attention banners to show
     *  "N rows held by paused policies" without any client-side
     *  aggregation, and by the policy screen to render the per-row
     *  held-rows chip. */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // Build [entity_type -> pending count] from a single scan.
        final Map<String, Integer> pending = new LinkedHashMap<>();
        for (OperationJournalRepository.EntityStateCount esc
                : journal.countByEntityTypeAndState()) {
            if ("PENDING".equals(esc.state())) {
                pending.merge(esc.entityType(), esc.count(), Integer::sum);
            }
        }
        final List<Map<String, Object>> scopes = new ArrayList<>();
        int totalHeld = 0;
        int pausedScopeCount = 0;
        for (OperationJournalEntry.EntityType t
                : OperationJournalEntry.EntityType.values()) {
            final SyncPolicyService.ResolvedPolicy eff = service.effectiveFor(t);
            final int held = eff.isPaused() ? pending.getOrDefault(t.name(), 0) : 0;
            if (eff.isPaused()) {
                pausedScopeCount++;
                totalHeld += held;
            }
            scopes.add(Map.of(
                    "scope", t.name(),
                    "kind", "WRITE",
                    "mode", eff.mode().name(),
                    "decidedBy", eff.decidedBy(),
                    "pausedReason", eff.pausedReason() == null
                        ? "" : eff.pausedReason(),
                    "held", held
            ));
        }
        // Scheduled-job scopes contribute to the paused-scope count
        // but can't accumulate "held rows" the way write scopes do —
        // a paused pull/compat/drift/referral/backup/analytics job
        // just doesn't tick; its "held" is 0 by convention.
        for (String s : SCHEDULED_SCOPES) {
            final SyncPolicyService.ResolvedPolicy eff = service.effectiveForScope(s);
            if (eff.isPaused()) {
                pausedScopeCount++;
            }
            scopes.add(Map.of(
                    "scope", s,
                    "kind", "SCHEDULED",
                    "mode", eff.mode().name(),
                    "decidedBy", eff.decidedBy(),
                    "pausedReason", eff.pausedReason() == null
                        ? "" : eff.pausedReason(),
                    "held", 0
            ));
        }
        return ResponseEntity.ok(Map.of(
                "anyPaused", pausedScopeCount > 0,
                "pausedScopeCount", pausedScopeCount,
                "totalHeld", totalHeld,
                "scopes", scopes
        ));
    }

    /** SM-4b — recent policy changes, newest first. Pulled from the
     *  shared security_audit stream filtered by the SYNC_POLICY_*
     *  event types. */
    @GetMapping("/audit")
    public ResponseEntity<Map<String, Object>> auditTrail(final Authentication authentication,
                                                            @RequestParam(name = "limit",
                                                                defaultValue = "50") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final int capped = Math.max(1, Math.min(500, limit));
        final List<SecurityAuditRepository.Row> up =
                audit.findRecent("SYNC_POLICY_UPSERT", null, capped);
        final List<SecurityAuditRepository.Row> rs =
                audit.findRecent("SYNC_POLICY_RESET", null, capped);
        final List<SecurityAuditRepository.Row> merged = new ArrayList<>(up);
        merged.addAll(rs);
        merged.sort((a, b) -> b.observedAt().compareTo(a.observedAt()));
        final List<Map<String, Object>> out = new ArrayList<>();
        for (SecurityAuditRepository.Row r : merged.stream()
                .limit(capped).toList()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("at", r.observedAt().toString());
            m.put("eventType", r.eventType());
            m.put("actorUserId", r.actorUserId() == null
                    ? null : r.actorUserId().toString());
            m.put("detailJson", r.detailJson());
            out.add(m);
        }
        return ResponseEntity.ok(Map.of("entries", out));
    }

    private void logChange(final UUID actor, final HttpServletRequest http,
                             final String eventType, final String scope,
                             final SyncPolicy prior, final SyncPolicy stored) {
        final Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("scope", scope);
        if (prior != null) {
            detail.put("fromMode", prior.mode().name());
            if (prior.scheduleCron() != null) {
                detail.put("fromCron", prior.scheduleCron());
            }
            if (prior.pausedReason() != null) {
                detail.put("fromReason", prior.pausedReason());
            }
        }
        if (stored != null) {
            detail.put("toMode", stored.mode().name());
            if (stored.scheduleCron() != null) {
                detail.put("toCron", stored.scheduleCron());
            }
            if (stored.pausedReason() != null) {
                detail.put("toReason", stored.pausedReason());
            }
        }
        audit.append(new AuditEvent(eventType,
                AuditEvent.Outcome.SUCCESS,
                actor, null,
                http == null ? null : http.getRemoteAddr(),
                http == null ? null : http.getHeader(HttpHeaders.USER_AGENT),
                detail), Instant.now(clock));
    }

    private static boolean isValidScope(final String scope) {
        if (SyncPolicyService.GLOBAL_SCOPE.equals(scope)) {
            return true;
        }
        if (SCHEDULED_SCOPES.contains(scope)) {
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
