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

import ug.ac.mak.der.workflows.journal.CentralRejectedReaperService;

/** SM-4d — Quartz tick that flips CENTRAL_REJECTED rows past
 *  the cool-down window back to PENDING, one chance per row. */
@DisallowConcurrentExecution
public class CentralRejectedReaperJob implements Job {

    public static final String JOB_NAME = "CENTRAL_REJECTED_REAP";

    private static final Logger LOG =
            LoggerFactory.getLogger(CentralRejectedReaperJob.class);

    @Autowired(required = false) private CentralRejectedReaperService reaper;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank()
                ? "SCHEDULED" : trigger;
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            final int flipped = reaper == null ? 0 : reaper.sweep();
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markSuccess(runId, duration, write(Map.of("flipped", flipped)));
            }
        } catch (Exception ex) {
            LOG.warn("CentralRejectedReaperJob failed: {}", ex.getMessage());
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
