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

import ug.ac.mak.der.workflows.referral.ReferralInboxScanner;

/** Phase 13 (ADR-0027 alpha.4): polls central for referral candidates. */
@DisallowConcurrentExecution
public class ReferralInboxPollJob implements Job {

    public static final String JOB_NAME = "REFERRAL_INBOX_POLL";

    private static final Logger LOG = LoggerFactory.getLogger(ReferralInboxPollJob.class);

    @Autowired(required = false) private ReferralInboxScanner scanner;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, "SCHEDULED");
        try {
            final ReferralInboxScanner.ScanResult result = scanner == null
                    ? ReferralInboxScanner.ScanResult.UNAVAILABLE
                    : scanner.scanOnce();
            if (runs != null) {
                final long duration = (System.nanoTime() - t0) / 1_000_000L;
                runs.markSuccess(runId, duration, write(Map.of(
                        "outcome", result.outcome().name(),
                        "candidates", result.candidates(),
                        "inserted", result.inserted())));
            }
        } catch (Exception ex) {
            LOG.warn("ReferralInboxPollJob failed: {}", ex.getMessage());
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
