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

import ug.ac.mak.der.workflows.backup.BackupWorker;
import ug.ac.mak.der.workflows.backup.RestoreWorker;

/** Phase 07 (ADR-0012): drains backup + restore worklists. */
@DisallowConcurrentExecution
public class BackupDrainJob implements Job {

    public static final String JOB_NAME = "BACKUP_RESTORE_DRAIN";

    private static final Logger LOG = LoggerFactory.getLogger(BackupDrainJob.class);

    @Autowired(required = false) private BackupWorker backup;
    @Autowired(required = false) private RestoreWorker restore;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank() ? "SCHEDULED" : trigger;
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            final int b = backup == null ? 0 : backup.drain();
            final int r = restore == null ? 0 : restore.drain();
            if (runs != null) {
                final long duration = (System.nanoTime() - t0) / 1_000_000L;
                runs.markSuccess(runId, duration, write(Map.of(
                        "backupsProcessed", b,
                        "restoresProcessed", r)));
            }
        } catch (Exception ex) {
            LOG.warn("BackupDrainJob failed: {}", ex.getMessage());
            if (runs != null) {
                final long duration = (System.nanoTime() - t0) / 1_000_000L;
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
