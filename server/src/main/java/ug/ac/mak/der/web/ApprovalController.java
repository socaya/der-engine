package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
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

import ug.ac.mak.der.approval.ApprovalRecord;
import ug.ac.mak.der.approval.ApprovalRepository;
import ug.ac.mak.der.approval.ApprovalService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** ADR-0016 approval surface. REVIEWER + ADMIN can approve or reject. */
@RestController
@RequestMapping(path = "/edge-api/v1/approvals", produces = MediaType.APPLICATION_JSON_VALUE)
public class ApprovalController {

    private final ApprovalService service;

    public ApprovalController(final ApprovalService service) {
        this.service = Objects.requireNonNull(service, "service");
    }

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Object>> pending(
            @RequestParam(name = "limit", defaultValue = "100") final int limit) {
        final List<ApprovalRepository.PendingApprovalRow> rows = service.pending(limit);
        return ResponseEntity.ok(Map.of("rows", rows.stream()
                .map(ApprovalController::pendingToJson).toList()));
    }

    @GetMapping("/{opId}")
    public ResponseEntity<Map<String, Object>> status(@PathVariable("opId") final UUID opId) {
        return service.status(opId)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(toJson(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{opId}/approve")
    public ResponseEntity<Map<String, Object>> approve(final Authentication authentication,
                                                         @PathVariable("opId") final UUID opId) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        return decide(service.approve(opId, principal.userId()));
    }

    @PostMapping(path = "/{opId}/reject", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> reject(final Authentication authentication,
                                                        @PathVariable("opId") final UUID opId,
                                                        @RequestBody(required = false)
                                                        final RejectRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String reason = body == null ? null : body.reason();
        return decide(service.reject(opId, principal.userId(), reason));
    }

    private ResponseEntity<Map<String, Object>> decide(final ApprovalService.Outcome outcome) {
        return switch (outcome) {
            case APPROVED -> ResponseEntity.ok(Map.of("outcome", "APPROVED"));
            case REJECTED -> ResponseEntity.ok(Map.of("outcome", "REJECTED"));
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case NOT_REQUIRED -> ResponseEntity.status(409).body(Map.of(
                    "code", "APPROVAL_NOT_REQUIRED",
                    "message", "this operation did not require approval"));
            case ALREADY_DECIDED -> ResponseEntity.status(409).body(Map.of(
                    "code", "APPROVAL_ALREADY_DECIDED",
                    "message", "this operation has already been approved or rejected"));
        };
    }

    private static Map<String, Object> toJson(final ApprovalRecord r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("operationId", r.operationId().toString());
        m.put("requiresApproval", r.requiresApproval());
        m.put("approvedBy", r.approvedBy() == null ? null : r.approvedBy().toString());
        m.put("approvedAt", r.approvedAt() == null ? null : r.approvedAt().toString());
        m.put("rejectedBy", r.rejectedBy() == null ? null : r.rejectedBy().toString());
        m.put("rejectedAt", r.rejectedAt() == null ? null : r.rejectedAt().toString());
        m.put("rejectionReason", r.rejectionReason());
        return m;
    }

    private static Map<String, Object> pendingToJson(
            final ApprovalRepository.PendingApprovalRow r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("operationId", r.operationId().toString());
        m.put("entityType", r.entityType());
        m.put("entityRef", r.entityRef());
        m.put("submittedBy", r.submittedBy() == null ? null : r.submittedBy().toString());
        m.put("createdAt", r.createdAt().toString());
        return m;
    }

    public record RejectRequest(@JsonProperty("reason") String reason) { }
}
