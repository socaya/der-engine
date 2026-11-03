package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(AdminSettingsController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AdminSettingsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AdminSettingRepository repo;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void readUnauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/settings"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void readReturnsCronAndFlags() throws Exception {
        when(repo.read("sync.cron")).thenReturn(Optional.of(
                new AdminSettingRepository.Entry("sync.cron", "{\"a\":\"1 * * * * ?\"}",
                        UUID.randomUUID(), Instant.now())));
        when(repo.read("feature.flags")).thenReturn(Optional.of(
                new AdminSettingRepository.Entry("feature.flags", "{\"x\":true}",
                        UUID.randomUUID(), Instant.now())));
        mockMvc.perform(get("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cron.a").value("1 * * * * ?"))
                .andExpect(jsonPath("$.flags.x").value(true));
    }

    @Test
    void readFallsBackWhenMalformedJson() throws Exception {
        when(repo.read("sync.cron")).thenReturn(Optional.of(
                new AdminSettingRepository.Entry("sync.cron", "not-json",
                        UUID.randomUUID(), Instant.now())));
        when(repo.read("feature.flags")).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cron").exists())
                .andExpect(jsonPath("$.flags").exists());
    }

    @Test
    void saveUnauthenticated() throws Exception {
        mockMvc.perform(post("/edge-api/v1/admin/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cron\":{}}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void saveNullBodyIsBadRequest() throws Exception {
        mockMvc.perform(post("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void savePersistsCronOnly() throws Exception {
        when(repo.read(anyString())).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cron\":{\"job\":\"0 * * * * ?\"}}"))
                .andExpect(status().isOk());
        verify(repo).upsert(eq("sync.cron"), anyString(), any());
    }

    @Test
    void savePersistsFlagsOnly() throws Exception {
        when(repo.read(anyString())).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flags\":{\"beta\":true}}"))
                .andExpect(status().isOk());
        verify(repo).upsert(eq("feature.flags"), anyString(), any());
    }

    @Test
    void savePersistsBoth() throws Exception {
        when(repo.read(anyString())).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/admin/settings").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cron\":{\"a\":\"1\"},\"flags\":{\"b\":false}}"))
                .andExpect(status().isOk());
        verify(repo).upsert(eq("sync.cron"), anyString(), any());
        verify(repo).upsert(eq("feature.flags"), anyString(), any());
    }

    @Test
    void saveRequestRecordCarriesFields() {
        final java.util.Map<String, Object> cron = new java.util.LinkedHashMap<>();
        cron.put("cron", "0 * * * * ?");
        final java.util.Map<String, Object> flags = new java.util.LinkedHashMap<>();
        flags.put("flag", true);
        final AdminSettingsController.SaveRequest req =
                new AdminSettingsController.SaveRequest(cron, flags);
        org.junit.jupiter.api.Assertions.assertEquals("0 * * * * ?",
                req.cron().get("cron"));
        org.junit.jupiter.api.Assertions.assertEquals(Boolean.TRUE,
                req.flags().get("flag"));
    }

    @Test
    void saveRequestTolerantOfNulls() {
        final AdminSettingsController.SaveRequest req =
                new AdminSettingsController.SaveRequest(null, null);
        org.junit.jupiter.api.Assertions.assertNull(req.cron());
        org.junit.jupiter.api.Assertions.assertNull(req.flags());
    }
}
