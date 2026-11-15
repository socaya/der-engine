package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.BreakGlassService;

/**
 * FR-02-09 — audited break-glass admin recovery.
 *
 * <p>No auth gate: the caller IS locked out. Proof of authorisation
 * is a file an admin with host-level access writes to the appliance,
 * echoed back by the caller. See {@link BreakGlassService} for
 * invariants.</p>
 *
 * <p>Status taxonomy:
 * <ul>
 *   <li>200 — recovery succeeded; body carries the new password ONCE.</li>
 *   <li>403 — token mismatch, token file absent/unreadable.</li>
 *   <li>404 — flow is disabled (ambiguous by design — attackers
 *     can't fingerprint).</li>
 *   <li>409 — no admin row exists to recover.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/break-glass",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class BreakGlassController {

    private final BreakGlassService service;

    public BreakGlassController(final BreakGlassService service) {
        this.service = Objects.requireNonNull(service, "service");
    }

    @PostMapping(path = "/recover", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> recover(
            @RequestBody(required = false) final Request body,
            final HttpServletRequest http) {
        final String ip = http.getRemoteAddr();
        final String ua = http.getHeader(HttpHeaders.USER_AGENT);
        final String token = body == null ? null : body.token;
        final BreakGlassService.Outcome outcome = service.recover(token, ip, ua);
        if (outcome instanceof BreakGlassService.Outcome.Success s) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("username", s.username());
            m.put("password", s.password());
            m.put("message",
                    "One-time recovery password — rotate immediately after "
                            + "sign-in.");
            return ResponseEntity.ok(m);
        }
        if (outcome instanceof BreakGlassService.Outcome.NoAdmin) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "NO_ADMIN_FOUND",
                    "message", "The appliance has no admin user to recover. "
                            + "Provision one via the bootstrap env + restart."));
        }
        if (outcome instanceof BreakGlassService.Outcome.Disabled) {
            // Deliberately 404 so an attacker can't fingerprint.
            return ResponseEntity.notFound().build();
        }
        // Denied — keep the reason opaque to the caller; operators
        // see it in the audit log.
        return ResponseEntity.status(403).body(Map.of(
                "code", "BREAK_GLASS_DENIED",
                "message", "Break-glass recovery denied. See the "
                        + "security_audit table for the reason code."));
    }

    public record Request(String token) { }
}
