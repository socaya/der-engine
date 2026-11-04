package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.scheduler.ScheduledJobRepository;
import ug.ac.mak.der.scheduler.ScheduledJobRun;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

@WebMvcTest(OperatorMetricsController.class)
@ActiveProfiles("test")
@Import({ TestSecurityConfig.class, OperatorMetricsControllerTest.ClockConfig.class })
class OperatorMetricsControllerTest {

    /** Any instant works — the test asserts relative drift against this fixed point. */
    private static final Instant NOW = Instant.parse("2026-11-04T10:00:00Z");

    @Autowired MockMvc mockMvc;
    @MockBean OperationJournalRepository journal;
    @MockBean ScheduledJobRepository scheduledJobs;
    @MockBean SecurityAuditRepository audit;

    @TestConfiguration
    static class ClockConfig {
        @Bean Clock testClock() { return Clock.fixed(NOW, ZoneOffset.UTC); }
    }

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void clockProbeDisclosesServerTimeZoneAndThreshold() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/metrics/clock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serverEpochMillis").value(NOW.toEpochMilli()))
                .andExpect(jsonPath("$.serverTimeZone").value("Z"))
                .andExpect(jsonPath("$.systemTimeZone").exists())
                .andExpect(jsonPath("$.unsafeDriftMillis").value(60000));
    }

    @Test
    void clockReportBelowThresholdSucceedsSilently() throws Exception {
        /* 10 seconds of drift — within tolerance, no audit event. */
        final long caller = NOW.toEpochMilli() - 10_000L;
        mockMvc.perform(post("/edge-api/v1/admin/metrics/clock/report")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerEpochMillis\":" + caller + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftMillis").value(10000))
                .andExpect(jsonPath("$.unsafe").value(false));
        verify(audit, never()).append(any(), any());
    }

    @Test
    void clockReportAboveThresholdEmitsCLOCK_DRIFT_WARN() throws Exception {
        /* 90 seconds of drift — above the 60s threshold, audit event. */
        final long caller = NOW.toEpochMilli() - 90_000L;
        mockMvc.perform(post("/edge-api/v1/admin/metrics/clock/report")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerEpochMillis\":" + caller
                                + ",\"callerTimeZone\":\"America/Chicago\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.driftMillis").value(90000))
                .andExpect(jsonPath("$.unsafe").value(true));
        verify(audit).append(argThat((AuditEvent e) ->
                        "CLOCK_DRIFT_WARN".equals(e.eventType())
                                && "90000".equals(e.detail().get("driftMillis"))
                                && "America/Chicago".equals(e.detail().get("callerTimeZone"))),
                any());
    }

    @Test
    void clockReportWithoutAuthDoesNotCrash() throws Exception {
        /* Unauthenticated callers can still probe (useful from the
         * sign-in page's clock check) — drift is returned but no
         * audit event is written since there's no actor to attribute. */
        final long caller = NOW.toEpochMilli() - 120_000L;
        mockMvc.perform(post("/edge-api/v1/admin/metrics/clock/report")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"callerEpochMillis\":" + caller + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unsafe").value(true));
        verify(audit, never()).append(any(), any());
    }

    @Test
    void clockReportMissingFieldIsBadRequest() throws Exception {
        mockMvc.perform(post("/edge-api/v1/admin/metrics/clock/report")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CLOCK_REPORT_INVALID"));
    }

    // NFR-20 — operator-visible metrics contract. Every required key
    // MUST be present on every call, even on a fresh install with no
    // jobs run and an empty journal.

    @Test
    void nfr20ContractShapeOnFreshInstall() throws Exception {
        org.mockito.Mockito.when(scheduledJobs.findLastSuccessful())
                .thenReturn(java.util.Optional.empty());
        mockMvc.perform(get("/edge-api/v1/admin/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.health.status").exists())
                .andExpect(jsonPath("$.lastSuccessfulSyncAt").doesNotExist())
                .andExpect(jsonPath("$.queueDepth").value(0))
                .andExpect(jsonPath("$.rejections").value(0))
                .andExpect(jsonPath("$.conflicts").value(0))
                .andExpect(jsonPath("$.journal").exists())
                .andExpect(jsonPath("$.process.uptimeMillis").exists());
    }

    @Test
    void nfr20LastSuccessfulSyncIsExposedWhenAvailable() throws Exception {
        final Instant started = Instant.parse("2026-11-03T10:00:00Z");
        org.mockito.Mockito.when(scheduledJobs.findLastSuccessful())
                .thenReturn(java.util.Optional.of(new ScheduledJobRun(
                        42L, "METADATA_SYNC_FULL", started, started.plusSeconds(10),
                        ScheduledJobRun.Outcome.SUCCESS, 10_000L, "{}",
                        "SCHEDULED")));
        mockMvc.perform(get("/edge-api/v1/admin/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastSuccessfulSyncAt")
                        .value("2026-11-03T10:00:00Z"));
    }

    @Test
    void nfr20RejectionsAndConflictsReflectJournalCounts() throws Exception {
        org.mockito.Mockito.when(journal.countByState(
                ug.ac.mak.der.workflows.aggregate.OperationJournalEntry.State.CENTRAL_REJECTED))
                .thenReturn(3);
        org.mockito.Mockito.when(journal.countByState(
                ug.ac.mak.der.workflows.aggregate.OperationJournalEntry.State.CONFLICT_REVIEW))
                .thenReturn(2);
        mockMvc.perform(get("/edge-api/v1/admin/metrics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejections").value(3))
                .andExpect(jsonPath("$.conflicts").value(2))
                .andExpect(jsonPath("$.health.status").value("UP"));
    }
}
