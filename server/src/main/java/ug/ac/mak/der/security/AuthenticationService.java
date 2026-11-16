package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import ug.ac.mak.der.network.CentralReachabilityGate;

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

    private static final Logger AUTH_LOG = LoggerFactory.getLogger(AuthenticationService.class);

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

    private ObjectProvider<CentralReachabilityGate> gate;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setGate(final ObjectProvider<CentralReachabilityGate> g) {
        this.gate = g;
    }

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
            final String reason = user == null ? "USER_NOT_FOUND"
                : user.disabled() ? "USER_DISABLED" : "BAD_PASSWORD";
            audit.append(new AuditEvent(
                    "SIGN_IN_FAILURE",
                    AuditEvent.Outcome.DENIED,
                    null,
                    user == null ? null : user.userId(),
                    clientIp, userAgent,
                    Map.of(
                            "username", normalisedUsername,
                            "reason", reason)
            ), now);
            // §6 — structured log line fail2ban parses; AUTH_FAIL marker +
            // ip=<HOST> so der-auth.conf filter can ban repeat offenders.
            AUTH_LOG.warn("AUTH_FAIL username={} ip={} reason={}",
                           normalisedUsername,
                           clientIp == null ? "unknown" : clientIp,
                           reason);
            return SignInOutcome.invalidCredentials();
        }

        // FR-02-07 — first-time-offline gate. Password was correct;
        // decide whether the configured policy permits the sign-in.
        if (!firstTimeOfflineAllowed(user)) {
            audit.append(new AuditEvent(
                    "SIGN_IN_FAILURE",
                    AuditEvent.Outcome.DENIED,
                    null, user.userId(),
                    clientIp, userAgent,
                    Map.of(
                            "username", normalisedUsername,
                            "reason", "FIRST_TIME_OFFLINE_DENIED",
                            "origin", user.origin().name(),
                            "policy", props.firstTimeOffline().policy().name())
            ), now);
            AUTH_LOG.warn("AUTH_FAIL username={} ip={} reason=FIRST_TIME_OFFLINE_DENIED "
                            + "origin={} policy={}",
                    normalisedUsername,
                    clientIp == null ? "unknown" : clientIp,
                    user.origin(),
                    props.firstTimeOffline().policy());
            return SignInOutcome.firstTimeOfflineDenied(user);
        }

        // FR-02-06 — offline credential-age gate. A DHIS2-origin
        // user whose last central witness is older than the
        // configured window must come back online. BOOTSTRAP
        // admins and disabled gates bypass. If central is
        // currently REACHABLE we stamp a fresh witness *before*
        // the check so the online path is always allowed to
        // refresh itself.
        final boolean reachable = isCentralReachable();
        if (reachable && user.origin() == EdgeUser.Origin.DHIS2) {
            users.markCentralSyncAt(user.userId(), now);
        }
        if (!offlineCredentialFresh(user, now, reachable)) {
            audit.append(new AuditEvent(
                    "SIGN_IN_FAILURE",
                    AuditEvent.Outcome.DENIED,
                    null, user.userId(),
                    clientIp, userAgent,
                    Map.of(
                            "username", normalisedUsername,
                            "reason", "OFFLINE_CREDENTIAL_EXPIRED",
                            "maxAgeDays",
                                String.valueOf(props.offlineCredential().maxAgeDays()))
            ), now);
            AUTH_LOG.warn("AUTH_FAIL username={} ip={} reason=OFFLINE_CREDENTIAL_EXPIRED",
                    normalisedUsername,
                    clientIp == null ? "unknown" : clientIp);
            return SignInOutcome.offlineCredentialExpired(user);
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

    /**
     * FR-02-07 — resolve whether the user is permitted to sign in
     * right now under the configured first-time-offline policy. The
     * check runs AFTER password verification succeeded; if the
     * answer is false, we treat it as a sign-in failure with a
     * dedicated audit reason so operators can see the gate firing.
     */
    private boolean firstTimeOfflineAllowed(final EdgeUser user) {
        final SecurityProperties.FirstTimeOffline.Policy policy =
                props.firstTimeOffline().policy();
        if (policy == SecurityProperties.FirstTimeOffline.Policy.DISABLED) {
            return true;
        }
        // Prior success anywhere in audit history is the primary
        // "has proven itself" signal — once a user has signed in
        // once (regardless of policy), they're not first-time.
        if (audit.hasEverSignedInSuccessfully(user.userId())) {
            return true;
        }
        return switch (policy) {
            case REQUIRE_ONLINE_FIRST ->
                    user.origin() == EdgeUser.Origin.BOOTSTRAP
                            || user.origin() == EdgeUser.Origin.DHIS2;
            case BOOTSTRAP_ONLY ->
                    user.origin() == EdgeUser.Origin.BOOTSTRAP;
            case DISABLED -> true;
        };
    }

    /**
     * FR-02-06 — is this user allowed to sign in given the offline
     * credential-age policy? Bootstrap users are exempt; DHIS2
     * users whose last central witness exceeds
     * {@code offline-max-age-days} are denied. If central is
     * REACHABLE right now the caller has already stamped a fresh
     * witness upstream so this method sees a current timestamp and
     * answers true — the online path is never blocked.
     */
    private boolean offlineCredentialFresh(final EdgeUser user,
                                              final Instant now,
                                              final boolean centralReachable) {
        if (!props.offlineCredential().enabled()) {
            return true;
        }
        if (user.origin() == EdgeUser.Origin.BOOTSTRAP) {
            return true;
        }
        if (centralReachable) {
            return true;
        }
        final Optional<Instant> witness = users.findLastCentralSyncAt(user.userId());
        if (witness.isEmpty()) {
            // A DHIS2-origin user with no witness at all means they've
            // never signed in online. First-time-offline covers the
            // never-signed-in case; this branch handles the "witnessed
            // once, then the column was wiped" edge — treat as expired.
            return false;
        }
        final long days = ChronoUnit.DAYS.between(witness.get(), now);
        return days < props.offlineCredential().maxAgeDays();
    }

    private boolean isCentralReachable() {
        final CentralReachabilityGate g = gate == null ? null : gate.getIfAvailable();
        if (g == null) {
            return false;
        }
        return g.state() == CentralReachabilityGate.State.REACHABLE;
    }

    /** Returned by {@link #signIn}. One of five disjoint cases. */
    public sealed interface SignInOutcome permits
            SignInOutcome.Success, SignInOutcome.InvalidCredentials,
            SignInOutcome.RateLimited, SignInOutcome.FirstTimeOfflineDenied,
            SignInOutcome.OfflineCredentialExpired {

        static SignInOutcome success(final EdgeUser user, final EdgeSession session, final String rawToken) {
            return new Success(user, session, rawToken);
        }

        static SignInOutcome invalidCredentials() {
            return InvalidCredentialsHolder.INSTANCE;
        }

        static SignInOutcome rateLimited() {
            return RateLimitedHolder.INSTANCE;
        }

        static SignInOutcome firstTimeOfflineDenied(final EdgeUser user) {
            return new FirstTimeOfflineDenied(user);
        }

        static SignInOutcome offlineCredentialExpired(final EdgeUser user) {
            return new OfflineCredentialExpired(user);
        }

        record Success(EdgeUser user, EdgeSession session, String rawToken) implements SignInOutcome { }

        /** The username did not exist or the password did not match. */
        final class InvalidCredentials implements SignInOutcome { }

        /** The sign-in attempt was throttled before verification. */
        final class RateLimited implements SignInOutcome { }

        /**
         * FR-02-07 — password matched but the user has never
         * signed in before and the configured policy requires an
         * approved provisioning method the user doesn't carry.
         */
        record FirstTimeOfflineDenied(EdgeUser user) implements SignInOutcome { }

        /**
         * FR-02-06 — password matched and user is eligible to sign
         * in, but the local credential age window has elapsed. User
         * must come back online for central re-validation.
         */
        record OfflineCredentialExpired(EdgeUser user) implements SignInOutcome { }
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
