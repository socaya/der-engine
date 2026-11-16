package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolve the {@code DER_SESSION} cookie into an authenticated {@link EdgeUser},
 * or reject the request. Called by the Spring Security filter chain on every
 * guarded request.
 */
@Service
public class SessionValidationService {

    private final EdgeUserRepository users;
    private final EdgeSessionRepository sessions;
    private final SessionIssuer sessionIssuer;
    private final Clock clock;

    private SecurityAuditRepository audit;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setAudit(final SecurityAuditRepository a) {
        this.audit = a;
    }

    public SessionValidationService(final EdgeUserRepository users,
                                    final EdgeSessionRepository sessions,
                                    final SessionIssuer sessionIssuer,
                                    final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.sessionIssuer = Objects.requireNonNull(sessionIssuer, "sessionIssuer");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /**
     * @param rawToken opaque token carried in the DER_SESSION cookie
     * @return the authenticated user when the session is active and the user
     *         is enabled; empty otherwise
     */
    @Transactional
    public Optional<Resolved> resolve(final String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        final String hash = sessionIssuer.hash(rawToken);
        final Optional<EdgeSession> maybeSession = sessions.findByTokenHash(hash);
        if (maybeSession.isEmpty()) {
            return Optional.empty();
        }
        final EdgeSession session = maybeSession.get();
        final Instant now = Instant.now(clock);
        if (!session.isActive(now)) {
            // FR-02-10 — explicit fail-safe decision: an expired or
            // revoked session MUST reject the request, no grace
            // window. Emit an audit event so operators can see
            // whether an expiry-rejection volume spike indicates a
            // clock-drift incident or legitimate inactivity.
            if (audit != null) {
                final String reason = session.revokedAt() != null
                        ? "SESSION_REVOKED" : "SESSION_EXPIRED";
                try {
                    audit.append(new AuditEvent("SESSION_VALIDATION_REJECTED",
                            AuditEvent.Outcome.DENIED,
                            null, session.userId(), null, null,
                            java.util.Map.of(
                                    "sessionId", session.sessionId().toString(),
                                    "reason", reason,
                                    "expiresAt", session.expiresAt().toString())),
                            now);
                } catch (final RuntimeException ignored) {
                    // Rejection must not fail on audit error.
                }
            }
            return Optional.empty();
        }
        final Optional<EdgeUser> maybeUser = users.findById(session.userId());
        if (maybeUser.isEmpty() || maybeUser.get().disabled()) {
            return Optional.empty();
        }
        sessions.touch(session.sessionId(), now);
        return Optional.of(new Resolved(maybeUser.get(), session));
    }

    public record Resolved(EdgeUser user, EdgeSession session) { }
}
