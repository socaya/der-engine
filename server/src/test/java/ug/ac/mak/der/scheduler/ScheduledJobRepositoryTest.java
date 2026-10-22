package ug.ac.mak.der.scheduler;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
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
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ScheduledJobRepositoryTest {

    @Test
    void insertStartQuery() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class), eq("JOB"), eq("SCHEDULED")))
                .thenReturn(5L);
        assertThat(new ScheduledJobRepository(jdbc).insertStart("JOB", "SCHEDULED")).isEqualTo(5L);
    }

    @Test
    void markSuccess() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new ScheduledJobRepository(jdbc).markSuccess(1L, 100L, "{}");
        verify(jdbc).update(anyString(), eq(100L), eq("{}"), eq(1L));
    }

    @Test
    void markFailure() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        new ScheduledJobRepository(jdbc).markFailure(1L, 100L, "{}");
        verify(jdbc).update(anyString(), eq(100L), eq("{}"), eq(1L));
    }

    @Test
    void findRecentCapsAndFloors() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyInt())).thenReturn(List.of());
        new ScheduledJobRepository(jdbc).findRecent(10_000);
        new ScheduledJobRepository(jdbc).findRecent(0);
        new ScheduledJobRepository(jdbc).findRecent(10);
    }

    @Test
    void findRecentForJobCapsAndFloors() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), anyString(), anyInt()))
                .thenReturn(List.of());
        new ScheduledJobRepository(jdbc).findRecentForJob("J", 10_000);
        new ScheduledJobRepository(jdbc).findRecentForJob("J", 0);
    }

    @Test
    void rowMapperHandlesNullFinishedAndDuration() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getLong("run_id")).thenReturn(1L);
        when(rs.getString("job_name")).thenReturn("JOB");
        when(rs.getTimestamp("started_at")).thenReturn(Timestamp.from(Instant.now()));
        when(rs.getTimestamp("finished_at")).thenReturn(null);
        when(rs.getString("outcome")).thenReturn("STARTED");
        when(rs.getObject("duration_ms")).thenReturn(null);
        when(rs.getString("detail")).thenReturn(null);
        when(rs.getString("triggered_by")).thenReturn("SCHEDULED");
        final ArgumentCaptor<RowMapper<ScheduledJobRun>> cap = ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.query(anyString(), cap.capture(), anyInt())).thenAnswer(inv ->
                List.of(cap.getValue().mapRow(rs, 1)));
        final var runs = new ScheduledJobRepository(jdbc).findRecent(10);
        assertThat(runs.get(0).finishedAt()).isNull();
        assertThat(runs.get(0).durationMs()).isNull();
    }
}
