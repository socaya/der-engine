package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import org.quartz.Scheduler;

import ug.ac.mak.der.workflows.backup.RestoreRepository;
import ug.ac.mak.der.workflows.backup.RestoreRun;

@WebMvcTest(RestoreController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@TestPropertySource(properties = "der.backup.upload.root=${java.io.tmpdir}/der-restore-test")
class RestoreControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean RestoreRepository repo;
    @MockBean Scheduler scheduler;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private RestoreRun sample(final RestoreRun.Status status) {
        return new RestoreRun(9L, Instant.parse("2026-10-22T00:00:00Z"), UUID.randomUUID(),
                "src.dump", status, null, null, null, null, RestoreRun.Kind.LOCAL);
    }

    @Test
    void requestWithoutAuth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/restore/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"LOCAL\",\"source\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requestMissingFieldsReturns400() throws Exception {
        mockMvc.perform(post("/edge-api/v1/restore/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"LOCAL\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requestInvalidKindReturns400() throws Exception {
        mockMvc.perform(post("/edge-api/v1/restore/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"NUKE\",\"source\":\"x\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void requestOk() throws Exception {
        when(repo.insert(any())).thenReturn(sample(RestoreRun.Status.REQUESTED));
        mockMvc.perform(post("/edge-api/v1/restore/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"LOCAL\",\"source\":\"src.dump\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.kind").value("LOCAL"));
        verify(scheduler).triggerJob(any(org.quartz.JobKey.class));
    }

    @Test
    void requestSwallowsSchedulerException() throws Exception {
        when(repo.insert(any())).thenReturn(sample(RestoreRun.Status.REQUESTED));
        doThrow(new org.quartz.SchedulerException("boom"))
                .when(scheduler).triggerJob(any(org.quartz.JobKey.class));
        mockMvc.perform(post("/edge-api/v1/restore/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"LOCAL\",\"source\":\"src.dump\"}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void uploadRejectsEmpty() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/restore/upload")
                        .file(new MockMultipartFile("archive", new byte[0]))
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadStoresFile() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/restore/upload")
                        .file(new MockMultipartFile("archive", "a.dump", "application/octet-stream",
                                "DATA".getBytes()))
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(4));
    }

    @Test
    void uploadWithoutAuth() throws Exception {
        mockMvc.perform(multipart("/edge-api/v1/restore/upload")
                        .file(new MockMultipartFile("archive", "a".getBytes())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listRuns() throws Exception {
        when(repo.findRecent(50)).thenReturn(List.of(sample(RestoreRun.Status.SUCCESS)));
        mockMvc.perform(get("/edge-api/v1/restore/runs").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runs[0].runId").value(9));
    }

    @Test
    void getRunMissing() throws Exception {
        when(repo.findById(99L)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/restore/runs/99").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getRunOk() throws Exception {
        when(repo.findById(9L)).thenReturn(Optional.of(sample(RestoreRun.Status.SUCCESS)));
        mockMvc.perform(get("/edge-api/v1/restore/runs/9").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }
}
