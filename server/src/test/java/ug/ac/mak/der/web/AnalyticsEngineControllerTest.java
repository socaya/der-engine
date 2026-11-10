package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinitionService;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsIngestionService;
import ug.ac.mak.der.analytics.engine.AnalyticsPeriodEnumerator;
import ug.ac.mak.der.analytics.expression.ExpressionCompiler;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeSession;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;

@WebMvcTest(AnalyticsEngineController.class)
@ActiveProfiles("test")
@Import(TestSecurityConfig.class)
class AnalyticsEngineControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean AnalyticsEngineRepository repo;
    @MockBean AnalyticsPeriodEnumerator periods;
    @MockBean AnalyticsIngestionService ingestion;
    @MockBean AnalyticsContributionRepository contributions;
    @MockBean ExpressionCompiler compiler;
    @MockBean AnalyticsDefinitionService definitions;
    @MockBean ug.ac.mak.der.analytics.engine.OptionSetLookup optionSets;
    @MockBean ug.ac.mak.der.analytics.engine.ProgramIndicatorSyncService piSync;

    private RequestPostProcessor as(final EdgeRole role) {
        final Instant now = Instant.now();
        final EdgeUser u = new EdgeUser(UUID.randomUUID(), "op", "Op",
                EdgeUser.Origin.BOOTSTRAP, null, false, EnumSet.of(role), now, now);
        final EdgeSession s = new EdgeSession(UUID.randomUUID(), u.userId(), "h", now, now,
                now.plusSeconds(3600), null, null, null);
        return authentication(new EdgeUserPrincipal(u, s));
    }

    @Test
    void capabilitiesRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/capabilities"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void capabilitiesReturnsManifest() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/capabilities")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.package").value("DER Analytics engine v1"))
                .andExpect(jsonPath("$.status").value("PHASE_1_FOUNDATION"))
                .andExpect(jsonPath("$.targetDhis2Versions[0]").value("2.41"))
                .andExpect(jsonPath("$.capabilities[0].feature").value("event_count"))
                .andExpect(jsonPath("$.supportedPeriodTypes[0]").value("Daily"));
    }

    @Test
    void periodsRejectsUnknownType() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/periods")
                        .param("type", "Biweekly")
                        .param("year", "2026")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PERIOD_TYPE_UNSUPPORTED"));
    }

    @Test
    void periodsReturnsWindows() throws Exception {
        when(periods.enumerate(eq(AnalyticsPeriodEnumerator.Type.MONTHLY), eq(2026)))
                .thenReturn(List.of(
                        new AnalyticsPeriodEnumerator.Window("202601",
                                java.time.LocalDate.of(2026, 1, 1),
                                java.time.LocalDate.of(2026, 1, 31)),
                        new AnalyticsPeriodEnumerator.Window("202602",
                                java.time.LocalDate.of(2026, 2, 1),
                                java.time.LocalDate.of(2026, 2, 28))));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/periods")
                        .param("type", "Monthly")
                        .param("year", "2026")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("MONTHLY"))
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.periods[0].id").value("202601"))
                .andExpect(jsonPath("$.periods[1].endDate").value("2026-02-28"));
    }

    @Test
    void periodsOutOfRangeYear() throws Exception {
        when(periods.enumerate(any(), eq(1800)))
                .thenThrow(new IllegalArgumentException("year out of range: 1800"));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/periods")
                        .param("type", "Yearly")
                        .param("year", "1800")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PERIOD_YEAR_OUT_OF_RANGE"));
    }

    @Test
    void metricsListReturnsCatalog() throws Exception {
        final UUID id = UUID.randomUUID();
        final AnalyticsDefinition d = new AnalyticsDefinition(id,
                "OPPI0001", "OPPI0001", "OPD attendances", 1,
                "hash-1", "EVENT", "COUNT", "PGM1", List.of("STG1"),
                "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                Instant.parse("2026-11-01T00:00:00Z"),
                Instant.parse("2026-11-01T00:00:00Z"),
                Instant.parse("2026-11-01T00:00:00Z"));
        when(repo.listDefinitions(null, 200)).thenReturn(List.of(d));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/metrics")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.metrics[0].code").value("OPPI0001"))
                .andExpect(jsonPath("$.metrics[0].analyticsType").value("EVENT"))
                .andExpect(jsonPath("$.metrics[0].stageUids[0]").value("STG1"));
    }

    @Test
    void metricsFilterBySupportState() throws Exception {
        when(repo.listDefinitions("UNSUPPORTED", 10)).thenReturn(List.of());
        mockMvc.perform(get("/edge-api/v1/analytics/v1/metrics")
                        .param("supportState", "UNSUPPORTED")
                        .param("limit", "10")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void explainByUuidReturns404WhenMissing() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findDefinition(id)).thenReturn(Optional.empty());
        mockMvc.perform(get("/edge-api/v1/analytics/v1/explain/" + id)
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("METRIC_NOT_FOUND"));
    }

    @Test
    void explainByCodeFallsBackToCodeLookup() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findDefinitionByCode("OPPI0001")).thenReturn(Optional.of(
                new AnalyticsDefinition(id, null, "OPPI0001", "OPD",
                        1, "h", "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/explain/OPPI0001")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OPPI0001"));
    }

    @Test
    void queryReturnsCells() throws Exception {
        final UUID id = UUID.randomUUID();
        when(repo.findDefinitionByCode("OPPI0001")).thenReturn(Optional.of(
                new AnalyticsDefinition(id, null, "OPPI0001", "OPD",
                        1, "h", "EVENT", "COUNT", null, List.of(),
                        "EVENT_DATE", "EVENT_ORG_UNIT", "READY", null,
                        null, null, null)));
        when(repo.queryCells(any())).thenReturn(List.of(
                new AnalyticsCell(id, 1, "202611", "OU-A", "",
                        42L, null, new BigDecimal("42"),
                        null, null,
                        Instant.parse("2026-11-10T12:00:00Z"),
                        "VERIFIED")));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/query")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{\"metrics\":[\"OPPI0001\"],"
                                + "\"period\":{\"type\":\"Monthly\",\"id\":\"202611\"},"
                                + "\"orgUnits\":[\"OU-A\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.cells[0].periodKey").value("202611"))
                .andExpect(jsonPath("$.cells[0].countValue").value(42))
                .andExpect(jsonPath("$.cells[0].qualityState").value("VERIFIED"));
    }

    @Test
    void queryAcceptsEmptyBody() throws Exception {
        when(repo.queryCells(any())).thenReturn(List.of());
        mockMvc.perform(post("/edge-api/v1/analytics/v1/query")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void timeseriesSharesQueryPath() throws Exception {
        when(repo.queryCells(any())).thenReturn(List.of());
        mockMvc.perform(post("/edge-api/v1/analytics/v1/timeseries")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{\"metrics\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void qualityReturnsCounts() throws Exception {
        when(repo.qualityCounts()).thenReturn(Map.of(
                "PROVISIONAL", 3, "VERIFIED", 2, "FAILED", 0));
        when(repo.allCursors()).thenReturn(Map.of("event", 42L));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/quality")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qualityCounts.VERIFIED").value(2))
                .andExpect(jsonPath("$.sourceCursors.event").value(42));
    }

    @Test
    void jobsReturnsIdlePhaseOneStub() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/admin/jobs")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activeJobs").isArray())
                .andExpect(jsonPath("$.deadLetters").value(0));
    }

    @Test
    void recomputeRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/recompute")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void recomputeResetsAndIngests() throws Exception {
        when(ingestion.resetBuiltIns())
                .thenReturn(java.util.Map.of("DER_EVENT_COUNT", 10));
        when(ingestion.ingestBuiltIns(any())).thenReturn(List.of(
                new AnalyticsIngestionService.IngestResult(
                        "DER_EVENT_COUNT", 100L, 100L, 5L)));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/recompute")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"orgUnit\":\"OU-A\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.resetContributions.DER_EVENT_COUNT")
                        .value(10))
                .andExpect(jsonPath("$.results[0].metricCode")
                        .value("DER_EVENT_COUNT"))
                .andExpect(jsonPath("$.results[0].rowsScanned").value(100))
                .andExpect(jsonPath("$.results[0].cellsMaterialised").value(5));
    }

    @Test
    void ingestRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/ingest")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ingestRunsWithoutReset() throws Exception {
        when(ingestion.ingestBuiltIns(any())).thenReturn(List.of(
                new AnalyticsIngestionService.IngestResult(
                        "DER_ENROLLMENT_COUNT", 50L, 50L, 3L)));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/ingest")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"fromDate\":\"2026-10-01\","
                                + "\"toDate\":\"2026-11-10\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                // ingest without reset — resetContributions is null
                .andExpect(jsonPath("$.resetContributions").doesNotExist())
                .andExpect(jsonPath("$.results[0].metricCode")
                        .value("DER_ENROLLMENT_COUNT"));
    }

    @Test
    void compileRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/compile")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{\"expression\":\"1 + 1\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void compileReturnsResult() throws Exception {
        when(compiler.compile("#{DE1} + 1")).thenReturn(
                new ExpressionCompiler.CompileResult(
                        null,
                        ExpressionCompiler.SupportState.READY,
                        List.of(),
                        java.util.Set.of("DE1"),
                        java.util.Set.of(),
                        java.util.Set.of(),
                        java.util.Set.of(),
                        java.util.Set.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/compile")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"expression\":\"#{DE1} + 1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportState").value("READY"))
                .andExpect(jsonPath("$.referencedDataElements[0]")
                        .value("DE1"));
    }

    @Test
    void compileReportsParseError() throws Exception {
        when(compiler.compile("1 +")).thenReturn(
                new ExpressionCompiler.CompileResult(null,
                        ExpressionCompiler.SupportState.PARSE_ERROR,
                        List.of("unexpected end of expression"),
                        java.util.Set.of(), java.util.Set.of(),
                        java.util.Set.of(), java.util.Set.of(),
                        java.util.Set.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/compile")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"expression\":\"1 +\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportState").value("PARSE_ERROR"))
                .andExpect(jsonPath("$.diagnostics[0]")
                        .value("unexpected end of expression"));
    }

    @Test
    void createDefinitionRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/definitions")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{\"code\":\"X\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createDefinitionReturns201OnReady() throws Exception {
        final UUID id = UUID.randomUUID();
        when(definitions.create(any())).thenReturn(
                new AnalyticsDefinitionService.CreateResult(
                        AnalyticsDefinitionService.CreateOutcome.CREATED,
                        new AnalyticsDefinition(id, null, "MY", "My", 1,
                                "h", "EVENT", "COUNT", null, List.of(),
                                "EVENT_DATE", "EVENT_ORG_UNIT", "READY",
                                null, null, null, null),
                        new ExpressionCompiler.CompileResult(
                                null,
                                ExpressionCompiler.SupportState.READY,
                                List.of(),
                                java.util.Set.of("DE1"),
                                java.util.Set.of(), java.util.Set.of(),
                                java.util.Set.of(),
                                java.util.Set.of("d2:count")),
                        List.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/definitions")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"code\":\"MY\",\"displayName\":\"My\","
                                + "\"analyticsType\":\"EVENT\","
                                + "\"aggregationType\":\"COUNT\","
                                + "\"dateAnchor\":\"EVENT_DATE\","
                                + "\"orgUnitAnchor\":\"EVENT_ORG_UNIT\","
                                + "\"expression\":\"d2:count(#{DE1})\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.outcome").value("CREATED"))
                .andExpect(jsonPath("$.definition.code").value("MY"))
                .andExpect(jsonPath("$.supportState").value("READY"));
    }

    @Test
    void createDefinition422OnUnsupported() throws Exception {
        when(definitions.create(any())).thenReturn(
                new AnalyticsDefinitionService.CreateResult(
                        AnalyticsDefinitionService.CreateOutcome.UNSUPPORTED,
                        null,
                        new ExpressionCompiler.CompileResult(
                                null,
                                ExpressionCompiler.SupportState.UNSUPPORTED,
                                List.of("unsupported function 'd2:nope'"),
                                java.util.Set.of(), java.util.Set.of(),
                                java.util.Set.of(), java.util.Set.of(),
                                java.util.Set.of("d2:nope")),
                        List.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/definitions")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"code\":\"X\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.outcome").value("UNSUPPORTED"));
    }

    @Test
    void createDefinition400OnParseError() throws Exception {
        when(definitions.create(any())).thenReturn(
                new AnalyticsDefinitionService.CreateResult(
                        AnalyticsDefinitionService.CreateOutcome.PARSE_ERROR,
                        null,
                        new ExpressionCompiler.CompileResult(null,
                                ExpressionCompiler.SupportState.PARSE_ERROR,
                                List.of("unexpected end of expression"),
                                java.util.Set.of(), java.util.Set.of(),
                                java.util.Set.of(), java.util.Set.of(),
                                java.util.Set.of()),
                        List.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/definitions")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"code\":\"X\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.outcome").value("PARSE_ERROR"));
    }

    @Test
    void createDefinition409OnCodeTaken() throws Exception {
        when(definitions.create(any())).thenReturn(
                new AnalyticsDefinitionService.CreateResult(
                        AnalyticsDefinitionService.CreateOutcome.CODE_TAKEN,
                        null, null, List.of("code 'X' already exists")));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/definitions")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"code\":\"X\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.outcome").value("CODE_TAKEN"));
    }

    @Test
    void deleteDefinitionRequiresAdmin() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request
                        .MockMvcRequestBuilders.delete(
                        "/edge-api/v1/analytics/v1/admin/definitions/"
                                + UUID.randomUUID())
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteDefinitionOk() throws Exception {
        final UUID id = UUID.randomUUID();
        when(definitions.deprecate(id)).thenReturn(true);
        mockMvc.perform(org.springframework.test.web.servlet.request
                        .MockMvcRequestBuilders.delete(
                        "/edge-api/v1/analytics/v1/admin/definitions/" + id)
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportState").value("DEPRECATED"));
    }

    @Test
    void deleteDefinition404WhenMissing() throws Exception {
        final UUID id = UUID.randomUUID();
        when(definitions.deprecate(id)).thenReturn(false);
        mockMvc.perform(org.springframework.test.web.servlet.request
                        .MockMvcRequestBuilders.delete(
                        "/edge-api/v1/analytics/v1/admin/definitions/" + id)
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteDefinition409OnReservedCode() throws Exception {
        final UUID id = UUID.randomUUID();
        when(definitions.deprecate(id)).thenThrow(
                new IllegalStateException(
                        "cannot deprecate built-in metric"));
        mockMvc.perform(org.springframework.test.web.servlet.request
                        .MockMvcRequestBuilders.delete(
                        "/edge-api/v1/analytics/v1/admin/definitions/" + id)
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isConflict());
    }

    @Test
    void deleteDefinition400OnBadId() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request
                        .MockMvcRequestBuilders.delete(
                        "/edge-api/v1/analytics/v1/admin/definitions/not-a-uuid")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void importProgramIndicatorsRequiresAdmin() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/"
                        + "import-program-indicators")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void importProgramIndicatorsReturnsSummary() throws Exception {
        when(piSync.importAll(any())).thenReturn(
                new ug.ac.mak.der.analytics.engine
                        .ProgramIndicatorSyncService.ImportSummary(
                        3,
                        java.util.Map.of("CREATED", 2, "UNSUPPORTED", 1),
                        List.of(
                            new ug.ac.mak.der.analytics.engine
                                    .ProgramIndicatorSyncService
                                    .ImportItemResult("pi-1",
                                    "DHIS2_PI_A",
                                    ug.ac.mak.der.analytics.engine
                                        .ProgramIndicatorSyncService
                                        .Outcome.CREATED, null),
                            new ug.ac.mak.der.analytics.engine
                                    .ProgramIndicatorSyncService
                                    .ImportItemResult("pi-2",
                                    "DHIS2_PI_B",
                                    ug.ac.mak.der.analytics.engine
                                        .ProgramIndicatorSyncService
                                        .Outcome.UNSUPPORTED,
                                    "unsupported function 'd2:nope'"))));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/"
                        + "import-program-indicators")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.scanned").value(3))
                .andExpect(jsonPath("$.outcomeCounts.CREATED").value(2))
                .andExpect(jsonPath("$.items[0].sourceUid").value("pi-1"))
                .andExpect(jsonPath("$.items[1].message")
                        .value("unsupported function 'd2:nope'"));
    }

    @Test
    void importProgramIndicatorsPassesProgramUidScope() throws Exception {
        when(piSync.importAll(any())).thenReturn(
                new ug.ac.mak.der.analytics.engine
                        .ProgramIndicatorSyncService.ImportSummary(
                        0, java.util.Map.of(), List.of()));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/admin/"
                        + "import-program-indicators")
                        .with(as(EdgeRole.ADMIN))
                        .contentType("application/json")
                        .content("{\"programUid\":\"P1\"}"))
                .andExpect(status().isOk());
        final var captor = org.mockito.ArgumentCaptor.forClass(
                ug.ac.mak.der.analytics.engine
                        .ProgramIndicatorSyncService.ImportScope.class);
        verify(piSync).importAll(captor.capture());
        org.assertj.core.api.Assertions.assertThat(
                captor.getValue().programUid()).isEqualTo("P1");
    }

    @Test
    void qualityReportsContributionsTotal() throws Exception {
        when(repo.qualityCounts()).thenReturn(java.util.Map.of(
                "VERIFIED", 5));
        when(repo.allCursors()).thenReturn(java.util.Map.of());
        when(contributions.countAll()).thenReturn(42L);
        mockMvc.perform(get("/edge-api/v1/analytics/v1/quality")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contributionsTotal").value(42));
    }
}
