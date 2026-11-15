package ug.ac.mak.der.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * FR-02-09 — admin-recovery break-glass flow.
 *
 * <p>Threat model: an operator with physical access to the appliance
 * needs to regain admin access when (a) the admin password is
 * forgotten, (b) the admin row got disabled accidentally, and (c)
 * central is unreachable so a DHIS2-side reset isn't an option.
 * Physical-presence is proved by writing a one-time token to a
 * well-known file path that only the host administrator can create.
 * The HTTP caller must echo that token back; on match, the service
 * rotates the configured admin's verifier and un-disables it,
 * returning a freshly-generated password ONCE.</p>
 *
 * <p>Design invariants:
 * <ul>
 *   <li><strong>Never mints a new admin.</strong> The recovery target
 *     must already exist. This caps the blast radius of a compromised
 *     token file to one specific account, not "whichever username
 *     the attacker likes."</li>
 *   <li><strong>One-use.</strong> The token file is deleted after a
 *     successful recovery. A second attempt against the same file
 *     is denied.</li>
 *   <li><strong>Always audited.</strong> Attempt, success and denial
 *     all write distinct audit event types with the caller IP + UA.</li>
 *   <li><strong>404 when disabled.</strong> When
 *     {@code der.security.break-glass.enabled=false}, the endpoint
 *     responds 404 so it can't be fingerprinted from the public web.</li>
 * </ul>
 */
@Service
public class BreakGlassService {

    private static final Logger LOG = LoggerFactory.getLogger(BreakGlassService.class);

    static final String EVENT_ATTEMPTED = "BREAK_GLASS_ATTEMPTED";
    static final String EVENT_SUCCESS = "BREAK_GLASS_SUCCESS";
    static final String EVENT_DENIED = "BREAK_GLASS_DENIED";

    private final EdgeUserRepository users;
    private final PasswordHasher hasher;
    private final SecurityAuditRepository audit;
    private final SecurityProperties props;
    private final Clock clock;
    private final SecureRandom rand = new SecureRandom();

