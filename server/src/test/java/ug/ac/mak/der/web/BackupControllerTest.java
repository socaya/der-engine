package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import org.quartz.Scheduler;

import ug.ac.mak.der.workflows.backup.BackupRepository;
import ug.ac.mak.der.workflows.backup.BackupRun;

@WebMvcTest(BackupController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
@TestPropertySource(properties = "der.backup.local.root=${java.io.tmpdir}/der-backup-test")
class BackupControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean BackupRepository repo;
    @MockBean Scheduler scheduler;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private BackupRun sample(final BackupRun.Status status) {
        return new BackupRun(5L, Instant.parse("2026-10-22T00:00:00Z"), UUID.randomUUID(),
                BackupRun.Kind.FULL, status, null, null, null, null, null, null, null);
    }

    @Test
    void requestWithoutAuthReturns401() throws Exception {
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requestAccepts() throws Exception {
        when(repo.insert(any())).thenReturn(sample(BackupRun.Status.REQUESTED));
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.runId").value(5));
        verify(scheduler).triggerJob(any(org.quartz.JobKey.class));
    }

    @Test
    void requestSwallowsSchedulerException() throws Exception {
        when(repo.insert(any())).thenReturn(sample(BackupRun.Status.REQUESTED));
        doThrow(new org.quartz.SchedulerException("boom"))
                .when(scheduler).triggerJob(any(org.quartz.JobKey.class));
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FULL\"}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void requestDefaultsKindOnBlank() throws Exception {
        when(repo.insert(any())).thenReturn(sample(BackupRun.Status.REQUESTED));
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"\"}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void requestDefaultsKindOnGarbage() throws Exception {
        when(repo.insert(any())).thenReturn(sample(BackupRun.Status.REQUESTED));
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"nonsense\"}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void requestEmptyBodyAccepts() throws Exception {
        when(repo.insert(any())).thenReturn(sample(BackupRun.Status.REQUESTED));
        mockMvc.perform(post("/edge-api/v1/backup/request")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isAccepted());
    }

    @Test
    void listRuns() throws Exception {
        when(repo.findRecent(50)).thenReturn(List.of(sample(BackupRun.Status.SUCCESS)));
        mockMvc.perform(get("/edge-api/v1/backup/runs").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.runs[0].runId").value(5));
    }

    @Test
    void getRunMissing() throws Exception {
        when(repo.findById(99L)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/backup/runs/99").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void getRunOk() throws Exception {
        when(repo.findById(5L)).thenReturn(Optional.of(sample(BackupRun.Status.SUCCESS)));
        mockMvc.perform(get("/edge-api/v1/backup/runs/5").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));
    }

    @Test
    void downloadMissing() throws Exception {
        when(repo.findById(5L)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/backup/runs/5/archive").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void downloadNoArchivePath() throws Exception {
        when(repo.findById(5L)).thenReturn(Optional.of(sample(BackupRun.Status.FAILED)));
        mockMvc.perform(get("/edge-api/v1/backup/runs/5/archive").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void downloadRejectsPathTraversal() throws Exception {
        when(repo.findById(5L)).thenReturn(Optional.of(
                new BackupRun(5L, Instant.now(), UUID.randomUUID(), BackupRun.Kind.FULL,
                        BackupRun.Status.SUCCESS, null, "/etc/passwd", 1L, null,
                        null, null, null)));
        mockMvc.perform(get("/edge-api/v1/backup/runs/5/archive").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void downloadStreamsFile(@TempDir final Path root) throws Exception {
        final Path archive = root.resolve("backup-7.dump");
        Files.writeString(archive, "DATA");
        final BackupRun row = new BackupRun(5L, Instant.now(), UUID.randomUUID(),
                BackupRun.Kind.FULL, BackupRun.Status.SUCCESS, null,
                archive.toString(), 4L, null, null, null, null);
        when(repo.findById(5L)).thenReturn(Optional.of(row));
        final BackupController ctl = new BackupController(repo, null, root.toString());
        final org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> resp =
                ctl.download(5L);
        org.assertj.core.api.Assertions.assertThat(resp.getStatusCode().value()).isEqualTo(200);
    }
}
