package ug.ac.mak.der.scheduler;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ScheduledJobRepository {

    private final JdbcTemplate jdbc;

    public ScheduledJobRepository(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    public Long insertStart(final String jobName, final String triggeredBy) {
        return jdbc.queryForObject(
                "INSERT INTO der.scheduled_job_run (job_name, started_at, outcome, triggered_by) "
                        + "VALUES (?, now(), 'STARTED', ?) RETURNING run_id",
                Long.class, jobName, triggeredBy);
    }

    public void markSuccess(final Long runId, final long durationMs, final String detailJson) {
        jdbc.update(
                "UPDATE der.scheduled_job_run SET finished_at = now(), outcome = 'SUCCESS', "
                        + "duration_ms = ?, detail = CAST(? AS jsonb) WHERE run_id = ?",
                durationMs, detailJson, runId);
    }

    public void markFailure(final Long runId, final long durationMs, final String detailJson) {
        jdbc.update(
                "UPDATE der.scheduled_job_run SET finished_at = now(), outcome = 'FAILED', "
                        + "duration_ms = ?, detail = CAST(? AS jsonb) WHERE run_id = ?",
                durationMs, detailJson, runId);
    }

    public ScheduledJobRun findById(final long runId) {
        final List<ScheduledJobRun> rows = jdbc.query(
                "SELECT run_id, job_name, started_at, finished_at, outcome, duration_ms, "
                        + "detail::text AS detail, triggered_by "
                        + "FROM der.scheduled_job_run WHERE run_id = ?",
                rowMapper(), runId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<ScheduledJobRun> findRecent(final int limit) {
        final int capped = Math.max(1, Math.min(200, limit));
        return jdbc.query(
                "SELECT run_id, job_name, started_at, finished_at, outcome, duration_ms, "
                        + "detail::text AS detail, triggered_by "
                        + "FROM der.scheduled_job_run ORDER BY started_at DESC LIMIT ?",
                rowMapper(), capped);
    }

    public List<ScheduledJobRun> findRecentForJob(final String jobName, final int limit) {
        final int capped = Math.max(1, Math.min(200, limit));
        return jdbc.query(
                "SELECT run_id, job_name, started_at, finished_at, outcome, duration_ms, "
                        + "detail::text AS detail, triggered_by "
                        + "FROM der.scheduled_job_run WHERE job_name = ? "
                        + "ORDER BY started_at DESC LIMIT ?",
                rowMapper(), jobName, capped);
    }

    private static RowMapper<ScheduledJobRun> rowMapper() {
        return (ResultSet rs, int row) -> {
            final Timestamp finishedTs = rs.getTimestamp("finished_at");
            final Long duration = (Long) rs.getObject("duration_ms");
            return new ScheduledJobRun(
                    rs.getLong("run_id"),
                    rs.getString("job_name"),
                    rs.getTimestamp("started_at").toInstant(),
                    finishedTs == null ? null : finishedTs.toInstant(),
                    ScheduledJobRun.Outcome.valueOf(rs.getString("outcome")),
                    duration,
                    rs.getString("detail"),
                    rs.getString("triggered_by"));
        };
    }
}
