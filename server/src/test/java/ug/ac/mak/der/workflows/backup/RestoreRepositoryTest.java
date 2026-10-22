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

class RestoreRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private RestoreRun pending(final RestoreRun.Kind kind) {
        return new RestoreRun(null, NOW, UUID.randomUUID(), "src",
                RestoreRun.Status.REQUESTED, null, null, null, null, kind);
    }

    @Test
    void insertAssignsIdFromReturning() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any(), any(), any()))
                .thenReturn(7L);
        assertThat(new RestoreRepository(jdbc).insert(pending(RestoreRun.Kind.LOCAL)).runId())
                .isEqualTo(7L);
    }

    @Test
    void insertWithNullKindSendsNull() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), any(), any(), any(), any(), any(),
                org.mockito.ArgumentMatchers.isNull())).thenReturn(1L);
        assertThat(new RestoreRepository(jdbc).insert(pending(null)).runId()).isEqualTo(1L);
    }

    @Test
    void findByIdEmptyWhenMissing() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(99L)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new RestoreRepository(jdbc).findById(99L)).isEmpty();
    }

    @Test
    void findRecentDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10))).thenReturn(List.of());
        new RestoreRepository(jdbc).findRecent(10);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq(10));
    }

    @Test
    void findByStatusDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("REQUESTED"), eq(3)))
                .thenReturn(List.of());
        new RestoreRepository(jdbc).findByStatus(RestoreRun.Status.REQUESTED, 3);
        verify(jdbc).query(anyString(), any(RowMapper.class), eq("REQUESTED"), eq(3));
    }

    @Test
    void transitions() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("/p"), eq(1L))).thenReturn(1);
        when(jdbc.update(anyString(), eq(2L))).thenReturn(1);
        when(jdbc.update(anyString(), eq("boom"), eq(3L))).thenReturn(1);
        final RestoreRepository repo = new RestoreRepository(jdbc);
        assertThat(repo.markStarted(1L, "/p")).isEqualTo(1);
        assertThat(repo.markSuccess(2L)).isEqualTo(1);
        assertThat(repo.markFailed(3L, "boom")).isEqualTo(1);
    }

    @Test
    void rowMapperReadsAllColumns() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("run_id")).thenReturn(5L);
        when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
        final UUID u = UUID.randomUUID();
        when(rs.getObject("requested_by")).thenReturn(u);
        when(rs.getString("source")).thenReturn("src");
        when(rs.getString("status")).thenReturn("SUCCESS");
        when(rs.getString("message")).thenReturn(null);
        when(rs.getTimestamp("started_at")).thenReturn(null);
        when(rs.getTimestamp("finished_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getString("archive_path")).thenReturn("/arc");
        when(rs.getString("kind")).thenReturn("UPLOAD");

        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(5L)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final RestoreRun r = new RestoreRepository(jdbc).findById(5L).orElseThrow();
        assertThat(r.kind()).isEqualTo(RestoreRun.Kind.UPLOAD);
        assertThat(r.archivePath()).isEqualTo("/arc");
        assertThat(r.startedAt()).isNull();
    }

    @Test
    void rowMapperReadsNullKind() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("run_id")).thenReturn(6L);
        when(rs.getTimestamp("requested_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getObject("requested_by")).thenReturn(UUID.randomUUID());
        when(rs.getString("source")).thenReturn("x");
        when(rs.getString("status")).thenReturn("REQUESTED");
        when(rs.getString("message")).thenReturn(null);
        when(rs.getTimestamp("started_at")).thenReturn(null);
        when(rs.getTimestamp("finished_at")).thenReturn(null);
        when(rs.getString("archive_path")).thenReturn(null);
        when(rs.getString("kind")).thenReturn(null);

        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq(6L)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThat(new RestoreRepository(jdbc).findById(6L).orElseThrow().kind()).isNull();
    }
}
