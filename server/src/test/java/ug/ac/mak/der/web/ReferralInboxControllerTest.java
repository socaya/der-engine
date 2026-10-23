package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.referral.ReferralInboxEntry;
import ug.ac.mak.der.workflows.referral.ReferralInboxRepository;

@WebMvcTest(ReferralInboxController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ReferralInboxControllerTest {

    private final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    @Autowired MockMvc mockMvc;
    @MockBean ReferralInboxRepository repo;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "a", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void listPending() throws Exception {
        when(repo.findPending(anyInt())).thenReturn(List.of(new ReferralInboxEntry(
                UUID.randomUUID(), ReferralInboxEntry.Kind.AGGREGATE_DATA_VALUE,
                "ref-1", "ou-dest", "{}", NOW,
                ReferralInboxEntry.Status.PENDING, null, null)));
        mockMvc.perform(get("/edge-api/v1/referral/inbox").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].kind").value("AGGREGATE_DATA_VALUE"))
                .andExpect(jsonPath("$.entries[0].sourceRef").value("ref-1"));
    }

    @Test
    void listEmpty() throws Exception {
        when(repo.findPending(anyInt())).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/referral/inbox").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.entries").isEmpty());
    }

    @Test
    void customLimitPassedThrough() throws Exception {
        when(repo.findPending(5)).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/referral/inbox?limit=5").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(repo).findPending(5);
    }
}
