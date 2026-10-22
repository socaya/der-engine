package ug.ac.mak.der.dhis2emulator;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
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
import ug.ac.mak.der.web.TestSecurityConfig;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventRepository;

@WebMvcTest(EventsReadController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class EventsReadControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EventRepository events;

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void legacyEventsListReturnsEventsKey() throws Exception {
        when(events.findByProgramAndOrgUnit(anyString(), anyString(), anyInt()))
                .thenReturn(List.of());
        mockMvc.perform(get("/api/events?program=p&orgUnit=o").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.events").isArray());
    }

    @Test
    void trackerEventsListReturnsInstancesKey() throws Exception {
        when(events.findByProgramAndOrgUnit(anyString(), anyString(), anyInt()))
                .thenReturn(List.of(sample()));
        mockMvc.perform(get("/api/tracker/events?program=p&orgUnit=o").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instances").isArray())
                .andExpect(jsonPath("$.instances[0].event").exists())
                .andExpect(jsonPath("$.instances[0].enrollment").exists());
    }

    @Test
    void missingProgramIs400() throws Exception {
        mockMvc.perform(get("/api/events?orgUnit=o").with(as()))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/events?program=p").with(as()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(get("/api/events?program=p&orgUnit=o"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/tracker/events?program=p&orgUnit=o"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void blankParamsReturn400() throws Exception {
        mockMvc.perform(get("/api/events?program=&orgUnit=o").with(as()))
                .andExpect(status().isBadRequest());
    }

    private Event sample() {
        return new Event(UUID.randomUUID(), UUID.randomUUID(), "p", "ps", "ou",
                Instant.parse("2026-10-22T10:00:00Z"), Event.Status.ACTIVE, null,
                UUID.randomUUID(), 1, Map.of("de1", "x"));
    }
}
