package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.scheduler.ScheduledJobRepository;
import ug.ac.mak.der.scheduler.ScheduledJobRun;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(SyncJobsController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SyncJobsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ScheduledJobRepository runs;
    @MockBean Scheduler scheduler;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void listRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/sync/jobs")).andExpect(status().isUnauthorized());
    }

    @Test
    void listReturnsRecent() throws Exception {
        when(runs.findRecent(anyInt())).thenReturn(List.of(new ScheduledJobRun(1L, "JOB",
                Instant.now(), null, ScheduledJobRun.Outcome.STARTED, null, null, "SCHEDULED")));
        mockMvc.perform(get("/edge-api/v1/sync/jobs").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].jobName").value("JOB"));
    }

    @Test
    void triggerRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/sync/jobs/METADATA_SYNC_FULL/trigger")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void triggerUnauthenticated() throws Exception {
        mockMvc.perform(post("/edge-api/v1/sync/jobs/METADATA_SYNC_FULL/trigger"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void triggerUnknownJob() throws Exception {
        when(scheduler.checkExists(any(JobKey.class))).thenReturn(false);
        mockMvc.perform(post("/edge-api/v1/sync/jobs/UNKNOWN/trigger").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void triggerExistingJob() throws Exception {
        when(scheduler.checkExists(any(JobKey.class))).thenReturn(true);
        mockMvc.perform(post("/edge-api/v1/sync/jobs/METADATA_SYNC_FULL/trigger")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isAccepted());
    }
}
