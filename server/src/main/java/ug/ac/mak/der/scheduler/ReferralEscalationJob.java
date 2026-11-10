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
import ug.ac.mak.der.sync.policy.SyncPolicyService;
import org.springframework.beans.factory.annotation.Autowired;

import ug.ac.mak.der.workflows.referral.ReferralEscalationService;

/**
 * Phase 10.3.2 — Quartz job that ticks the referral escalation
 * scan once per cron fire (default every 5 min).
 */
@DisallowConcurrentExecution
public class ReferralEscalationJob implements Job {

    public static final String JOB_NAME = "REFERRAL_ESCALATION";

    private static final Logger LOG = LoggerFactory.getLogger(ReferralEscalationJob.class);

    @Autowired(required = false) private ReferralEscalationService escalation;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;
    @Autowired(required = false) private SyncPolicyService policy;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank() ? "SCHEDULED" : trigger;
        if (!JobPolicyGate.shouldRun(policy, "REFERRAL_ESCALATION", triggeredBy)) {
            return;
        }
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            if (escalation == null) {
                if (runs != null) {
                    runs.markSuccess(runId, 0, write(Map.of(
                            "note", "ReferralEscalationService bean not wired; skipping")));
                }
                return;
            }
            final ReferralEscalationService.EscalationReport report = escalation.escalateOnce();
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                final Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("scanned", report.scanned());
                detail.put("escalated", report.escalated());
                detail.put("raceSkipped", report.raceSkipped());
                runs.markSuccess(runId, duration, write(detail));
            }
        } catch (Exception ex) {
            LOG.warn("ReferralEscalationJob failed: {}", ex.getMessage());
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
