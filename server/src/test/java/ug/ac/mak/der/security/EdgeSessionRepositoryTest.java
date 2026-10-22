package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class EdgeSessionRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-21T00:00:00Z");

    @Test
    void insertEmitsAllColumns() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), UUID.randomUUID(), "h", NOW, NOW,
                NOW.plusSeconds(60), null, "1.2.3.4", "ua");
        new EdgeSessionRepository(jdbc).insert(s);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO der.edge_session"),
                eq(s.sessionId()), eq(s.userId()), eq("h"), any(Timestamp.class), any(Timestamp.class),
                any(Timestamp.class), eq((Object) null), eq("1.2.3.4"), eq("ua"));
    }

    @Test
    void insertCarriesRevokedAtWhenPresent() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), UUID.randomUUID(), "h", NOW, NOW,
                NOW.plusSeconds(60), NOW.plusSeconds(10), null, null);
        new EdgeSessionRepository(jdbc).insert(s);
        verify(jdbc).update(anyString(), eq(s.sessionId()), eq(s.userId()), eq("h"), any(Timestamp.class),
                any(Timestamp.class), any(Timestamp.class), any(Timestamp.class), eq((Object) null), eq((Object) null));
    }

    @Test
    void findByTokenHashNullOrBlankIsEmpty() {
        final EdgeSessionRepository repo = new EdgeSessionRepository(mock(JdbcTemplate.class));
        assertThat(repo.findByTokenHash(null)).isEmpty();
        assertThat(repo.findByTokenHash("")).isEmpty();
    }

    @Test
    void findByTokenHashReturnsOptionalEmptyOnMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("h")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new EdgeSessionRepository(jdbc).findByTokenHash("h")).isEmpty();
    }

    @Test
    void findByTokenHashHydratesRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("session_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getObject("user_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("token_hash")).thenReturn("h");
        when(rs.getTimestamp("issued_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("last_seen_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("expires_at")).thenReturn(Timestamp.from(NOW.plusSeconds(60)));
        when(rs.getTimestamp("revoked_at")).thenReturn(null);
        when(rs.getString("client_ip")).thenReturn("1.1.1.1");
        when(rs.getString("user_agent")).thenReturn("UA");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("h")))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));

        assertThat(new EdgeSessionRepository(jdbc).findByTokenHash("h")).isPresent();
    }

    @Test
    void findByTokenHashHydratesRevokedRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("session_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getObject("user_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("token_hash")).thenReturn("h");
        when(rs.getTimestamp("issued_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("last_seen_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("expires_at")).thenReturn(Timestamp.from(NOW.plusSeconds(60)));
        when(rs.getTimestamp("revoked_at")).thenReturn(Timestamp.from(NOW.plusSeconds(5)));
        when(rs.getString("client_ip")).thenReturn(null);
        when(rs.getString("user_agent")).thenReturn(null);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("h")))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));

        final EdgeSession s = new EdgeSessionRepository(jdbc).findByTokenHash("h").orElseThrow();
        assertThat(s.revokedAt()).isNotNull();
    }

    @Test
    void touchRunsUpdate() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID sid = UUID.randomUUID();
        new EdgeSessionRepository(jdbc).touch(sid, NOW);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("last_seen_at"), any(Timestamp.class), eq(sid));
    }

    @Test
    void revokeAndRevokeAllForUserCompileTheCorrectSql() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final UUID sid = UUID.randomUUID();
        final UUID uid = UUID.randomUUID();
        when(jdbc.update(anyString(), any(Timestamp.class), eq(uid))).thenReturn(3);
        new EdgeSessionRepository(jdbc).revoke(sid, NOW);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("revoked_at IS NULL"),
                any(Timestamp.class), eq(sid));

        assertThat(new EdgeSessionRepository(jdbc).revokeAllForUser(uid, NOW)).isEqualTo(3);
    }
}
