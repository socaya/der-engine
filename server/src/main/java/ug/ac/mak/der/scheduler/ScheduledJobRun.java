package ug.ac.mak.der.scheduler;

import java.time.Instant;
import java.util.Objects;

/**
 * One row in {@code der.scheduled_job_run}; a single invocation of a Quartz
 * job with its outcome, duration and structured detail. ADR-0008 §Observability.
 */
public record ScheduledJobRun(
        Long runId,
        String jobName,
        Instant startedAt,
        Instant finishedAt,
        Outcome outcome,
        Long durationMs,
        String detail,
        String triggeredBy
) {

    public ScheduledJobRun {
        Objects.requireNonNull(jobName, "jobName");
        Objects.requireNonNull(startedAt, "startedAt");
        Objects.requireNonNull(outcome, "outcome");
        Objects.requireNonNull(triggeredBy, "triggeredBy");
    }

    public enum Outcome { STARTED, SUCCESS, FAILED, SKIPPED }
}
