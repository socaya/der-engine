package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.SecretEnvelope;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.security.TotpService;

/** ADR-0028. Admins self-enrol TOTP. Operators may opt in. */
@RestController
@RequestMapping(path = "/edge-api/v1/auth/mfa", produces = MediaType.APPLICATION_JSON_VALUE)
public class MfaController {

    private final EdgeUserRepository users;
    private final TotpService totp;
    private final SecurityAuditRepository audit;
    private final SecretEnvelope envelope;
    private final Clock clock;

    public MfaController(final EdgeUserRepository users, final TotpService totp,
                          final SecurityAuditRepository audit,
                          final SecretEnvelope envelope,
                          final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.totp = Objects.requireNonNull(totp, "totp");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.envelope = Objects.requireNonNull(envelope, "envelope");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping("/enrol")
    public ResponseEntity<Map<String, Object>> enrol(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String secret = totp.generateSecret();
        // FR-16-07: persist encrypted at rest; return the plaintext
        // once to the admin so they can configure their authenticator.
        users.setTotpSecret(principal.userId(), envelope.seal(secret), null);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("secret", secret);
        body.put("otpauth", totp.otpAuthUri("DER", principal.user().username(), secret));
        body.put("digits", 6);
        body.put("periodSeconds", 30);
        audit.append(new AuditEvent("MFA_ENROLLED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of()), Instant.now(clock));
        return ResponseEntity.ok(body);
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(final Authentication authentication,
                                                        @RequestBody final VerifyRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.code() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MFA_CODE_REQUIRED", "message", "code required"));
        }
        final var secret = users.findTotpSecret(principal.userId());
        if (secret.isEmpty()) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "MFA_NOT_ENROLLED", "message", "no secret for user"));
        }
        final String plainSecret = envelope.open(secret.get());
        if (!totp.verify(plainSecret, body.code())) {
            audit.append(new AuditEvent("MFA_VERIFY_FAILED",
                    AuditEvent.Outcome.DENIED, principal.userId(), null, null, null,
                    Map.of()), Instant.now(clock));
            return ResponseEntity.status(403).body(Map.of(
                    "code", "MFA_INVALID", "message", "code invalid or expired"));
        }
        final Instant now = Instant.now(clock);
        users.setTotpSecret(principal.userId(), secret.get(), now);
        audit.append(new AuditEvent("MFA_VERIFY_SUCCESS",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of()), now);
        return ResponseEntity.ok(Map.of("enrolledAt", now.toString()));
    }

    @PostMapping("/disable")
    public ResponseEntity<Map<String, Object>> disable(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        users.setTotpSecret(principal.userId(), null, null);
        audit.append(new AuditEvent("MFA_DISABLED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of()), Instant.now(clock));
        return ResponseEntity.ok(Map.of("disabled", true));
    }

    public record VerifyRequest(@JsonProperty("code") String code) { }
}
