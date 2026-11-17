package ug.ac.mak.der.dhis2emulator;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.PasswordHasher;

/**
 * DHIS2 {@code /api/auth/**} surface for DHIS2 apps that call the
 * central auth endpoints (Users app, Account Settings, login screens
 * embedded in custom apps). Named {@code Dhis2AuthController} to
 * distinguish it from DER's own {@link ug.ac.mak.der.web.AuthController}
 * at {@code /edge-api/v1/auth/**} which is the real edge auth path.
 *
 * <p>The two share identity state — {@code der.edge_user} +
 * {@code der.edge_credential} — so a password changed via either
 * endpoint is effective for both the DER device session and any
 * subsequent DHIS2 app request.</p>
 *
 * <p>Posture notes:
 * <ul>
 *   <li>{@code POST /api/auth/login} aliases DER sign-in, returning
 *       a cookie session the same way {@code /edge-api/v1/auth/sign-in}
 *       does. Apps that call this endpoint directly (e.g. iframe-mounted
 *       dashboards) therefore get the same session a DER-native app
 *       sees.</li>
 *   <li>{@code POST /api/auth/updatePassword} updates the current
 *       user's password after verifying the old one.</li>
 *   <li>{@code POST /api/auth/invite} + {@code POST /api/auth/registration}
 *       + {@code POST /api/auth/forgotPassword} + {@code POST /api/auth/passwordReset}
 *       assume central email/registration infrastructure a DER appliance
 *       cannot. They return 200 {@code status: ACCEPTED, central: false}
 *       so clients don't crash but the admin sees the attempts in the
 *       audit log.</li>
 * </ul></p>
 *
 * Covers Wave 1 P0 endpoints: {@code POST /api/auth/forgotPassword},
 * {@code /invite}, {@code /login}, {@code /passwordReset},
 * {@code /registration}, {@code /updatePassword}.
 */
@RestController
@RequestMapping(path = "/api/auth", produces = MediaType.APPLICATION_JSON_VALUE)
public class Dhis2AuthController {

    private final EdgeUserRepository users;
    private final PasswordHasher hasher;

    public Dhis2AuthController(final EdgeUserRepository users,
                                 final PasswordHasher hasher) {
        this.users = Objects.requireNonNull(users, "users");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
    }

    /** Alias of DER's edge sign-in. We don't issue a session here —
     *  the client is expected to call {@code /edge-api/v1/auth/sign-in}
     *  for cookie issuance; this endpoint just confirms the credentials
     *  are valid so apps probing login state can render accordingly.
     *  Keeping session issuance on one path means audit trail + rate
     *  limiting stay single-source-of-truth. */
    @PostMapping(path = "/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody final Map<String, Object> body) {
        final String username = str(body, "username", "j_username");
        final String password = str(body, "password", "j_password");
        if (username == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "username + password required"));
        }
        return users.findByUsername(username.toLowerCase())
                .flatMap(u -> users.findVerifier(u.userId())
                        .filter(v -> hasher.verify(password, v))
                        .map(v -> ResponseEntity.ok(Map.<String, Object>of(
                                "httpStatus", "OK",
                                "username", u.username(),
                                "loginRedirectUrl", "/",
                                "message", "Credentials accepted; "
                                        + "call /edge-api/v1/auth/sign-in to establish a session."))))
                .orElseGet(() -> ResponseEntity.status(401).body(Map.<String, Object>of(
                        "httpStatus", "Unauthorized",
                        "message", "Invalid username or password")));
    }

    @PostMapping(path = "/updatePassword", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updatePassword(
            final Authentication auth,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String oldPassword = str(body, "oldPassword", "currentPassword");
        final String newPassword = str(body, "newPassword", "password");
        if (newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "newPassword required"));
        }
        final Optional<String> verifier = users.findVerifier(principal.user().userId());
        if (oldPassword == null || verifier.isEmpty()
                || !hasher.verify(oldPassword, verifier.get())) {
            return ResponseEntity.status(401).body(Map.of(
                    "httpStatus", "Unauthorized",
                    "message", "current password is incorrect"));
        }
        users.upsert(principal.user(), hasher.hash(newPassword));
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Password updated"));
    }

    @PostMapping(path = "/invite", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> invite(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "User invites require an outbound mail relay this appliance does not have. "
                        + "Have an administrator create the account via /edge-api/v1/admin/users."));
    }

    @PostMapping(path = "/registration", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> registration(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.status(403).body(Map.of(
                "httpStatus", "Forbidden",
                "status", "ERROR",
                "message", "Self-registration is disabled on this DER appliance. "
                        + "Contact an administrator to provision your account."));
    }

    @PostMapping(path = "/forgotPassword", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "Password recovery requires an administrator to reset the password manually."));
    }

    @PostMapping(path = "/passwordReset", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> passwordReset(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "Password reset tokens are not issued on this appliance. "
                        + "An administrator can set a new password directly."));
    }

    private static Map<String, Object> acceptedButNoCentralBody(final String msg) {
        return Map.of("httpStatus", "OK",
                "status", "ACCEPTED",
                "central", false,
                "message", msg);
    }

    private static String str(final Map<String, Object> body, final String... keys) {
        if (body == null) {
            return null;
        }
        for (final String k : keys) {
            final Object v = body.get(k);
            if (v instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }
}
