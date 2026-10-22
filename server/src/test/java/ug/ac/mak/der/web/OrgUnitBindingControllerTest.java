package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
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

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(OrgUnitBindingController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class OrgUnitBindingControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean OrgUnitBindingService svc;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void getReturnsUnbound() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.empty());
        mockMvc.perform(get("/edge-api/v1/system/org-unit").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bound").value(false));
    }

    @Test
    void getReturnsBound() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic", "/root/ou-1", UUID.randomUUID()));
        mockMvc.perform(get("/edge-api/v1/system/org-unit").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bound").value(true))
                .andExpect(jsonPath("$.orgUnitId").value("ou-1"));
    }

    @Test
    void bindUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"ou-1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bindRejectsBlank() throws Exception {
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ORG_UNIT_REQUIRED"));
    }

    @Test
    void bindOnFirstBootOk() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.empty());
        when(svc.bind(anyString(), any(UUID.class))).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic", "/root/ou-1", UUID.randomUUID()));
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"ou-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bound").value(true));
    }

    @Test
    void rebindWithoutConfirmReturns409() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic 1", "/root/ou-1", UUID.randomUUID()));
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"ou-2\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REBIND_REQUIRES_CONFIRMATION"));
    }

    @Test
    void rebindWithConfirmOk() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic 1", "/root/ou-1", UUID.randomUUID()));
        when(svc.bind(anyString(), any(UUID.class))).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-2", "Clinic 2", "/root/ou-2", UUID.randomUUID()));
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"ou-2\",\"confirm\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orgUnitId").value("ou-2"));
    }

    @Test
    void sameOrgUnitDoesNotRequireConfirm() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic 1", "/root/ou-1", UUID.randomUUID()));
        when(svc.bind(anyString(), any(UUID.class))).thenReturn(EdgeOrgUnitBinding.bound(
                "ou-1", "Clinic 1", "/root/ou-1", UUID.randomUUID()));
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"ou-1\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void bindRejectsUnknownOrgUnit() throws Exception {
        when(svc.current()).thenReturn(EdgeOrgUnitBinding.empty());
        when(svc.bind(anyString(), any(UUID.class)))
                .thenThrow(new IllegalArgumentException("orgUnit x is not in the local metadata mirror"));
        mockMvc.perform(post("/edge-api/v1/system/org-unit")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitId\":\"x\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ORG_UNIT_NOT_IN_MIRROR"));
    }
}
