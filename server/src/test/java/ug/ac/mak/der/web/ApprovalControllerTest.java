package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.approval.ApprovalRecord;
import ug.ac.mak.der.approval.ApprovalRepository;
import ug.ac.mak.der.approval.ApprovalService;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(ApprovalController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ApprovalControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ApprovalService svc;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "r", "R",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void pendingReturnsList() throws Exception {
        when(svc.pending(100)).thenReturn(List.of(new ApprovalRepository.PendingApprovalRow(
                UUID.randomUUID(), "AGGREGATE_DATA_VALUE", "k",
                UUID.randomUUID(), Instant.parse("2026-10-22T00:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/approvals/pending").with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].entityType").value("AGGREGATE_DATA_VALUE"));
    }

    @Test
    void pendingAcceptsLimitParam() throws Exception {
        when(svc.pending(25)).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/approvals/pending?limit=25").with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isOk());
    }

    @Test
    void statusNotFound() throws Exception {
        when(svc.status(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/approvals/" + UUID.randomUUID())
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound());
    }

    @Test
    void statusOk() throws Exception {
        final UUID op = UUID.randomUUID();
        when(svc.status(op)).thenReturn(Optional.of(new ApprovalRecord(
                op, true, null, null, null, null, null)));
        mockMvc.perform(get("/edge-api/v1/approvals/" + op).with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requiresApproval").value(true));
    }

    @Test
    void approveUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/approve"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void approveHappy() throws Exception {
        when(svc.approve(any(UUID.class), any(UUID.class)))
                .thenReturn(ApprovalService.Outcome.APPROVED);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("APPROVED"));
    }

    @Test
    void approveNotRequiredIs409() throws Exception {
        when(svc.approve(any(UUID.class), any(UUID.class)))
                .thenReturn(ApprovalService.Outcome.NOT_REQUIRED);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPROVAL_NOT_REQUIRED"));
    }

    @Test
    void approveAlreadyDecidedIs409() throws Exception {
        when(svc.approve(any(UUID.class), any(UUID.class)))
                .thenReturn(ApprovalService.Outcome.ALREADY_DECIDED);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPROVAL_ALREADY_DECIDED"));
    }

    @Test
    void approveNotFound() throws Exception {
        when(svc.approve(any(UUID.class), any(UUID.class)))
                .thenReturn(ApprovalService.Outcome.NOT_FOUND);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/approve")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejectHappy() throws Exception {
        when(svc.reject(any(UUID.class), any(UUID.class), anyString()))
                .thenReturn(ApprovalService.Outcome.REJECTED);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/reject")
                        .with(as(EdgeRole.REVIEWER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"over threshold\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("REJECTED"));
    }

    @Test
    void rejectWithoutBodyIsOk() throws Exception {
        when(svc.reject(any(UUID.class), any(UUID.class), any()))
                .thenReturn(ApprovalService.Outcome.REJECTED);
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/reject")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    @Test
    void rejectUnauth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/approvals/" + UUID.randomUUID() + "/reject")
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
