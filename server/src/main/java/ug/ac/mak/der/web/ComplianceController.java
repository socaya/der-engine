package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.compliance.ComplianceService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** §7 Compliance + §6.5 audit tamper detection admin surface. */
@RestController
@RequestMapping(path = "/edge-api/v1/compliance", produces = MediaType.APPLICATION_JSON_VALUE)
public class ComplianceController {

    private final ComplianceService svc;

    public ComplianceController(final ComplianceService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    /* ─── Retention ────────────────────────────────────────────── */

    @GetMapping("/retention")
    public ResponseEntity<Map<String, Object>> retention() {
        return ResponseEntity.ok(Map.of("policies", svc.listPolicies()));
    }

    @PostMapping("/retention/{category}")
    public ResponseEntity<Map<String, Object>> setRetention(
            final Authentication auth,
            @PathVariable final String category,
            @RequestBody final RetentionBody body) {
        if (body == null || body.keepDays == null || body.keepDays < 1) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "KEEP_DAYS_REQUIRED",
                "message", "keepDays must be >= 1"));
        }
        final UUID actor = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        return ResponseEntity.ok(Map.of(
            "updated", svc.setPolicy(category, body.keepDays, actor)));
    }

    /* ─── Right-to-erasure ─────────────────────────────────────── */

    @PostMapping(path = "/erasure", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> requestErasure(
            final Authentication auth,
            @RequestBody final ErasureBody body) {
        if (body == null || body.subjectType == null || body.subjectId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "FIELDS_REQUIRED",
                "message", "subjectType + subjectId required"));
        }
        final UUID actor = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        return ResponseEntity.status(201).body(svc.requestErasure(
            body.subjectType, body.subjectId, body.reason, actor));
    }

    @PostMapping("/erasure/{id}/complete")
    public ResponseEntity<Map<String, Object>> completeErasure(
            final Authentication auth, @PathVariable final UUID id) {
        final UUID actor = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        return ResponseEntity.ok(svc.completeErasure(id, actor));
    }

    @GetMapping("/erasure")
    public ResponseEntity<Map<String, Object>> listErasureRequests(
            @RequestParam(value = "limit", defaultValue = "50") final int limit) {
        return ResponseEntity.ok(Map.of("requests", svc.listErasureRequests(limit)));
    }

    /* ─── Audit anchors (tamper detection) ────────────────────── */

    @GetMapping("/audit/anchors")
    public ResponseEntity<Map<String, Object>> anchors(
            @RequestParam(value = "limit", defaultValue = "30") final int limit) {
        return ResponseEntity.ok(Map.of("anchors", svc.listAnchors(limit)));
    }

    @PostMapping("/audit/anchor-now")
    public ResponseEntity<Map<String, Object>> anchorNow(final Authentication auth) {
        svc.dailyAuditAnchor();
        return ResponseEntity.ok(Map.of("triggered", true));
    }

    /* ─── Audit export ─────────────────────────────────────────── */

    @GetMapping(path = "/audit/export", produces = "text/csv")
    public ResponseEntity<String> exportAudit(
            @RequestParam(value = "since", required = false) final String since,
            @RequestParam(value = "until", required = false) final String until) {
        final Instant from = since == null ? Instant.EPOCH : Instant.parse(since);
        final Instant to   = until == null ? Instant.now() : Instant.parse(until);
        final String csv = svc.exportAuditCsv(from, to);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION,
                     "attachment; filename=\"der-audit-export.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv);
    }

    /* ─── Data residency ───────────────────────────────────────── */

    @GetMapping("/residency")
    public ResponseEntity<Map<String, Object>> residencyRules() {
        return ResponseEntity.ok(Map.of("rules", svc.listResidencyRules()));
    }

    @GetMapping("/residency/check")
    public ResponseEntity<Map<String, Object>> residencyCheck(@RequestParam final String host) {
        return ResponseEntity.ok(Map.of(
            "host", host,
            "allow", svc.isAllowed(host)));
    }

    /* ─── Bodies ──────────────────────────────────────────────── */

    public static final class RetentionBody {
        public Integer keepDays;
    }

    public static final class ErasureBody {
        public String subjectType;
        public String subjectId;
        public String reason;
    }
}
