package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.SecurityAuditVerifier;

/** ADR-0021 D-AUD-4. Admin-only verify endpoint for the audit chain. */
@RestController
@RequestMapping(path = "/edge-api/v1/security/audit", produces = MediaType.APPLICATION_JSON_VALUE)
public class SecurityAuditController {

    private final SecurityAuditVerifier verifier;

    public SecurityAuditController(final SecurityAuditVerifier verifier) {
        this.verifier = Objects.requireNonNull(verifier, "verifier");
    }

    @GetMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify() {
        final SecurityAuditVerifier.Result result = verifier.verify();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", result.ok());
        body.put("totalRows", result.totalRows());
        final SecurityAuditVerifier.Break firstBreak = result.firstBreak();
        body.put("firstBreakAuditId", firstBreak == null ? null : firstBreak.auditId());
        body.put("firstBreakReason", firstBreak == null ? null : firstBreak.reason().name());
        return ResponseEntity.ok(body);
    }
}
