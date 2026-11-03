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

import ug.ac.mak.der.workflows.drafts.ScheduledDraftPublishService;

/**
 * E6 — Quartz tick that publishes drafts whose
 * {@code scheduled_publish_at} is past-due. Delegates to
 * {@link ScheduledDraftPublishService#runOnce()}.
 */
@DisallowConcurrentExecution
public class ScheduledDraftPublishJob implements Job {

    public static final String JOB_NAME = "SCHEDULED_DRAFT_PUBLISH";

    private static final Logger LOG = LoggerFactory.getLogger(
            ScheduledDraftPublishJob.class);

    @Autowired(required = false) private ScheduledDraftPublishService service;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank() ? "SCHEDULED" : trigger;
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            final ScheduledDraftPublishService.TickResult result =
                    service == null ? new ScheduledDraftPublishService.TickResult(0, 0, 0, 0)
                                    : service.runOnce();
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            final Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("scanned", result.scanned());
            payload.put("published", result.published());
            payload.put("keptWithConflicts", result.keptWithConflicts());
            payload.put("failed", result.failed());
            if (runs != null) {
                runs.markSuccess(runId, duration, write(payload));
            }
        } catch (Exception ex) {
            LOG.warn("ScheduledDraftPublishJob failed: {}", ex.getMessage());
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
