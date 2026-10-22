package ug.ac.mak.der.dhis2emulator;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.web.TestSecurityConfig;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;

@WebMvcTest(DataValueSetsController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, DataValueSetsControllerTest.Config.class})
class DataValueSetsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AggregateDataValueService service;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    private RequestPostProcessor as() {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op", EdgeUser.Origin.BOOTSTRAP, null, false,
                EnumSet.of(EdgeRole.OPERATOR), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void successfulSubmitReturnsImportSummary() throws Exception {
        when(service.submit(any(), any(), anyString(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(2, 0, List.of()));
        final String body = "{\"orgUnit\":\"ou-default\",\"period\":\"2026Q1\","
                + "\"dataValues\":["
                + "{\"dataElement\":\"de1\",\"value\":\"1\"},"
                + "{\"dataElement\":\"de2\",\"value\":\"2\",\"orgUnit\":\"ou-override\"}"
                + "]}";
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.importCount.imported").value(2))
                .andExpect(jsonPath("$.importCount.ignored").value(0))
                .andExpect(jsonPath("$.responseType").value("ImportSummary"));

        @SuppressWarnings("unchecked")
        final ArgumentCaptor<List<AggregateDataValueService.DataValueInput>> cap =
                ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any());
        final List<AggregateDataValueService.DataValueInput> inputs = cap.getValue();
        org.assertj.core.api.Assertions.assertThat(inputs).hasSize(2);
        org.assertj.core.api.Assertions.assertThat(inputs.get(0).orgUnitUid()).isEqualTo("ou-default");
        org.assertj.core.api.Assertions.assertThat(inputs.get(1).orgUnitUid()).isEqualTo("ou-override");
    }

    @Test
    void mixedBatchReportsWarningStatusAndConflicts() throws Exception {
        when(service.submit(any(), any(), anyString(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(
                        1, 1,
                        List.of(new AggregateDataValueService.Conflict("de|ou|2026Q1|def|def", "value is required"))));
        final String body = "{\"dataValues\":[{\"dataElement\":\"de\",\"orgUnit\":\"ou\",\"period\":\"2026Q1\",\"value\":\"x\"}]}";
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WARNING"))
                .andExpect(jsonPath("$.importCount.imported").value(1))
                .andExpect(jsonPath("$.importCount.ignored").value(1))
                .andExpect(jsonPath("$.conflicts[0].value").value("value is required"));
    }

    @Test
    void emptyDataValuesRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataValues\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.conflicts[0].value").value(
                        org.hamcrest.Matchers.containsString("dataValues array is required")));
    }

    @Test
    void missingDataValuesRejectedWith400() throws Exception {
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anonymousIs401() throws Exception {
        mockMvc.perform(post("/api/dataValueSets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataValues\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void perRowCombosOverrideEnvelope() throws Exception {
        when(service.submit(any(), any(), anyString(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        final String body = "{\"orgUnit\":\"ou\",\"period\":\"2026Q1\","
                + "\"categoryOptionCombo\":\"coc-default\","
                + "\"attributeOptionCombo\":\"aoc-default\","
                + "\"dataValues\":[{\"dataElement\":\"de\",\"value\":\"1\","
                + "\"categoryOptionCombo\":\"coc-row\",\"attributeOptionCombo\":\"aoc-row\"}]}";
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
        @SuppressWarnings("unchecked")
        final ArgumentCaptor<List<AggregateDataValueService.DataValueInput>> cap =
                ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any());
        final var input = cap.getValue().get(0);
        org.assertj.core.api.Assertions.assertThat(input.categoryOptionComboUid()).isEqualTo("coc-row");
        org.assertj.core.api.Assertions.assertThat(input.attributeOptionComboUid()).isEqualTo("aoc-row");
    }

    @Test
    void perRowDefaultsFromEnvelopeArePassedThrough() throws Exception {
        when(service.submit(any(), any(), anyString(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        final String body = "{\"orgUnit\":\"ou-default\",\"period\":\"2026Q1\","
                + "\"categoryOptionCombo\":\"coc-default\","
                + "\"attributeOptionCombo\":\"aoc-default\","
                + "\"dataValues\":[{\"dataElement\":\"de1\",\"value\":\"1\"}]}";
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
        @SuppressWarnings("unchecked")
        final ArgumentCaptor<List<AggregateDataValueService.DataValueInput>> cap =
                ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any());
        final var input = cap.getValue().get(0);
        org.assertj.core.api.Assertions.assertThat(input.categoryOptionComboUid()).isEqualTo("coc-default");
        org.assertj.core.api.Assertions.assertThat(input.attributeOptionComboUid()).isEqualTo("aoc-default");
    }
}
