package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 02 authentication service.
 *
 * <p>Signing in is a <strong>local</strong> operation; it does not call
 * DHIS2. The verifier is produced during user provisioning (via
 * {@link PasswordHasher}) and stored in {@code edge_credential}. This is the
 * guarantee that supports FR-02-01 "offline sign-in for eligible users".</p>
 *
 * <p>Rate limiting is applied in {@link AuthenticationService#signIn} before
 * password verification so a brute-forcer gets no password-oracle timing.
 * The service always calls {@link PasswordHasher#verify} even on an unknown
 * username (with a dummy verifier) to keep the response time flat.</p>
 */
@Service
public class AuthenticationService {

    /**
     * Dummy Argon2id verifier produced from "unknown-user" with the standard
     * encoder parameters. Used to flatten response time on username-not-found;
     * verification is forced through the same code path.
     *
     * <p>Hard-coded on purpose: regenerating on every call would run the
     * expensive hash twice per sign-in.</p>
     */
    static final String DUMMY_VERIFIER =
            "$argon2id$v=19$m=65536,t=3,p=1$ZmFrZXNhbHRmYWtlc2FsdA$u5xZ3Vqtzb10IujQi7IY2d9MJjbfnBr2DIImQyIEefg";

    private final EdgeUserRepository users;
    private final EdgeSessionRepository sessions;
    private final SecurityAuditRepository audit;
    private final PasswordHasher hasher;
    private final SessionIssuer sessionIssuer;
    private final RateLimiter rateLimiter;
    private final SecurityProperties props;
    private final Clock clock;

    public AuthenticationService(final EdgeUserRepository users,
                                 final EdgeSessionRepository sessions,
                                 final SecurityAuditRepository audit,
                                 final PasswordHasher hasher,
                                 final SessionIssuer sessionIssuer,
                                 final RateLimiter rateLimiter,
                                 final SecurityProperties props,
                                 final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
        this.sessionIssuer = Objects.requireNonNull(sessionIssuer, "sessionIssuer");
        this.rateLimiter = Objects.requireNonNull(rateLimiter, "rateLimiter");
        this.props = Objects.requireNonNull(props, "props");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Transactional
    public SignInOutcome signIn(final String username, final String password, final String clientIp,
                                final String userAgent) {
        final Instant now = Instant.now(clock);
        final String normalisedUsername = username == null ? "" : username.strip().toLowerCase(java.util.Locale.ROOT);
        if (!rateLimiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, clientIp, props.signIn().rateLimitPerIpPerMinute())
                || !rateLimiter.tryAcquire(RateLimiter.Scope.SIGN_IN_USER, normalisedUsername,
                        props.signIn().rateLimitPerUserPerMinute())) {
            audit.append(new AuditEvent(
                    "SIGN_IN_RATE_LIMITED",
                    AuditEvent.Outcome.DENIED,
                    null, null, clientIp, userAgent,
                    Map.of("username", normalisedUsername)
            ), now);
            return SignInOutcome.rateLimited();
        }

        final Optional<EdgeUser> maybeUser = users.findByUsername(normalisedUsername);
        final String verifier = maybeUser.flatMap(u -> users.findVerifier(u.userId())).orElse(DUMMY_VERIFIER);
        final boolean passwordMatches = hasher.verify(password, verifier);
        final EdgeUser user = maybeUser.orElse(null);

        if (user == null || !passwordMatches || user.disabled()) {
            audit.append(new AuditEvent(
                    "SIGN_IN_FAILURE",
                    AuditEvent.Outcome.DENIED,
                    null,
                    user == null ? null : user.userId(),
                    clientIp, userAgent,
                    Map.of(
                            "username", normalisedUsername,
                            "reason", user == null ? "USER_NOT_FOUND"
                                    : user.disabled() ? "USER_DISABLED"
                                    : "BAD_PASSWORD")
            ), now);
            return SignInOutcome.invalidCredentials();
        }

        final String rawToken = sessionIssuer.issueToken();
        final EdgeSession session = sessions.insert(new EdgeSession(
                UUID.randomUUID(),
                user.userId(),
                sessionIssuer.hash(rawToken),
                now,
                now,
                now.plus(ttl()),
                null,
                clientIp,
                userAgent
        ));
        audit.append(new AuditEvent(
                "SIGN_IN_SUCCESS",
                AuditEvent.Outcome.SUCCESS,
                user.userId(), user.userId(),
                clientIp, userAgent,
                Map.of("sessionId", session.sessionId().toString())
        ), now);
        return SignInOutcome.success(user, session, rawToken);
    }

    @Transactional
    public void signOut(final UUID sessionId, final UUID actorUserId, final String clientIp,
                        final String userAgent) {
        final Instant now = Instant.now(clock);
        sessions.revoke(sessionId, now);
        audit.append(new AuditEvent(
                "SIGN_OUT",
                AuditEvent.Outcome.SUCCESS,
                actorUserId, actorUserId,
                clientIp, userAgent,
                Map.of("sessionId", sessionId.toString())
        ), now);
    }

    private Duration ttl() {
        return props.session().ttl();
    }

    /** Returned by {@link #signIn}. One of three disjoint cases. */
    public sealed interface SignInOutcome permits
            SignInOutcome.Success, SignInOutcome.InvalidCredentials, SignInOutcome.RateLimited {

        static SignInOutcome success(final EdgeUser user, final EdgeSession session, final String rawToken) {
            return new Success(user, session, rawToken);
        }

        static SignInOutcome invalidCredentials() {
            return InvalidCredentialsHolder.INSTANCE;
        }

        static SignInOutcome rateLimited() {
            return RateLimitedHolder.INSTANCE;
        }

        record Success(EdgeUser user, EdgeSession session, String rawToken) implements SignInOutcome { }

        /** The username did not exist or the password did not match. */
        final class InvalidCredentials implements SignInOutcome { }

        /** The sign-in attempt was throttled before verification. */
        final class RateLimited implements SignInOutcome { }
    }

    private static final class InvalidCredentialsHolder {
        static final SignInOutcome.InvalidCredentials INSTANCE = new SignInOutcome.InvalidCredentials();
        private InvalidCredentialsHolder() { }
    }

    private static final class RateLimitedHolder {
        static final SignInOutcome.RateLimited INSTANCE = new SignInOutcome.RateLimited();
        private RateLimitedHolder() { }
    }
}
