package ug.ac.mak.der.dhis2emulator;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.dhis2.compatibility.profiles.V244Profile;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;
import ug.ac.mak.der.workflows.events.Event;
import ug.ac.mak.der.workflows.events.EventService;

@WebMvcTest(EventsController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, EventsControllerTest.Config.class})
class EventsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean EventService service;
    @MockBean Dhis2CompatibilityEngine engine;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        Clock clock() {
            return Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    private CapabilityFlags caps() {
        final CapabilityFlags.Builder b = new CapabilityFlags.Builder();
        new V244Profile().apply(b);
        return b.build();
    }

    @Test
    void referralHeaderThreadsToService() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        mockMvc.perform(post("/api/events").with(as())
                        .header("X-DER-Referral-Next-Hop", "ou-dest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"events\":[{\"event\":\"" + UUID.randomUUID()
                                + "\",\"program\":\"p\",\"programStage\":\"ps\","
                                + "\"orgUnit\":\"ou\",\"occurredAt\":\"2026-10-22T10:00:00Z\","
                                + "\"status\":\"ACTIVE\"}]}"))
                .andExpect(status().isOk());
        final org.mockito.ArgumentCaptor<String> next =
                org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(service).submit(any(), any(), anyString(), any(),
                next.capture());
        org.assertj.core.api.Assertions.assertThat(next.getValue()).isEqualTo("ou-dest");
    }

    @Test
    void postEventsSuccess() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(
                        List.of(sampleEvent()), List.of()));
        final String body = "{\"events\":[{"
                + "\"event\":\"" + UUID.randomUUID() + "\","
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\","
                + "\"dataValues\":[{\"dataElement\":\"de1\",\"value\":\"1\"}]}]}";
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.responseType").value("ImportSummary"));
    }

    @Test
    void postTrackerUsesTrackerShape() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        when(engine.capabilities()).thenReturn(caps());
        final String body = "{\"events\":[{"
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\"}]}";
        mockMvc.perform(post("/api/tracker").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responseType").value("TrackerImportReport"));
    }

    @Test
    void postTrackerFallsBackWhenEngineUnavailable() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        when(engine.capabilities()).thenThrow(
                new Dhis2CompatibilityUnavailableException("x", null));
        final String body = "{\"events\":[{"
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\"}]}";
        mockMvc.perform(post("/api/tracker").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.responseType").value("TrackerImportReport"));
    }

    @Test
    void emptyEventsRejected() throws Exception {
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"events\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unauthenticatedIs401() throws Exception {
        mockMvc.perform(post("/api/events")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"events\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void conflictsAreReported() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(),
                        List.of(new EventService.Conflict("ref", "boom"))));
        final String body = "{\"events\":[{"
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\"}]}";
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WARNING"))
                .andExpect(jsonPath("$.conflicts[0].value").value("boom"));
    }

    @Test
    void malformedUuidsTolerated() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        final String body = "{\"events\":[{"
                + "\"event\":\"not-a-uuid\","
                + "\"enrollment\":\"also-not-a-uuid\","
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\"}]}";
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void nullOccurredAtDefaultsToClock() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        final String body = "{\"events\":[{"
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"status\":\"COMPLETED\",\"dataValues\":null,\"enrollment\":\"\"}]}";
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void dataValueWithNullDataElementIgnored() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any())).thenReturn(
                new EventService.EventImportResult(List.of(sampleEvent()), List.of()));
        final String body = "{\"events\":[{"
                + "\"program\":\"p\",\"programStage\":\"ps\",\"orgUnit\":\"ou\","
                + "\"occurredAt\":\"2026-10-22T10:00:00Z\",\"status\":\"ACTIVE\","
                + "\"dataValues\":[{\"dataElement\":null,\"value\":\"x\"},{\"dataElement\":\"de\",\"value\":null}]}]}";
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    @Test
    void nullBodyReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/events").with(as())
                        .contentType(MediaType.APPLICATION_JSON).content("null"))
                .andExpect(status().isBadRequest());
    }

    private Event sampleEvent() {
        return new Event(UUID.randomUUID(), null, "p", "ps", "ou",
                Instant.parse("2026-10-22T10:00:00Z"), Event.Status.ACTIVE, null,
                UUID.randomUUID(), 1, java.util.Map.of("de1", "1"));
    }
}
