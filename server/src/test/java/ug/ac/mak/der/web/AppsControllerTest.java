package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.apps.AppInstaller;
import ug.ac.mak.der.apps.InstalledApp;
import ug.ac.mak.der.apps.InstalledAppRepository;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(AppsController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AppsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AppInstaller installer;
    @MockBean InstalledAppRepository repository;
    @MockBean java.net.http.HttpClient appsHttpClient;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private InstalledApp sample() {
        return new InstalledApp(UUID.randomUUID(), "key", "1", "name", "{}", "/tmp",
                UUID.randomUUID(), Instant.now(), true);
    }

    @Test
    void listRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/apps")).andExpect(status().isUnauthorized());
    }

    @Test
    void listOk() throws Exception {
        when(repository.findAll()).thenReturn(List.of(sample()));
        mockMvc.perform(get("/edge-api/v1/apps").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void installRequiresAdmin() throws Exception {
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[]{1});
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file)
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void installUnauthenticated() throws Exception {
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[]{1});
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void installEmptyFile() throws Exception {
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[0]);
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installInstallException() throws Exception {
        when(installer.install(any(), any())).thenThrow(
                new AppInstaller.AppInstallException("bad"));
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[]{1});
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void installIoException() throws Exception {
        when(installer.install(any(), any())).thenThrow(new IOException("io"));
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[]{1});
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void installSuccess() throws Exception {
        when(installer.install(any(), any())).thenReturn(sample());
        final MockMultipartFile file = new MockMultipartFile("file", "x.zip",
                "application/zip", new byte[]{1});
        mockMvc.perform(multipart("/edge-api/v1/apps/install").file(file).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void setEnabledRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/apps/" + UUID.randomUUID() + "/enable?enabled=true")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void setEnabledUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/apps/" + UUID.randomUUID() + "/enable?enabled=true"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void setEnabledMissing() throws Exception {
        when(repository.setEnabled(any(), anyBoolean())).thenReturn(0);
        mockMvc.perform(post("/edge-api/v1/apps/" + UUID.randomUUID() + "/enable?enabled=true")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void setEnabledOk() throws Exception {
        when(repository.setEnabled(any(), anyBoolean())).thenReturn(1);
        mockMvc.perform(post("/edge-api/v1/apps/" + UUID.randomUUID() + "/enable?enabled=false")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk());
    }

    @Test
    void deleteRequiresAdmin() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/apps/" + UUID.randomUUID()).with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteUnauth() throws Exception {
        mockMvc.perform(delete("/edge-api/v1/apps/" + UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteMissing() throws Exception {
        when(repository.findById(any())).thenReturn(Optional.empty());
        mockMvc.perform(delete("/edge-api/v1/apps/" + UUID.randomUUID()).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteSuccess() throws Exception {
        when(repository.findById(any())).thenReturn(Optional.of(sample()));
        mockMvc.perform(delete("/edge-api/v1/apps/" + UUID.randomUUID()).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteIoFailure() throws Exception {
        when(repository.findById(any())).thenReturn(Optional.of(sample()));
        org.mockito.Mockito.doThrow(new IOException("fail")).when(installer).uninstall(any());
        mockMvc.perform(delete("/edge-api/v1/apps/" + UUID.randomUUID()).with(as(EdgeRole.ADMIN)))
                .andExpect(status().isInternalServerError());
    }
}
