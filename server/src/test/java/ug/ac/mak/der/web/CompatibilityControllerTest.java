package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
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

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.CapabilitySnapshot;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.dhis2.compatibility.ProbeOutcome;
import ug.ac.mak.der.dhis2.compatibility.ProbeReport;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(CompatibilityController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class CompatibilityControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean Dhis2CompatibilityEngine engine;

    private CapabilitySnapshot snapshot() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        final ProbeReport report = new ProbeReport(Instant.parse("2026-10-22T12:00:00Z"), 1L, true,
                "2.44-SNAPSHOT",
                List.of(new ProbeOutcome("/api/system/info", "GET", 200, 1L, "d", "n", true)));
        return new CapabilitySnapshot(1L, Instant.parse("2026-10-22T12:00:00Z"), "2.44-SNAPSHOT",
                "r", "b", 2, 44, null, true, "V2_44", report, b.build(), "1.0.0", true, 10L,
                CapabilitySnapshot.Trigger.STARTUP, null);
    }

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void activeReturnsSnapshotForAuthenticatedUser() throws Exception {
        when(engine.current()).thenReturn(snapshot());
        mockMvc.perform(get("/edge-api/v1/compat").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileName").value("V2_44"))
                .andExpect(jsonPath("$.centralVersion").value("2.44-SNAPSHOT"))
                .andExpect(jsonPath("$.capabilities.trackerApi").value("TRACKER_ONLY"));
    }

    @Test
    void activeIs401Unauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/compat"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void activeReturns503WhenEngineUnavailable() throws Exception {
        when(engine.current()).thenThrow(
                new Dhis2CompatibilityUnavailableException("not initialised", null));
        mockMvc.perform(get("/edge-api/v1/compat").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"));
    }

    @Test
    void refreshRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/compat/refresh").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void refreshIs401Unauthenticated() throws Exception {
        mockMvc.perform(post("/edge-api/v1/compat/refresh"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshReturns200AsAdmin() throws Exception {
        when(engine.refresh(any())).thenReturn(snapshot());
        mockMvc.perform(post("/edge-api/v1/compat/refresh").with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileName").value("V2_44"));
    }

    @Test
    void historyReturnsList() throws Exception {
        when(engine.history(20)).thenReturn(List.of(snapshot(), snapshot()));
        mockMvc.perform(get("/edge-api/v1/compat/history").with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshots[0].profileName").value("V2_44"))
                .andExpect(jsonPath("$.snapshots.length()").value(2));
    }

    @Test
    void historyIs401Unauthenticated() throws Exception {
        mockMvc.perform(get("/edge-api/v1/compat/history"))
                .andExpect(status().isUnauthorized());
    }
}