    public BreakGlassService(final EdgeUserRepository users,
                               final PasswordHasher hasher,
                               final SecurityAuditRepository audit,
                               final SecurityProperties props,
                               final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.props = Objects.requireNonNull(props, "props");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** @return {@code true} iff {@code der.security.break-glass.enabled}. */
    public boolean enabled() {
        return props.breakGlass().enabled();
    }

    @Transactional
    public Outcome recover(final String submittedToken,
                            final String clientIp,
                            final String userAgent) {
        final Instant now = Instant.now(clock);
        // Fingerprint protection: log every attempt before deciding
        // outcome so a timing attack can't infer whether the flow is
        // configured from the audit side.
        audit.append(new AuditEvent(EVENT_ATTEMPTED,
                AuditEvent.Outcome.SUCCESS, null, null, clientIp, userAgent,
                Map.of("enabled", String.valueOf(enabled()))), now);
        if (!enabled()) {
            return Outcome.disabled();
        }
        final Path tokenPath = Path.of(props.breakGlass().tokenPath());
        if (!Files.isRegularFile(tokenPath)) {
            auditDeny(clientIp, userAgent, "TOKEN_FILE_ABSENT", now);
            return Outcome.denied("TOKEN_FILE_ABSENT");
        }
        final String expected;
        try {
            expected = Files.readString(tokenPath, StandardCharsets.UTF_8).trim();
        } catch (IOException ex) {
            auditDeny(clientIp, userAgent, "TOKEN_FILE_UNREADABLE", now);
            LOG.warn("break-glass token file unreadable: {}", ex.getMessage());
            return Outcome.denied("TOKEN_FILE_UNREADABLE");
        }
        if (expected.isEmpty()
                || !constantTimeEquals(expected, submittedToken)) {
            auditDeny(clientIp, userAgent, "TOKEN_MISMATCH", now);
            return Outcome.denied("TOKEN_MISMATCH");
        }
        final Optional<EdgeUser> target = resolveRecoveryTarget();
        if (target.isEmpty()) {
            auditDeny(clientIp, userAgent, "NO_ADMIN_FOUND", now);
            return Outcome.noAdmin();
        }
        final EdgeUser admin = target.get();
        // Rotate verifier + ensure admin role + re-enable. We force
        // the role set to include ADMIN even if an operator script
        // stripped it accidentally — recovery needs an admin at the
        // other end.
        final String newPassword = generatePassword();
        final String verifier = hasher.hash(newPassword);
        final EnumSet<EdgeRole> roles = new HashSet<>(admin.roles())
                .stream().collect(java.util.stream.Collectors
                        .toCollection(() -> EnumSet.noneOf(EdgeRole.class)));
        roles.add(EdgeRole.ADMIN);
        users.upsert(new EdgeUser(
                admin.userId(),
                admin.username(),
                admin.displayName(),
                admin.origin(),
                admin.externalUid(),
                false,
                roles,
                admin.createdAt(),
                now
        ), verifier);
        // Delete the token file so a leaked response can't be
        // replayed without fresh host-level access.
        try {
            Files.deleteIfExists(tokenPath);
        } catch (IOException ex) {
            // Non-fatal: the admin password is already rotated. Log
            // loudly so an operator notices and cleans up manually.
            LOG.warn("break-glass token file could not be deleted: {}",
                    ex.getMessage());
        }
        audit.append(new AuditEvent(EVENT_SUCCESS,
                AuditEvent.Outcome.SUCCESS, null, admin.userId(),
                clientIp, userAgent,
                Map.of("username", admin.username(),
                        "origin", admin.origin().name())), now);
        LOG.warn("BREAK_GLASS recovered admin '{}' from ip={}",
                PiiMasking.maskUsername(admin.username()),
                clientIp == null ? "unknown" : clientIp);
        return Outcome.success(admin.username(), newPassword);
    }

    private Optional<EdgeUser> resolveRecoveryTarget() {
        final String explicit = props.breakGlass().adminUsername();
        if (explicit != null && !explicit.isBlank()) {
            final var hit = users.findByUsername(explicit.toLowerCase(Locale.ROOT));
            if (hit.isPresent()) {
                return hit;
            }
        }
        final String fromBootstrap = props.bootstrap().adminUsername();
        if (fromBootstrap != null && !fromBootstrap.isBlank()) {
            final var hit = users.findByUsername(fromBootstrap.toLowerCase(Locale.ROOT));
            if (hit.isPresent()) {
                return hit;
            }
        }
        return users.findOldestByRole(EdgeRole.ADMIN);
    }

    private void auditDeny(final String ip, final String ua,
                             final String reason, final Instant now) {
        audit.append(new AuditEvent(EVENT_DENIED,
                AuditEvent.Outcome.DENIED, null, null, ip, ua,
                Map.of("reason", reason)), now);
    }

    /** Constant-time compare — critical: attackers who can POST
     *  guessed tokens shouldn't learn prefix match length from
     *  response timing. {@code null} and length-mismatch always
     *  short-circuit but still consume no-op work to flatten time. */
    static boolean constantTimeEquals(final String expected, final String actual) {
        final String a = expected == null ? "" : expected;
        final String b = actual == null ? "" : actual;
        final byte[] x = a.getBytes(StandardCharsets.UTF_8);
        final byte[] y = b.getBytes(StandardCharsets.UTF_8);
        int result = x.length ^ y.length;
        final int n = Math.min(x.length, y.length);
        for (int i = 0; i < n; i++) {
            result |= x[i] ^ y[i];
        }
        return result == 0;
    }

    /** 24 chars of URL-safe base64. ~144 bits of entropy. */
    private String generatePassword() {
        final byte[] bytes = new byte[18];
        rand.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Outcome of a break-glass attempt. */
    public sealed interface Outcome {

        static Outcome success(final String username, final String password) {
            return new Success(username, password);
        }
        static Outcome denied(final String reason) {
            return new Denied(reason);
        }
        static Outcome disabled() {
            return DisabledHolder.INSTANCE;
        }
        static Outcome noAdmin() {
            return NoAdminHolder.INSTANCE;
        }

        record Success(String username, String password) implements Outcome { }
        record Denied(String reason) implements Outcome { }
        /** Flow is not enabled on this appliance. */
        final class Disabled implements Outcome { }
        /** No admin row was found to recover. */
        final class NoAdmin implements Outcome { }
    }

    private static final class DisabledHolder {
        static final Outcome.Disabled INSTANCE = new Outcome.Disabled();
        private DisabledHolder() { }
    }

    private static final class NoAdminHolder {
        static final Outcome.NoAdmin INSTANCE = new Outcome.NoAdmin();
        private NoAdminHolder() { }
    }
}
