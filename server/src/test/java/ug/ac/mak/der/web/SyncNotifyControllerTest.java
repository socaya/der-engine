package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
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

import ug.ac.mak.der.metadata.MetadataSyncService;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(SyncNotifyController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class SyncNotifyControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean MetadataSyncService sync;

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "agent", "A",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void acknowledgesAndTriggersSync() throws Exception {
        mockMvc.perform(post("/edge-api/v1/sync/notify").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objects\":[\"abc\",\"def\"],\"kinds\":[\"DATA_SET\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acknowledged").value(true))
                .andExpect(jsonPath("$.objects").value(2));
    }

    @Test
    void emptyBodyAcknowledges() throws Exception {
        mockMvc.perform(post("/edge-api/v1/sync/notify").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objects").value(0));
    }

    @Test
    void syncFailureReturns503() throws Exception {
        doThrow(new RuntimeException("central down"))
                .when(sync).syncAll(any(UUID.class));
        mockMvc.perform(post("/edge-api/v1/sync/notify").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SYNC_NOTIFY_FAILED"));
    }
}
