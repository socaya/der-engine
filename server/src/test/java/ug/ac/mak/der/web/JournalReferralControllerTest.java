package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
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
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

@WebMvcTest(JournalReferralController.class)
@ActiveProfiles("test")
@Import({ TestSecurityConfig.class, JournalReferralControllerTest.Beans.class })
class JournalReferralControllerTest {

    private final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    @Autowired MockMvc mockMvc;
    @MockBean OperationJournalRepository journal;
    @MockBean SecurityAuditRepository audit;

    @org.springframework.boot.test.context.TestConfiguration
    static class Beans {
        @org.springframework.context.annotation.Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-10-23T00:00:00Z"), ZoneOffset.UTC);
        }
    }

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "a", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private OperationJournalEntry entry(final UUID id) {
        return new OperationJournalEntry(id,
                OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE,
                "ref", JsonNodeFactory.instance.objectNode(),
                OperationJournalEntry.State.PENDING, 0, null, null, NOW, NOW);
    }

    @Test
    void tagJournalEntry() throws Exception {
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(Optional.of(entry(id)));
        when(journal.markNextHop(eq(id), anyString())).thenReturn(1);
        mockMvc.perform(post("/edge-api/v1/journal/" + id + "/next-hop")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitUid\":\"ou-dest\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextHopOrgUnitUid").value("ou-dest"));
        verify(journal).markNextHop(id, "ou-dest");
        verify(audit).append(any(AuditEvent.class), any(Instant.class));
    }

    @Test
    void tagWithBlankOrgUnit() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/" + UUID.randomUUID() + "/next-hop")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitUid\":\"  \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NEXT_HOP_INVALID"));
    }

    @Test
    void tagMissingBody() throws Exception {
        mockMvc.perform(post("/edge-api/v1/journal/" + UUID.randomUUID() + "/next-hop")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tagUnknownOperation() throws Exception {
        when(journal.findById(any(UUID.class))).thenReturn(Optional.empty());
        mockMvc.perform(post("/edge-api/v1/journal/" + UUID.randomUUID() + "/next-hop")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitUid\":\"ou-dest\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void auditFailureStillReturnsOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(journal.findById(id)).thenReturn(Optional.of(entry(id)));
        when(journal.markNextHop(eq(id), anyString())).thenReturn(1);
        doThrow(new RuntimeException("audit down")).when(audit)
                .append(any(AuditEvent.class), any(Instant.class));
        mockMvc.perform(post("/edge-api/v1/journal/" + id + "/next-hop")
                        .with(as(EdgeRole.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orgUnitUid\":\"ou-dest\"}"))
                .andExpect(status().isOk());
    }
}
