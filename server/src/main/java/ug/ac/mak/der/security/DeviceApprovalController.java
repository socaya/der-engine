package ug.ac.mak.der.security;

import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin surface for the ADR-0019 slice B
 * "require approved device" toggle. Backed by
 * {@link DeviceApprovalPolicy} — a PUT persists through
 * {@code der.admin_setting} so the choice survives restarts.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/security/device-approval",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DeviceApprovalController {

    private final DeviceApprovalPolicy policy;

    public DeviceApprovalController(final DeviceApprovalPolicy policy) {
        this.policy = Objects.requireNonNull(policy, "policy");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> read(final Authentication auth) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        return ResponseEntity.ok(Map.of("required", policy.required()));
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> update(
            final Authentication auth,
            @RequestBody final UpdateRequest body) {
        final ResponseEntity<Map<String, Object>> denied = requireAdmin(auth);
        if (denied != null) {
            return denied;
        }
        if (body == null || body.required() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "REQUIRED_FIELD",
                    "message", "'required' boolean is required"));
        }
        final EdgeUserPrincipal principal = (EdgeUserPrincipal) auth;
        policy.set(body.required(), principal.userId());
        return ResponseEntity.ok(Map.of("required", policy.required()));
    }

    private static ResponseEntity<Map<String, Object>> requireAdmin(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        return null;
    }

    public record UpdateRequest(@JsonProperty("required") Boolean required) { }
}
