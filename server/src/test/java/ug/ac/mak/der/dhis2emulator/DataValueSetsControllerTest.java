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
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueService;

@WebMvcTest(DataValueSetsController.class)
@ActiveProfiles("test")
@Import({TestSecurityConfig.class, DataValueSetsControllerTest.Config.class})
class DataValueSetsControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AggregateDataValueService service;
    @MockBean AggregateDataValueRepository values;
    @MockBean ug.ac.mak.der.workflow.SystemWorkflowService systemWorkflows;
    // Slice 53 — controller joins der.edge_user via JdbcTemplate to
    // enrich the GET response with stored_by_username. @WebMvcTest
    // doesn't load a real JDBC bean, so we mock it with a no-op row
    // iterator (zero rows → no stored_by_username emitted, which the
    // existing assertions tolerate).
    @MockBean org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @org.springframework.boot.test.context.TestConfiguration
    static class Config {
        @Bean
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-22T12:00:00Z"), ZoneOffset.UTC);
        }
    }

    @org.junit.jupiter.api.BeforeEach
    void stubSystemWorkflows() {
        when(systemWorkflows.ensureWebAppCaptureRun(anyString(), anyString(), anyString(), any()))
                .thenReturn(UUID.fromString("00000000-0000-0000-0000-000000000A01"));
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
        when(service.submit(any(), any(), anyString(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(2, 0, List.of()));
        final String body = "{\"dataSet\":\"DS12345\",\"orgUnit\":\"ou-default\",\"period\":\"2026Q1\","
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
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any(), any(), any());
        final List<AggregateDataValueService.DataValueInput> inputs = cap.getValue();
        org.assertj.core.api.Assertions.assertThat(inputs).hasSize(2);
        org.assertj.core.api.Assertions.assertThat(inputs.get(0).orgUnitUid()).isEqualTo("ou-default");
        org.assertj.core.api.Assertions.assertThat(inputs.get(1).orgUnitUid()).isEqualTo("ou-override");
    }

    @Test
    void referralHeaderThreadsIntoService() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        mockMvc.perform(post("/api/dataValueSets").with(as())
                        .header("X-DER-Referral-Next-Hop", "ou-dest")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataSet\":\"DS12345\",\"orgUnit\":\"ou-src\",\"period\":\"2026Q1\","
                                + "\"dataValues\":[{\"dataElement\":\"de1\",\"value\":\"1\"}]}"))
                .andExpect(status().isOk());
        final org.mockito.ArgumentCaptor<String> next =
                org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(service).submit(any(), any(), anyString(), any(),
                next.capture(), any());
        org.assertj.core.api.Assertions.assertThat(next.getValue()).isEqualTo("ou-dest");
    }

    @Test
    void mixedBatchReportsWarningStatusAndConflicts() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(
                        1, 1,
                        List.of(new AggregateDataValueService.Conflict("de|ou|2026Q1|def|def", "value is required"))));
        final String body = "{\"dataSet\":\"DS12345\",\"dataValues\":"
                + "[{\"dataElement\":\"de\",\"orgUnit\":\"ou\",\"period\":\"2026Q1\",\"value\":\"x\"}]}";
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
        when(service.submit(any(), any(), anyString(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        final String body = "{\"dataSet\":\"DS12345\",\"orgUnit\":\"ou\",\"period\":\"2026Q1\","
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
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any(), any(), any());
        final var input = cap.getValue().get(0);
        org.assertj.core.api.Assertions.assertThat(input.categoryOptionComboUid()).isEqualTo("coc-row");
        org.assertj.core.api.Assertions.assertThat(input.attributeOptionComboUid()).isEqualTo("aoc-row");
    }

    @Test
    void perRowDefaultsFromEnvelopeArePassedThrough() throws Exception {
        when(service.submit(any(), any(), anyString(), any(), any(), any())).thenReturn(
                new AggregateDataValueService.ImportSummary(1, 0, List.of()));
        final String body = "{\"dataSet\":\"DS12345\",\"orgUnit\":\"ou-default\",\"period\":\"2026Q1\","
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
        org.mockito.Mockito.verify(service).submit(cap.capture(), any(), anyString(), any(), any(), any());
        final var input = cap.getValue().get(0);
        org.assertj.core.api.Assertions.assertThat(input.categoryOptionComboUid()).isEqualTo("coc-default");
        org.assertj.core.api.Assertions.assertThat(input.attributeOptionComboUid()).isEqualTo("aoc-default");
    }

    @Test
    void getReturnsStoredValues() throws Exception {
        when(values.findByFilter(anyString(), anyString(), any(Integer.class)))
                .thenReturn(List.of(new ug.ac.mak.der.workflows.aggregate.AggregateDataValue(
                        UUID.randomUUID(), "de1", "ou1", "2026Q1", "HllvX50cXC0", "HllvX50cXC0",
                        "42", null, UUID.randomUUID(), Instant.parse("2026-10-22T12:00:00Z"), 1,
                        "DS12345")));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/dataValueSets?orgUnit=ou1&period=2026Q1&limit=100").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataValues[0].dataElement").value("de1"))
                .andExpect(jsonPath("$.dataValues[0].value").value("42"));
    }

    @Test
    void getWithZeroRowsSkipsUsernameLookup() throws Exception {
        // Empty row set → resolveUsernames bails on ids.isEmpty()
        // and the controller doesn't call jdbcTemplate at all.
        when(values.findByFilter(anyString(), anyString(), any(Integer.class)))
                .thenReturn(List.of());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/dataValueSets?orgUnit=ou1&period=2026Q1&limit=100").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataValues.length()").value(0));
        org.mockito.Mockito.verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void getEnrichesWithStoredByUsername() throws Exception {
        // Two rows with two distinct submitters → the loop builds a
        // "?,?" placeholder list and resolveUsernames returns a
        // populated map, which the response-building loop then
        // threads into stored_by_username.
        final UUID u1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
        final UUID u2 = UUID.fromString("00000000-0000-0000-0000-000000000002");
        when(values.findByFilter(anyString(), anyString(), any(Integer.class)))
                .thenReturn(List.of(
                        new ug.ac.mak.der.workflows.aggregate.AggregateDataValue(
                                UUID.randomUUID(), "de1", "ou1", "2026Q1", "HllvX50cXC0", "HllvX50cXC0",
                                "42", null, u1, Instant.parse("2026-10-22T12:00:00Z"), 1, "DS12345"),
                        new ug.ac.mak.der.workflows.aggregate.AggregateDataValue(
                                UUID.randomUUID(), "de2", "ou1", "2026Q1", "HllvX50cXC0", "HllvX50cXC0",
                                "7", null, u2, Instant.parse("2026-10-22T12:00:00Z"), 1, "DS12345")
                ));
        // Simulate der.edge_user returning username rows for both
        // submitters; invoke the callback once per row via a Mockito
        // Answer so the controller's lambda populates its map.
        org.mockito.Mockito.doAnswer(inv -> {
            final org.springframework.jdbc.core.RowCallbackHandler cb = inv.getArgument(1);
            final java.sql.ResultSet rs1 = org.mockito.Mockito.mock(java.sql.ResultSet.class);
            when(rs1.getString(1)).thenReturn(u1.toString());
            when(rs1.getString(2)).thenReturn("alice");
            final java.sql.ResultSet rs2 = org.mockito.Mockito.mock(java.sql.ResultSet.class);
            when(rs2.getString(1)).thenReturn(u2.toString());
            when(rs2.getString(2)).thenReturn("bob");
            cb.processRow(rs1);
            cb.processRow(rs2);
            return null;
        }).when(jdbcTemplate).query(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(org.springframework.jdbc.core.RowCallbackHandler.class),
                org.mockito.ArgumentMatchers.<Object>any(),
                org.mockito.ArgumentMatchers.<Object>any());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/dataValueSets?orgUnit=ou1&period=2026Q1&limit=100").with(as()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dataValues[0].stored_by_username").value("alice"))
                .andExpect(jsonPath("$.dataValues[1].stored_by_username").value("bob"));
    }

    @Test
    void getIs401WithoutAuth() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/dataValueSets"))
                .andExpect(status().isUnauthorized());
    }
}
