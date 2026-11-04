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

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
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

import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(SiteConfigController.class)
@ActiveProfiles("test")
@Import({ TestSecurityConfig.class, SiteConfigControllerTest.ClockConfig.class })
class SiteConfigControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AdminSettingRepository repo;
    @MockBean SecurityAuditRepository audit;

    @TestConfiguration
    static class ClockConfig {
        @Bean Clock testClock() {
            return Clock.fixed(Instant.parse("2026-11-04T10:00:00Z"), ZoneOffset.UTC);
        }
    }

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "Admin",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void readUnauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/site/config"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void readReturnsDefaultsWhenStorageEmpty() throws Exception {
        when(repo.read(SiteConfigController.STORAGE_KEY)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.values['site.displayName']").value("DER edge"))
                .andExpect(jsonPath("$.values['site.localBaseUrl']").value("https://der.local"))
                .andExpect(jsonPath("$.values['site.connectivity.maxOfflineHours']").value("72"))
                .andExpect(jsonPath("$.defaults['site.timeZone']").exists())
                .andExpect(jsonPath("$.updatedBy").doesNotExist());
    }

    @Test
    void readOverlaysStoredValuesOverDefaults() throws Exception {
        when(repo.read(SiteConfigController.STORAGE_KEY)).thenReturn(Optional.of(
                new AdminSettingRepository.Entry(
                        SiteConfigController.STORAGE_KEY,
                        "{\"site.displayName\":\"Kampala Clinic\","
                                + "\"site.connectivity.maxOfflineHours\":\"24\"}",
                        UUID.randomUUID(), Instant.parse("2026-11-03T00:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.values['site.displayName']").value("Kampala Clinic"))
                .andExpect(jsonPath("$.values['site.connectivity.maxOfflineHours']").value("24"))
                // default survives when not overridden
                .andExpect(jsonPath("$.values['site.localBaseUrl']").value("https://der.local"))
                .andExpect(jsonPath("$.updatedBy").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").value("2026-11-03T00:00:00Z"));
    }

    @Test
    void readToleratesMalformedStoredJson() throws Exception {
        when(repo.read(SiteConfigController.STORAGE_KEY)).thenReturn(Optional.of(
                new AdminSettingRepository.Entry(
                        SiteConfigController.STORAGE_KEY, "not-json",
                        UUID.randomUUID(), Instant.now())));
        // Should fall through to defaults rather than 500.
        mockMvc.perform(get("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.values['site.displayName']").value("DER edge"));
    }

    @Test
    void saveUnauthenticated() throws Exception {
        mockMvc.perform(post("/edge-api/v1/site/config")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":{\"site.displayName\":\"x\"}}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void saveNullBodyIsBadRequest() throws Exception {
        mockMvc.perform(post("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void saveRejectsUnknownKey() throws Exception {
        mockMvc.perform(post("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":{\"site.evilKey\":\"x\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SITE_CONFIG_KEY_UNKNOWN"));
    }

    @Test
    void savePersistsMergedPayloadAndAudits() throws Exception {
        /* Simulate write-through: first read is empty (pre-save merge);
         * second read is the stored row the controller just upserted. */
        when(repo.read(SiteConfigController.STORAGE_KEY))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(new AdminSettingRepository.Entry(
                        SiteConfigController.STORAGE_KEY,
                        "{\"site.displayName\":\"Kampala Clinic\","
                                + "\"site.connectivity.maxOfflineHours\":\"24\"}",
                        UUID.randomUUID(), Instant.now())));
        mockMvc.perform(post("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":"
                                + "{\"site.displayName\":\"Kampala Clinic\","
                                + "\"site.connectivity.maxOfflineHours\":\"24\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.values['site.displayName']").value("Kampala Clinic"));
        verify(repo).upsert(eq(SiteConfigController.STORAGE_KEY), anyString(), any());
        verify(audit).append(any(), any());
    }

    @Test
    void savePreservesPreviousValuesWhenOnlyOneKeyProvided() throws Exception {
        /* Pre-save read returns the existing persisted block (displayName
         * + localBaseUrl). Post-save read returns the merged result
         * (displayName + localBaseUrl + the newly-supplied timeZone). */
        when(repo.read(SiteConfigController.STORAGE_KEY))
                .thenReturn(Optional.of(new AdminSettingRepository.Entry(
                        SiteConfigController.STORAGE_KEY,
                        "{\"site.displayName\":\"Kampala Clinic\","
                                + "\"site.localBaseUrl\":\"https://clinic.local\"}",
                        UUID.randomUUID(), Instant.now())))
                .thenReturn(Optional.of(new AdminSettingRepository.Entry(
                        SiteConfigController.STORAGE_KEY,
                        "{\"site.displayName\":\"Kampala Clinic\","
                                + "\"site.localBaseUrl\":\"https://clinic.local\","
                                + "\"site.timeZone\":\"Africa/Kampala\"}",
                        UUID.randomUUID(), Instant.now())));
        mockMvc.perform(post("/edge-api/v1/site/config").with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":{\"site.timeZone\":\"Africa/Kampala\"}}"))
                .andExpect(status().isOk())
                // Kept from prior save
                .andExpect(jsonPath("$.values['site.displayName']").value("Kampala Clinic"))
                .andExpect(jsonPath("$.values['site.localBaseUrl']").value("https://clinic.local"))
                // Newly saved
                .andExpect(jsonPath("$.values['site.timeZone']").value("Africa/Kampala"));
    }
}
