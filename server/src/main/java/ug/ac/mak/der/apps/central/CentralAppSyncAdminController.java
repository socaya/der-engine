package ug.ac.mak.der.apps.central;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-005 — admin surface for central app
 * auto-sync. ADMIN-only. The {@code /preview} endpoint runs a
 * dry-run so the admin can see "here's what the next real run would
 * do" before enabling the scheduled job.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/apps/central-sync",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class CentralAppSyncAdminController {

    private final CentralAppSyncService service;
    private final CentralAppSyncRunRepository runs;
    private final CentralSyncPolicyService policies;

    public CentralAppSyncAdminController(final CentralAppSyncService service,
                                           final CentralAppSyncRunRepository runs,
                                           final CentralSyncPolicyService policies) {
        this.service = Objects.requireNonNull(service, "service");
        this.runs = Objects.requireNonNull(runs, "runs");
        this.policies = Objects.requireNonNull(policies, "policies");
    }

    /** Status + last-N runs. Useful on the /system/apps diagnostic. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> status(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("latest", runs.latest().map(this::rowJson).orElse(null));
        final List<Map<String, Object>> recent = runs.recent(20).stream()
                .map(this::rowJson).toList();
        body.put("recent", recent);
        return ResponseEntity.ok(body);
    }

    /** Admin-triggered dry-run — reports what a real run would do. */
    @GetMapping(path = "/preview")
    public ResponseEntity<Map<String, Object>> preview(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        final EdgeUserPrincipal principal = (EdgeUserPrincipal) auth;
        final CentralAppSyncService.SyncReport report =
                service.sync(true, principal.user().userId());
        return ResponseEntity.ok(reportJson(report));
    }

    /** DER-APPS-DHIS2-001 FR-SYNC-004 — current allow/deny-list. */
    @GetMapping(path = "/policy")
    public ResponseEntity<Map<String, Object>> getPolicy(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        return ResponseEntity.ok(policyJson(policies.read()));
    }

    /** Replace the policy. Admin-only. Body: {@code
     *  { "mode": "ALLOW_ALL" | "ALLOW_LIST" | "DENY_LIST", "keys": [...] }}. */
    @PutMapping(path = "/policy")
    public ResponseEntity<Map<String, Object>> putPolicy(
            final Authentication auth,
            @RequestBody final CentralSyncPolicy body) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        if (body == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "body required"));
        }
        final EdgeUserPrincipal principal = (EdgeUserPrincipal) auth;
        policies.write(body, principal.user().userId());
        return ResponseEntity.ok(policyJson(policies.read()));
    }

    /** Admin-triggered real run. */
    @PostMapping(path = "/run")
    public ResponseEntity<Map<String, Object>> run(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> gate = requireAdmin(auth);
        if (gate != null) {
            return gate;
        }
        final EdgeUserPrincipal principal = (EdgeUserPrincipal) auth;
        final CentralAppSyncService.SyncReport report =
                service.sync(false, principal.user().userId());
        return ResponseEntity.ok(reportJson(report));
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

    private Map<String, Object> rowJson(final CentralAppSyncRunRepository.Row r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId().toString());
        m.put("startedAt", r.startedAt() == null ? null : r.startedAt().toString());
        m.put("completedAt", r.completedAt() == null ? null : r.completedAt().toString());
        m.put("outcome", r.outcome());
        m.put("message", r.message());
        m.put("dryRun", r.dryRun());
        m.put("triggeredBy", r.triggeredBy() == null ? null : r.triggeredBy().toString());
        m.put("discovered", r.discovered());
        m.put("installed", r.installed());
        m.put("updated", r.updated());
        m.put("skipped", r.skipped());
        m.put("failed", r.failed());
        return m;
    }

    private static Map<String, Object> policyJson(final CentralSyncPolicy p) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", p.mode().name());
        m.put("keys", p.keys());
        m.put("source", p.source().name());
        return m;
    }

    private Map<String, Object> reportJson(final CentralAppSyncService.SyncReport r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("runId", r.runId() == null ? null : r.runId().toString());
        m.put("outcome", r.outcome());
        m.put("message", r.message());
        m.put("counters", Map.of(
                "discovered", r.counters().discovered(),
                "installed", r.counters().installed(),
                "updated", r.counters().updated(),
                "skipped", r.counters().skipped(),
                "failed", r.counters().failed()));
        m.put("details", r.details().stream().map(d -> {
            final Map<String, Object> dm = new LinkedHashMap<>();
            dm.put("key", d.key());
            dm.put("centralVersion", d.centralVersion());
            dm.put("localVersion", d.localVersion());
            dm.put("action", d.action());
            dm.put("reason", d.reason());
            dm.put("sha256", d.sha256());
            return dm;
        }).toList());
        return m;
    }
}
