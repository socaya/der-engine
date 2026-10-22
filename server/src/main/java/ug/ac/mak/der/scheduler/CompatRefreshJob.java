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

import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;

@DisallowConcurrentExecution
public class CompatRefreshJob implements Job {

    static final String JOB_NAME = "COMPAT_PROBE_REFRESH";

    private static final Logger LOG = LoggerFactory.getLogger(CompatRefreshJob.class);

    @Autowired(required = false) private Dhis2CompatibilityEngine engine;
    @Autowired(required = false) private ScheduledJobRepository runs;
    @Autowired(required = false) private ObjectMapper mapper;

    @Override
    public void execute(final JobExecutionContext context) throws JobExecutionException {
        final long t0 = System.nanoTime();
        final Long runId = runs == null ? null : runs.insertStart(JOB_NAME, "SCHEDULED");
        try {
            final var snapshot = engine.refresh(null);
            final long duration = (System.nanoTime() - t0) / 1_000_000L;
            if (runs != null) {
                runs.markSuccess(runId, duration, write(Map.of(
                        "profileName", snapshot.profileName(),
                        "centralVersion", snapshot.centralVersion(),
                        "probeReachable", snapshot.probeReachable())));
            }
        } catch (Exception ex) {
            LOG.warn("CompatRefreshJob failed: {}", ex.getMessage());
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
