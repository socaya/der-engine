package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
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
import ug.ac.mak.der.workflows.ActivityService;

@WebMvcTest(ActivityController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class ActivityControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean ActivityService activity;

    private static EdgeUserPrincipal principal() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return new EdgeUserPrincipal(u, s);
    }

    private static RequestPostProcessor as(final EdgeUserPrincipal p) {
        return authentication(p);
    }

    @Test
    void returnsRecentForCurrentUser() throws Exception {
        final EdgeUserPrincipal p = principal();
        when(activity.recentForUser(eq(p.userId()), anyInt())).thenReturn(List.of(
                new ActivityService.ActivityEntry(7L, "SIGN_IN_SUCCESS", "SUCCESS",
                        Instant.parse("2026-10-22T09:00:00Z"))));
        mockMvc.perform(get("/edge-api/v1/activity/recent").with(as(p)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].auditId").value(7))
                .andExpect(jsonPath("$.entries[0].eventType").value("SIGN_IN_SUCCESS"))
                .andExpect(jsonPath("$.entries[0].observedAt").value("2026-10-22T09:00:00Z"));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/edge-api/v1/activity/recent"))
                .andExpect(status().isUnauthorized());
    }
}
