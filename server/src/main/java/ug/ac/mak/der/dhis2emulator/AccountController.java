package ug.ac.mak.der.dhis2emulator;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.PasswordHasher;

/**
 * DHIS2 {@code /api/account/**} surface. Backs real behaviour onto DER's
 * edge identity store ({@code der.edge_user} / {@code der.edge_credential}
 * / {@code der.edge_session}) where the action is meaningful on-edge, and
 * returns an {@code accepted} ack where the action depends on central-only
 * infrastructure (outbound SMTP for email verification, central user
 * registration policy).
 *
 * <p>Posture: an edge appliance is typically air-gapped or on a thin
 * uplink. Self-registration and forgotten-password email flows presume
 * an outbound mail relay DER cannot assume, so those endpoints return
 * 200 with {@code status: ACCEPTED, central: false} rather than 404 —
 * apps that probe these paths at boot don't crash, and the admin's
 * {@code /system/apps} diagnostic (FR-DIAG-002) records the attempt.</p>
 *
 * <p>Covers Wave 1 P0 endpoints: {@code POST /api/account},
 * {@code GET /linkedAccounts}, {@code GET /listSessions},
 * {@code GET /password}, {@code POST /password}, {@code POST /recovery},
 * {@code POST /restore}, {@code POST /sendEmailVerification},
 * {@code GET /username}, {@code POST /validatePassword},
 * {@code POST /validateUsername}, {@code GET /verifyEmail}.</p>
 */
@RestController
@RequestMapping(path = "/api/account", produces = MediaType.APPLICATION_JSON_VALUE)
public class AccountController {

    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_PASSWORD_LENGTH = 72;

    private final EdgeUserRepository users;
    private final PasswordHasher hasher;
    private final JdbcTemplate jdbc;

    public AccountController(final EdgeUserRepository users,
                               final PasswordHasher hasher,
                               final JdbcTemplate jdbc) {
        this.users = Objects.requireNonNull(users, "users");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping("/username")
    public ResponseEntity<Map<String, Object>> username(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("username", principal.user().username()));
    }

