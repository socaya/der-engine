package ug.ac.mak.der.scheduler;

import java.util.LinkedHashMap;
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

import ug.ac.mak.der.workflows.journal.JournalWorker;

/** Phase 04: Quartz job that drives the journal worker (ADR-0010). */
@DisallowConcurrentExecution
public class JournalDrainJob implements Job {

    public static final String JOB_NAME = "JOURNAL_WORKER_DRAIN";

    private static final Logger LOG = LoggerFactory.getLogger(JournalDrainJob.class);

    @Autowired(required = false) private JournalWorker worker;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, "SCHEDULED");
        try {
            final JournalWorker.DrainOutcome out = worker.drainBatch();
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                final Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("picked", out.picked());
                detail.put("accepted", out.accepted());
                detail.put("rejected", out.rejected());
                detail.put("retryable", out.retryable());
                detail.put("conflicts", out.conflicts());
                if (out.byType() != null && !out.byType().isEmpty()) {
                    detail.put("byType", out.byType());
                }
                runs.markSuccess(runId, duration, write(detail));
            }
        } catch (Exception ex) {
            LOG.warn("JournalDrainJob failed: {}", ex.getMessage());
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
