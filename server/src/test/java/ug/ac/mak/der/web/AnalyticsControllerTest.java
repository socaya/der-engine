package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

import ug.ac.mak.der.analytics.AnalyticsService;
import ug.ac.mak.der.analytics.FacilitySummaryRow;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(AnalyticsController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AnalyticsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AnalyticsService svc;

    private final Instant NOW = Instant.parse("2026-10-22T00:00:00Z");

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "a", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void summaryOk() throws Exception {
        when(svc.summary(any(), any())).thenReturn(List.of(new FacilitySummaryRow(
                "ou1", "202604", FacilitySummaryRow.Kind.AGGREGATE, 42L, NOW)));
        when(svc.lastRefreshedAt()).thenReturn(NOW);
        mockMvc.perform(get("/edge-api/v1/analytics/summary").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rows[0].n").value(42))
                .andExpect(jsonPath("$.lastRefreshedAt").value(NOW.toString()));
    }

    @Test
    void summaryNullLastRefreshed() throws Exception {
        when(svc.summary(any(), any())).thenReturn(List.of());
        when(svc.lastRefreshedAt()).thenReturn(null);
        mockMvc.perform(get("/edge-api/v1/analytics/summary").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastRefreshedAt").doesNotExist());
    }

    @Test
    void summaryWithOrgUnitParam() throws Exception {
        when(svc.summary(any(), any())).thenReturn(List.of());
        when(svc.lastRefreshedAt()).thenReturn(null);
        mockMvc.perform(get("/edge-api/v1/analytics/summary?orgUnit=ou1&kind=event")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void summaryBadKindTreatedAsAll() throws Exception {
        when(svc.summary(any(), any())).thenReturn(List.of());
        when(svc.lastRefreshedAt()).thenReturn(null);
        mockMvc.perform(get("/edge-api/v1/analytics/summary?kind=invalid")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void summaryBlankKindTreatedAsAll() throws Exception {
        when(svc.summary(any(), any())).thenReturn(List.of());
        when(svc.lastRefreshedAt()).thenReturn(null);
        mockMvc.perform(get("/edge-api/v1/analytics/summary?kind=").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk());
    }

    @Test
    void rejections() throws Exception {
        when(svc.rejections(anyInt())).thenReturn(3);
        mockMvc.perform(get("/edge-api/v1/analytics/rejections").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3));
    }

    @Test
    void refreshOk() throws Exception {
        when(svc.lastRefreshedAt()).thenReturn(NOW);
        mockMvc.perform(post("/edge-api/v1/analytics/refresh").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("OK"));
    }

    @Test
    void refreshFailurePropagates500() throws Exception {
        doThrow(new RuntimeException("boom")).when(svc).refreshNow();
        mockMvc.perform(post("/edge-api/v1/analytics/refresh").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("ANALYTICS_REFRESH_FAILED"));
    }
}
