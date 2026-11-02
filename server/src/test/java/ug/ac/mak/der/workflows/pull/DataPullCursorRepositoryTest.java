package ug.ac.mak.der.workflows.pull;

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

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DataPullCursorRepositoryTest {

    @Test
    void findByScopeReturnsEmptyWhenNoRow() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyString()))
                .thenReturn(List.of());
        final var opt = new DataPullCursorRepository(jdbc).findByScope(
                DataPullCursor.EntityType.AGGREGATE, "ou1");
        assertThat(opt).isEmpty();
    }

    @Test
    void findByScopeHydratesRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        final Instant now = Instant.parse("2026-11-02T10:00:00Z");
        when(rs.getString("entity_type")).thenReturn("AGGREGATE");
        when(rs.getString("org_unit_uid")).thenReturn("ou1");
        when(rs.getTimestamp("last_pulled_at")).thenReturn(Timestamp.from(now));
        when(rs.getString("last_cursor")).thenReturn("abc");
        when(rs.getInt("consecutive_failures")).thenReturn(0);
        when(rs.getString("last_error")).thenReturn(null);
        when(rs.getTimestamp("created_at")).thenReturn(Timestamp.from(now));
        when(rs.getTimestamp("updated_at")).thenReturn(Timestamp.from(now));
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyString()))
                .thenAnswer(inv -> List.of(((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1)));
        final var opt = new DataPullCursorRepository(jdbc).findByScope(
                DataPullCursor.EntityType.AGGREGATE, "ou1");
        assertThat(opt).isPresent();
        assertThat(opt.get().lastCursor()).isEqualTo("abc");
    }

    @Test
    void markSuccessUpsertsAndResetsFailureCounter() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final Instant watermark = Instant.parse("2026-11-02T10:00:00Z");
        new DataPullCursorRepository(jdbc).markSuccess(
                DataPullCursor.EntityType.EVENT, "ou1", watermark, "cursorX");
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains(
                        "ON CONFLICT (entity_type, org_unit_uid) DO UPDATE"),
                eq("EVENT"), eq("ou1"),
                any(Timestamp.class), eq("cursorX"));
    }

    @Test
    void markFailureIncrementsCounterOnConflict() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new DataPullCursorRepository(jdbc).markFailure(
                DataPullCursor.EntityType.TRACKER, "ou1", "central responded 502");
        verify(jdbc).update(
                org.mockito.ArgumentMatchers.contains(
                        "consecutive_failures = der.data_pull_cursor.consecutive_failures + 1"),
                eq("TRACKER"), eq("ou1"), eq("central responded 502"));
    }
}
