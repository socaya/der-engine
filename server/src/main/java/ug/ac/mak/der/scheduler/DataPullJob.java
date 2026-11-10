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

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.sync.policy.SyncPolicyService;
import ug.ac.mak.der.workflows.pull.DataPullService;

/**
 * Phase 09.5 — Quartz job that drives the ADR-0034 inbound data
 * puller every N minutes.
 *
 * <p>Runs {@link DataPullService#pullAll(String)} against the
 * currently-bound org unit. Short-circuits if the binding is
 * missing (fresh install, pre-ADR-0015), delegating the
 * reachability-gate check to {@code DataPullService} itself. Writes
 * a run row to {@link ScheduledJobRepository} so operators can see
 * when the puller last ticked, what it did, and any errors.</p>
 */
@DisallowConcurrentExecution
public class DataPullJob implements Job {

    public static final String JOB_NAME = "DATA_PULL";

    private static final Logger LOG = LoggerFactory.getLogger(DataPullJob.class);

    @Autowired(required = false) private DataPullService pulls;
    @Autowired(required = false) private OrgUnitBindingService binding;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;
    @Autowired(required = false) private SyncPolicyService policy;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final String trigger = context.getMergedJobDataMap().getString("triggeredBy");
        final String triggeredBy = trigger == null || trigger.isBlank() ? "SCHEDULED" : trigger;
        if (!JobPolicyGate.shouldRun(policy, "DATA_PULL", triggeredBy)) {
            return;
        }
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, triggeredBy);
        try {
            if (pulls == null) {
                if (runs != null) {
                    runs.markSuccess(runId, 0, write(Map.of(
                            "note", "DataPullService bean not wired; skipping")));
                }
                return;
            }
            final EdgeOrgUnitBinding bind = binding == null ? null : binding.current();
            if (bind == null || !bind.isBound()) {
                if (runs != null) {
                    runs.markSuccess(runId, 0, write(Map.of(
                            "note", "no org-unit binding; nothing to pull")));
                }
                return;
            }
            final DataPullService.PullOutcome out = pulls.pullAll(bind.orgUnitId());
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                final Map<String, Object> detail = new LinkedHashMap<>();
                detail.put("orgUnitUid", out.orgUnitUid());
                detail.put("aggregatePulled", out.aggregatePulled());
                detail.put("eventsPulled", out.eventsPulled());
                detail.put("trackerPulled", out.trackerPulled());
                detail.put("conflictsRaised", out.conflictsRaised());
                if (out.note() != null) {
                    detail.put("note", out.note());
                }
                runs.markSuccess(runId, duration, write(detail));
            }
        } catch (Exception ex) {
            LOG.warn("DataPullJob failed: {}", ex.getMessage());
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
