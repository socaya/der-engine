package ug.ac.mak.der.security;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Server-side record of a DER session. The client holds the raw token in a
 * cookie; DER only stores its SHA-256 hash so a database compromise does not
 * leak live tokens.
 */
public record EdgeSession(
        UUID sessionId,
        UUID userId,
        String tokenHash,
        Instant issuedAt,
        Instant lastSeenAt,
        Instant expiresAt,
        Instant revokedAt,
        String clientIp,
        String userAgent
) {

    public EdgeSession {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(userId, "userId");
        Objects.requireNonNull(tokenHash, "tokenHash");
        Objects.requireNonNull(issuedAt, "issuedAt");
        Objects.requireNonNull(lastSeenAt, "lastSeenAt");
        Objects.requireNonNull(expiresAt, "expiresAt");
        if (!expiresAt.isAfter(issuedAt)) {
            throw new IllegalArgumentException("expiresAt must be after issuedAt");
        }
    }

    public boolean isActive(final Instant now) {
        return revokedAt == null && now.isBefore(expiresAt);
    }
}
