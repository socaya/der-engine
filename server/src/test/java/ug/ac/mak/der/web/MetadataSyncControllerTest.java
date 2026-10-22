package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.metadata.MetadataSnapshot;
import ug.ac.mak.der.metadata.MetadataSyncService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecurityAuditRepository;

@WebMvcTest(MetadataSyncController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, MetadataSyncControllerTest.Config.class})
class MetadataSyncControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean MetadataSyncService sync;
    @MockBean SecurityAuditRepository audit;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    private RequestPostProcessor admin() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "admin", "Admin", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.ADMIN), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void successReturnsSnapshotSummary() throws Exception {
        final Instant now = Instant.now();
        when(sync.syncAll(any())).thenReturn(new MetadataSnapshot(42L, "http://central/dhis",
                UUID.randomUUID(), now,
                new MetadataSnapshot.Counts(1, 2, 3, 4, 5),
                "2.44-SNAPSHOT", "abc", "fp"));
        mockMvc.perform(post("/edge-api/v1/sync/metadata").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.snapshotId").value(42))
                .andExpect(jsonPath("$.total").value(15))
                .andExpect(jsonPath("$.centralVersion").value("2.44-SNAPSHOT"));
        verify(audit).append(any(AuditEvent.class), eq(Instant.parse("2026-10-22T12:00:00Z")));
    }

    @Test
    void unreachableReturns503() throws Exception {
        when(sync.syncAll(any())).thenThrow(
                new Dhis2ReferenceClient.Dhis2UnreachableException("down", null));
        mockMvc.perform(post("/edge-api/v1/sync/metadata").with(admin()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("UNREACHABLE"))
                .andExpect(jsonPath("$.message").value("down"));
    }

    @Test
    void badResponseReturns502() throws Exception {
        when(sync.syncAll(any())).thenThrow(
                new Dhis2ReferenceClient.Dhis2ResponseException("bad", null));
        mockMvc.perform(post("/edge-api/v1/sync/metadata").with(admin()))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.status").value("BAD_RESPONSE"))
                .andExpect(jsonPath("$.message").value("bad"));
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(post("/edge-api/v1/sync/metadata"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void successWithNullCentralVersionStillReturnsOk() throws Exception {
        when(sync.syncAll(any())).thenReturn(new MetadataSnapshot(1L, "http://central/dhis",
                UUID.randomUUID(), Instant.now(),
                new MetadataSnapshot.Counts(0, 0, 0, 0, 0),
                null, null, null));
        mockMvc.perform(post("/edge-api/v1/sync/metadata").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"));
    }
}
