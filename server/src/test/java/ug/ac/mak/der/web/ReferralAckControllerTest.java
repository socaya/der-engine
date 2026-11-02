package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
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

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

@WebMvcTest(ReferralAckController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ReferralAckControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean OperationJournalRepository journal;
    @MockBean SecurityAuditRepository audit;
    @MockBean(name = "clock") Clock clock;

    private RequestPostProcessor asOperator() {
        final Instant now = Instant.parse("2026-11-02T10:00:00Z");
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private void stubClock() {
        when(clock.instant()).thenReturn(Instant.parse("2026-11-02T10:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("UTC"));
    }

    @Test
    void unauthRejects() throws Exception {
        mockMvc.perform(post("/edge-api/v1/referrals/ack")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operationId\":\"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsMissingOperationId() throws Exception {
        stubClock();
        mockMvc.perform(post("/edge-api/v1/referrals/ack").with(asOperator())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REFERRAL_ACK_INVALID"));
    }

    @Test
    void firstAckStampsReferralAndAuditsAsSuccess() throws Exception {
        stubClock();
        final UUID opId = UUID.randomUUID();
        when(journal.markReferralDelivered(eq(opId), anyString(), any())).thenReturn(1);
        mockMvc.perform(post("/edge-api/v1/referrals/ack").with(asOperator())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operationId\":\"" + opId + "\","
                                + "\"receiptId\":\"edge-B/42\","
                                + "\"destinationOrgUnit\":\"OU-DEST\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(false));
        verify(journal).markReferralDelivered(eq(opId), eq("edge-B/42"), any());
        verify(audit).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "REFERRAL_DELIVERED".equals(e.eventType())),
                any());
    }

    @Test
    void duplicateAckReturns200AndAuditsAsDuplicate() throws Exception {
        stubClock();
        final UUID opId = UUID.randomUUID();
        when(journal.markReferralDelivered(eq(opId), anyString(), any())).thenReturn(0);
        mockMvc.perform(post("/edge-api/v1/referrals/ack").with(asOperator())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operationId\":\"" + opId + "\","
                                + "\"receiptId\":\"edge-B/42\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true));
        verify(audit).append(
                org.mockito.ArgumentMatchers.argThat(
                        (AuditEvent e) -> "REFERRAL_ACK_DUPLICATE".equals(e.eventType())),
                any());
    }
}
