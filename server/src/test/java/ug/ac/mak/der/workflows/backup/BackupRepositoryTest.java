package ug.ac.mak.der.workflows.backup;

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
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class BackupRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private BackupRun pending() {
        return new BackupRun(null, NOW, UUID.randomUUID(), BackupRun.Kind.FULL,
                BackupRun.Status.REQUESTED, null, null, null, null, null, null, null);
    }

    @Test
    void insertAssignsIdFromReturning() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any(), any()))
                .thenReturn(42L);
        final BackupRun saved = new BackupRepository(jdbc).insert(pending());
        assertThat(saved.runId()).isEqualTo(42L);
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(99L)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new BackupRepository(jdbc).findById(99L)).isEmpty();
    }

    @Test
    void findRecentCaps() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(50))).thenReturn(List.of());
        assertThat(new BackupRepository(jdbc).findRecent(50)).isEmpty();
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(50));
    }

    @Test
    void findRecentClampsLow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(1))).thenReturn(List.of());
        new BackupRepository(jdbc).findRecent(-5);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(1));
    }

    @Test
    void findRecentClampsHigh() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(200))).thenReturn(List.of());
        new BackupRepository(jdbc).findRecent(999);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(200));
    }

    @Test
    void findByStatusDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("REQUESTED"), eq(5)))
                .thenReturn(List.of());
        new BackupRepository(jdbc).findByStatus(BackupRun.Status.REQUESTED, 5);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq("REQUESTED"), eq(5));
    }

    @Test
    void markStartedPassesVersion() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("v16.1"), eq(1L))).thenReturn(1);
        assertThat(new BackupRepository(jdbc).markStarted(1L, "v16.1")).isEqualTo(1);
    }

    @Test
    void markSuccessPassesAll() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("/p"), eq(100L), eq("k"), eq(2L))).thenReturn(1);
        assertThat(new BackupRepository(jdbc).markSuccess(2L, "/p", 100L, "k")).isEqualTo(1);
    }

    @Test
    void markFailedPassesMessage() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("boom"), eq(3L))).thenReturn(1);
        assertThat(new BackupRepository(jdbc).markFailed(3L, "boom")).isEqualTo(1);
    }

    @Test
    void rowMapperReadsAllColumns() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("run_id")).thenReturn(7L);
        when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
        final UUID u = UUID.randomUUID();
        when(rs.getObject("requested_by")).thenReturn(u);
        when(rs.getString("kind")).thenReturn("FULL");
        when(rs.getString("status")).thenReturn("SUCCESS");
        when(rs.getString("message")).thenReturn(null);
        when(rs.getString("archive_path")).thenReturn("/arc");
        when(rs.getObject("archive_bytes")).thenReturn(500L);
        when(rs.getString("remote_key")).thenReturn("k");
        when(rs.getTimestamp("started_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getTimestamp("finished_at")).thenReturn(null);
        when(rs.getString("pg_dump_version")).thenReturn("v16");

        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(7L)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));

        final BackupRun row = new BackupRepository(jdbc).findById(7L).orElseThrow();
        assertThat(row.runId()).isEqualTo(7L);
        assertThat(row.archivePath()).isEqualTo("/arc");
        assertThat(row.archiveBytes()).isEqualTo(500L);
        assertThat(row.remoteKey()).isEqualTo("k");
        assertThat(row.pgDumpVersion()).isEqualTo("v16");
        assertThat(row.startedAt()).isEqualTo(NOW);
        assertThat(row.finishedAt()).isNull();
    }
}
