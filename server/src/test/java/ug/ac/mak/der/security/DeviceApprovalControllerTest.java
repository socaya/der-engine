package ug.ac.mak.der.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.web.TestSecurityConfig;

@WebMvcTest(DeviceApprovalController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class DeviceApprovalControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean DeviceApprovalPolicy policy;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "ops", "Ops",
                EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(),
                "h", now, now, now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void getReturnsCurrentValue() throws Exception {
        when(policy.required()).thenReturn(true);
        mockMvc.perform(get("/edge-api/v1/admin/security/device-approval")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.required").value(true));
    }

    @Test
    void getIsAdminOnly() throws Exception {
        mockMvc.perform(get("/edge-api/v1/admin/security/device-approval")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void putUpdatesAndReturnsNewValue() throws Exception {
        when(policy.required()).thenReturn(false);
        mockMvc.perform(put("/edge-api/v1/admin/security/device-approval")
                        .contentType("application/json")
                        .content("{\"required\":false}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.required").value(false));
        verify(policy).set(eq(false), any(UUID.class));
    }

    @Test
    void putRejectsMissingField() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/security/device-approval")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REQUIRED_FIELD"));
    }

    @Test
    void putIsAdminOnly() throws Exception {
        mockMvc.perform(put("/edge-api/v1/admin/security/device-approval")
                        .contentType("application/json")
                        .content("{\"required\":false}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }
}
