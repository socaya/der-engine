package ug.ac.mak.der.scheduler;

import java.time.Instant;
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

import ug.ac.mak.der.orgunit.ScopeAuditService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * §2.3.116 R-AM — periodic warning job that detects data captured
 * outside the edge's bound OU subtree.
 *
 * <p>Mirrors the {@link JournalDrainJob} pattern: declared as a
 * {@link JobDetail @Bean} in {@code SchedulerConfig}; executions
 * logged to {@code scheduled_job_run}. On each run:</p>
 *
 * <ol>
 *   <li>Calls {@link ScopeAuditService#audit(int)} with no samples
 *       (count-only).</li>
 *   <li>If {@code total > 0}, writes a {@code SCOPE_DRIFT_DETECTED}
 *       entry to {@link SecurityAuditRepository} with the per-type
 *       counts. Operators can see the oldest unresolved drift via
 *       the audit stream (first-seen = oldest {@code SCOPE_DRIFT_*}
 *       event); the "sustained ≥1h" semantic emerges from that
 *       history.</li>
 *   <li>If {@code total == 0} after a prior run with drift, emits
 *       {@code SCOPE_DRIFT_CLEARED} so the stream records the
 *       recovery.</li>
 * </ol>
 */
@DisallowConcurrentExecution
public class ScopeDriftJob implements Job {

    public static final String JOB_NAME = "SCOPE_DRIFT_AUDIT";

    private static final Logger LOG = LoggerFactory.getLogger(ScopeDriftJob.class);

    @Autowired(required = false) private ScopeAuditService audit;
    @Autowired(required = false) private SecurityAuditRepository security;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        if (audit == null || security == null) {
            LOG.debug("ScopeDriftJob skipped — audit or security repo unavailable");
            return;
        }
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank() ? "SCHEDULED" : trigger;
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            final var snap = audit.audit(0);
            final int total = snap.total();
            final Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("boundOrgUnitId", snap.boundOrgUnitId());
            detail.put("total",          total);
            detail.put("countsByEntityType", snap.countsByEntityType());

            if (total > 0) {
                final Map<String, Object> attrs = new LinkedHashMap<>();
                attrs.put("total", String.valueOf(total));
                attrs.put("boundOrgUnitId",
                        snap.boundOrgUnitId() == null ? "<unbound>" : snap.boundOrgUnitId());
                snap.countsByEntityType().forEach((k, v) ->
                        attrs.put("count_" + k, String.valueOf(v)));
                security.append(new AuditEvent(
                        "SCOPE_DRIFT_DETECTED",
                        AuditEvent.Outcome.SUCCESS,
                        null, null, null, null, attrs),
                        Instant.now());
                detail.put("alert", "SCOPE_DRIFT_DETECTED");
            } else {
                detail.put("alert", "NONE");
            }

            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markSuccess(runId, duration, write(detail));
            }
        } catch (RuntimeException ex) {
            LOG.warn("ScopeDriftJob failed: {}", ex.getMessage());
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markFailure(runId, duration, write(Map.of(
                        "error",   ex.getClass().getSimpleName(),
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