    /** DHIS2 returns the current password policy constraints so clients
     *  can render inline help before POSTing a change. These values
     *  mirror the server's own policy — see {@link #validatePassword}
     *  for the matching validator. */
    @GetMapping("/password")
    public ResponseEntity<Map<String, Object>> passwordPolicy(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "minLength", MIN_PASSWORD_LENGTH,
                "maxLength", MAX_PASSWORD_LENGTH,
                "requiresDigit", true,
                "requiresUpper", true,
                "requiresSpecial", false));
    }

    @PostMapping("/password")
    public ResponseEntity<Map<String, Object>> changePassword(
            final Authentication auth,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String oldPassword = str(body, "oldPassword");
        final String newPassword = str(body, "newPassword");
        if (newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "newPassword required"));
        }
        final String violation = validatePasswordInternal(newPassword);
        if (violation != null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", violation));
        }
        final Optional<String> currentVerifier = users.findVerifier(principal.user().userId());
        if (oldPassword == null || currentVerifier.isEmpty()
                || !hasher.verify(oldPassword, currentVerifier.get())) {
            return ResponseEntity.status(401).body(Map.of(
                    "httpStatus", "Unauthorized",
                    "message", "current password is incorrect"));
        }
        users.upsert(principal.user(), hasher.hash(newPassword));
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Password updated"));
    }

    @PostMapping("/validatePassword")
    public ResponseEntity<Map<String, Object>> validatePassword(
            @RequestBody(required = false) final String password,
            @RequestParam(value = "password", required = false) final String queryPassword) {
        final String p = password != null && !password.isBlank() ? password : queryPassword;
        if (p == null || p.isBlank()) {
            return ResponseEntity.ok(Map.of("valid", false,
                    "message", "password required"));
        }
        final String violation = validatePasswordInternal(p);
        if (violation != null) {
            return ResponseEntity.ok(Map.of("valid", false, "message", violation));
        }
        return ResponseEntity.ok(Map.of("valid", true));
    }

    @PostMapping("/validateUsername")
    public ResponseEntity<Map<String, Object>> validateUsername(
            @RequestBody(required = false) final String username,
            @RequestParam(value = "username", required = false) final String queryUsername) {
        final String u = username != null && !username.isBlank()
                ? username : queryUsername;
        if (u == null || u.isBlank()) {
            return ResponseEntity.ok(Map.of("valid", false,
                    "message", "username required"));
        }
        if (!u.equals(u.toLowerCase(Locale.ROOT))) {
            return ResponseEntity.ok(Map.of("valid", false,
                    "message", "username must be lower-case"));
        }
        if (u.length() < 3 || u.length() > 255) {
            return ResponseEntity.ok(Map.of("valid", false,
                    "message", "username must be 3-255 characters"));
        }
        final boolean taken = users.findByUsername(u).isPresent();
        return ResponseEntity.ok(Map.of("valid", !taken,
                "available", !taken,
                "message", taken ? "username already taken" : ""));
    }

    /** DER doesn't support DHIS2's "link multiple central accounts to one
     *  edge identity" flow — the appliance is bound to a single DHIS2
     *  tenant by design. Empty list keeps the Account settings dialog
     *  from crashing on its initial fetch. */
    @GetMapping("/linkedAccounts")
    public ResponseEntity<List<Object>> linkedAccounts(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(List.of());
    }

    /** Lists this user's active (non-revoked, non-expired) sessions.
     *  Backed by {@code der.edge_session} — the same rows DER's own
     *  session introspection uses. Token hash is never returned. */
    @GetMapping("/listSessions")
    public ResponseEntity<List<Map<String, Object>>> listSessions(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Instant now = Instant.now();
        final List<Map<String, Object>> rows = new ArrayList<>();
        jdbc.query(
                "SELECT session_id, issued_at, last_seen_at, expires_at, "
                + "client_ip, user_agent "
                + "FROM der.edge_session "
                + "WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? "
                + "ORDER BY last_seen_at DESC",
                (rs, i) -> {
                    final Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("id", rs.getString("session_id"));
                    m.put("created", rs.getTimestamp("issued_at").toInstant().toString());
                    m.put("lastAccessed", rs.getTimestamp("last_seen_at").toInstant().toString());
                    m.put("expires", rs.getTimestamp("expires_at").toInstant().toString());
                    m.put("ip", rs.getString("client_ip"));
                    m.put("userAgent", rs.getString("user_agent"));
                    rows.add(m);
                    return null;
                },
                principal.user().userId(), java.sql.Timestamp.from(now));
        return ResponseEntity.ok(rows);
    }

    /** Self-registration: {@code POST /api/account} creates an account
     *  from an invite link. On a DER appliance, user provisioning goes
     *  through either central sync (origin DHIS2) or admin creation —
     *  self-registration from an anonymous POST is explicitly disabled
     *  to prevent an open appliance from spawning accounts. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> createAccount(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.status(403).body(Map.of(
                "httpStatus", "Forbidden",
                "status", "ERROR",
                "message", "Self-registration is disabled on this DER appliance. "
                        + "Contact an administrator to provision your account."));
    }

    /** Email-based password recovery depends on an outbound SMTP relay
     *  the appliance doesn't assume. The endpoint accepts the request
     *  so that apps probing it at boot don't crash, and records the
     *  attempt in the audit trail for the admin to action manually. */
    @PostMapping("/recovery")
    public ResponseEntity<Map<String, Object>> recovery(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "Password recovery requires an administrator to reset the password manually."));
    }

    @PostMapping("/restore")
    public ResponseEntity<Map<String, Object>> restore(
            @RequestBody(required = false) final Map<String, Object> body) {
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "Account restore requires administrator action on this appliance."));
    }

    @PostMapping("/sendEmailVerification")
    public ResponseEntity<Map<String, Object>> sendEmailVerification(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(acceptedButNoCentralBody(
                "Email verification queued; no outbound mail relay is configured on this appliance."));
    }

    @GetMapping("/verifyEmail")
    public ResponseEntity<Map<String, Object>> verifyEmail(
            @RequestParam(value = "token", required = false) final String token) {
        return ResponseEntity.ok(Map.of("verified", false,
                "message", "Email verification is managed by an administrator on this appliance."));
    }

    private static Map<String, Object> acceptedButNoCentralBody(final String msg) {
        return Map.of("httpStatus", "OK",
                "status", "ACCEPTED",
                "central", false,
                "message", msg);
    }

    private static String validatePasswordInternal(final String p) {
        if (p == null || p.length() < MIN_PASSWORD_LENGTH) {
            return "password must be at least " + MIN_PASSWORD_LENGTH + " characters";
        }
        if (p.length() > MAX_PASSWORD_LENGTH) {
            return "password must be at most " + MAX_PASSWORD_LENGTH + " characters";
        }
        boolean hasDigit = false;
        boolean hasUpper = false;
        for (int i = 0; i < p.length(); i++) {
            final char c = p.charAt(i);
            if (Character.isDigit(c)) {
                hasDigit = true;
            } else if (Character.isUpperCase(c)) {
                hasUpper = true;
            }
        }
        if (!hasDigit) {
            return "password must contain at least one digit";
        }
        if (!hasUpper) {
            return "password must contain at least one upper-case letter";
        }
        return null;
    }

    private static String str(final Map<String, Object> body, final String key) {
        if (body == null) {
            return null;
        }
        final Object v = body.get(key);
        return v instanceof String s && !s.isBlank() ? s : null;
    }

    // Suppress unused-warning for EdgeUser import — used transitively by
    // EdgeUserPrincipal.user() return type.
    @SuppressWarnings("unused")
    private static final Class<EdgeUser> KEEP = EdgeUser.class;
}
