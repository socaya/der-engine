package ug.ac.mak.der.security;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** JDBC repository for {@code edge_session}. */
@Repository
public class EdgeSessionRepository {

    private final JdbcTemplate jdbc;

    public EdgeSessionRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public EdgeSession insert(final EdgeSession session) {
        jdbc.update(
                "INSERT INTO der.edge_session "
                        + "(session_id, user_id, token_hash, issued_at, last_seen_at, expires_at, revoked_at, client_ip, user_agent) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS inet), ?)",
                session.sessionId(),
                session.userId(),
                session.tokenHash(),
                Timestamp.from(session.issuedAt()),
                Timestamp.from(session.lastSeenAt()),
                Timestamp.from(session.expiresAt()),
                session.revokedAt() == null ? null : Timestamp.from(session.revokedAt()),
                session.clientIp(),
                session.userAgent()
        );
        return session;
    }

    public Optional<EdgeSession> findByTokenHash(final String tokenHash) {
        if (tokenHash == null || tokenHash.isBlank()) {
            return Optional.empty();
        }
        try {
            final EdgeSession s = jdbc.queryForObject(
                    "SELECT session_id, user_id, token_hash, issued_at, last_seen_at, expires_at, revoked_at, "
                            + "       client_ip::text AS client_ip, user_agent "
                            + "FROM der.edge_session WHERE token_hash = ?",
                    rowMapper(),
                    tokenHash
            );
            return Optional.ofNullable(s);
        } catch (EmptyResultDataAccessException ex) {
            return Optional.empty();
        }
    }

    public void touch(final UUID sessionId, final Instant now) {
        jdbc.update(
                "UPDATE der.edge_session SET last_seen_at = ? WHERE session_id = ?",
                Timestamp.from(now),
                sessionId
        );
    }

    public void revoke(final UUID sessionId, final Instant now) {
        jdbc.update(
                "UPDATE der.edge_session SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL",
                Timestamp.from(now),
                sessionId
        );
    }

    public int revokeAllForUser(final UUID userId, final Instant now) {
        return jdbc.update(
                "UPDATE der.edge_session SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                Timestamp.from(now),
                userId
        );
    }

    private static RowMapper<EdgeSession> rowMapper() {
        return (ResultSet rs, int rowNum) -> new EdgeSession(
                rs.getObject("session_id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("token_hash"),
                rs.getTimestamp("issued_at").toInstant(),
                rs.getTimestamp("last_seen_at").toInstant(),
                rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("revoked_at") == null ? null : rs.getTimestamp("revoked_at").toInstant(),
                rs.getString("client_ip"),
                rs.getString("user_agent")
        );
    }
}
