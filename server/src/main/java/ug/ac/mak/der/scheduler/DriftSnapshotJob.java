package ug.ac.mak.der.scheduler;

import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import ug.ac.mak.der.sync.drift.DriftDetectionService;

@DisallowConcurrentExecution
public class DriftSnapshotJob implements Job {

    static final String JOB_NAME = "DRIFT_SNAPSHOT";

    private static final Logger LOG = LoggerFactory.getLogger(DriftSnapshotJob.class);

    @Autowired(required = false) private DriftDetectionService drift;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, "SCHEDULED");
        try {
            final var report = drift.recordLatestDelta("SCHEDULED");
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markSuccess(runId, duration, write(Map.of(
                        "snapshotFrom", report.snapshotFrom(),
                        "snapshotTo", report.snapshotTo())));
            }
        } catch (Exception ex) {
            LOG.warn("DriftSnapshotJob failed: {}", ex.getMessage());
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markFailure(runId, duration, write(Map.of(
                        "error", ex.getClass().getSimpleName(),
                        "message", String.valueOf(ex.getMessage()))));
            }
            throw new JobExecutionException(ex);
        }
    }

    private String write(final Object o) {
        if (mapper == null) {
            return "{}";
        }
        try {
            return mapper.writeValueAsString(o);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }
}
