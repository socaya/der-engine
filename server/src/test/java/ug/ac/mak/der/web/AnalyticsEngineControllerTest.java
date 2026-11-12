package ug.ac.mak.der.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
    @MockBean ug.ac.mak.der.analytics.publication.PublicationProposalService publication;
    @MockBean ug.ac.mak.der.analytics.publication.PublicationRepository publicationRepo;
    @MockBean ug.ac.mak.der.analytics.engine.AnalyticsObservability metrics;
    @MockBean ug.ac.mak.der.analytics.drilldown.AnalyticsDrilldownService drilldown;
    @MockBean ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationService reconciliation;
    @MockBean ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationRepository reconciliationRepo;
    @MockBean ug.ac.mak.der.analytics.replay.AnalyticsBaselineVerifier replayVerifier;
    @MockBean ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationFetcher reconciliationFetcher;
    @MockBean ug.ac.mak.der.analytics.dlq.AnalyticsLiveDlqRepository liveDlq;
    @MockBean ug.ac.mak.der.analytics.dlq.AnalyticsLiveRetryWorker liveRetryWorker;
    @MockBean ug.ac.mak.der.analytics.benchmark.AnalyticsBenchmarkService benchmarks;
    @MockBean ug.ac.mak.der.analytics.benchmark.AnalyticsBenchmarkFixtureGenerator fixtureGenerator;
    @MockBean ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarSink columnarSink;
    @MockBean ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarVerifier columnarVerifier;
    @MockBean ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarLifecycle columnarLifecycle;
    @MockBean ug.ac.mak.der.analytics.column.exec.ColumnarExplainer columnarExplainer;
    @MockBean ug.ac.mak.der.analytics.column.exec.PlanSelector planSelector;
    @MockBean ug.ac.mak.der.analytics.column.exec.ColumnarQueryEngine columnarQueryEngine;
    @MockBean ug.ac.mak.der.analytics.column.feedback.PlanFeedbackStore planFeedbackStore;
    @MockBean ug.ac.mak.der.analytics.column.governor.QueryGovernor queryGovernor;
    @MockBean ug.ac.mak.der.analytics.column.governor.SpillStore spillStore;
    @MockBean ug.ac.mak.der.analytics.distributed.SiteContributionExporter siteExporter;
    @MockBean ug.ac.mak.der.analytics.distributed.SiteContributionReceiver siteReceiver;
    @MockBean ug.ac.mak.der.analytics.distributed.SiteContributionRepository siteRepo;
    @MockBean ug.ac.mak.der.analytics.distributed.SiteConsolidator siteConsolidator;
    @MockBean ug.ac.mak.der.analytics.publication.PublicationDrainWorker publicationDrain;

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
                .andExpect(jsonPath("$.status").value("OPERATIONAL_DUAL_ENGINE"))
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
    void drilldownRequiresAuth() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/drilldown"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void drilldownRejectsInvalidBody() throws Exception {
        mockMvc.perform(post("/edge-api/v1/analytics/v1/drilldown")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void drilldownForbiddenForOperator() throws Exception {
        final UUID auditId = UUID.randomUUID();
        when(drilldown.drilldown(any(), any()))
                .thenReturn(new ug.ac.mak.der.analytics.drilldown
                        .AnalyticsDrilldownService.Result(auditId,
                        ug.ac.mak.der.analytics.drilldown
                                .AnalyticsDrilldownService.DrilldownOutcome.UNAUTHORISED,
                        false, 0, List.of(), "role OPERATOR not permitted"));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/drilldown")
                        .contentType("application/json")
                        .content("{\"metricId\":\"" + UUID.randomUUID()
                                + "\",\"periodKey\":\"202611\","
                                + "\"orgUnitUid\":\"OU-A\"}")
                        .with(as(EdgeRole.OPERATOR)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.outcome").value("UNAUTHORISED"));
    }

    @Test
    void reconciliationRequiresAuth() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/reconciliation"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reconciliationListsRowsForAuthenticatedUser() throws Exception {
        when(reconciliationRepo.list(any(), any(), eq(200)))
                .thenReturn(List.of());
        when(reconciliationRepo.classificationCounts())
                .thenReturn(ug.ac.mak.der.analytics.reconciliation
                        .AnalyticsReconciliationService
                        .emptyClassificationHistogram());
        mockMvc.perform(get("/edge-api/v1/analytics/v1/reconciliation")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.byClassification.IN_AGREEMENT").value(0));
    }

    @Test
    void reconciliationFetchRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/reconciliation/fetch")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void reconciliationFetchRunsForAdmin() throws Exception {
        when(reconciliationFetcher.runNow()).thenReturn(5);
        when(reconciliationFetcher.stats()).thenReturn(
                new ug.ac.mak.der.analytics.reconciliation
                        .AnalyticsReconciliationFetcher.FetchStats(5, 0, 123L));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/reconciliation/fetch")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rowsUpserted").value(5))
                .andExpect(jsonPath("$.sampled").value(5));
    }

    @Test
    void reconciliationCompareRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/reconciliation/compare")
                        .contentType("application/json")
                        .content("[]")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void reconciliationCompareAcceptsAdmin() throws Exception {
        when(reconciliation.compare(any())).thenReturn(
                new ug.ac.mak.der.analytics.reconciliation
                        .AnalyticsReconciliationService.CompareResult(
                        1, 1, ug.ac.mak.der.analytics.reconciliation
                                .AnalyticsReconciliationService
                                .emptyClassificationHistogram()));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/reconciliation/compare")
                        .contentType("application/json")
                        .content("[{\"metricId\":\"" + UUID.randomUUID()
                                + "\",\"periodKey\":\"202611\","
                                + "\"orgUnitUid\":\"OU-A\","
                                + "\"centralValue\":42}]")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.samplesConsidered").value(1))
                .andExpect(jsonPath("$.rowsUpserted").value(1));
    }

    @Test
    void columnarFlushRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/flush")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void columnarFlushReturnsCompressionEvidence() throws Exception {
        when(columnarLifecycle.runNow()).thenReturn(
                new ug.ac.mak.der.analytics.column.sink
                        .AnalyticsColumnarLifecycle.LifecycleStatus(
                        "PUBLISHED", Instant.now(), Instant.now(),
                        1L, 500, 500, 0, 0L, 42_000L, 0.25, null));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/flush")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status.generation").value(1))
                .andExpect(jsonPath("$.status.rowsVerified").value(500))
                .andExpect(jsonPath("$.status.compressionRatio").value(0.25));
    }

    @Test
    void columnarVerifyRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/verify")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void columnarVerifyReturnsDriftReport() throws Exception {
        when(columnarVerifier.verify()).thenReturn(
                new ug.ac.mak.der.analytics.column.sink
                        .AnalyticsColumnarVerifier.VerifyReport(
                        1L, 2, 10, 10, 0, java.util.List.of()));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/verify")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generation").value(1))
                .andExpect(jsonPath("$.rowsOk").value(10))
                .andExpect(jsonPath("$.rowsDrifted").value(0));
    }

    @Test
    void explainRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/explain")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void explainReturnsPlanJson() throws Exception {
        when(columnarExplainer.explain(any())).thenReturn(
                new ug.ac.mak.der.analytics.column.exec
                        .ColumnarExplainer.QueryPlan(
                        7L, java.time.Instant.now(),
                        2, 1,
                        java.util.List.of(), java.util.List.of(),
                        java.util.List.of("orgUnit", "value"),
                        "<none>",
                        100, 25, 123.45, "columnar"));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/explain")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generation").value(7))
                .andExpect(jsonPath("$.segmentsMatched").value(2))
                .andExpect(jsonPath("$.segmentsSkipped").value(1))
                .andExpect(jsonPath("$.estimatedRows").value(25));
    }

    @Test
    void explainRejectsInvalidMetricId() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/explain")
                        .contentType("application/json")
                        .content("{\"metricIds\":[\"not-a-uuid\"]}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_METRIC_ID"));
    }

    @Test
    void planSelectRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/plan")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void planSelectReturnsDecision() throws Exception {
        when(planSelector.select(any())).thenReturn(
                new ug.ac.mak.der.analytics.column.exec
                        .PlanSelector.PlanDecision(
                        ug.ac.mak.der.analytics.column.exec
                                .PlanSelector.Engine.COLUMNAR,
                        250.0, 1024.0, 3, 1000,
                        7L, java.time.Instant.now(), false,
                        "columnar cheaper"));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/segments/plan")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.selected").value("COLUMNAR"))
                .andExpect(jsonPath("$.rationale").value("columnar cheaper"));
    }

    @Test
    void listQueriesRejectsNonAdmin() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/admin/queries")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listPlanFeedbackRejectsNonAdmin() throws Exception {
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/queries/feedback")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listPlanFeedbackReturnsStoreSnapshot() throws Exception {
        when(planFeedbackStore.size()).thenReturn(3);
        when(planFeedbackStore.capacity()).thenReturn(512);
        when(planFeedbackStore.recent(anyInt())).thenReturn(
                java.util.List.of());
        when(planFeedbackStore.averageRatioByShape()).thenReturn(
                java.util.Map.of());
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/queries/feedback")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.observations").value(3))
                .andExpect(jsonPath("$.capacity").value(512));
    }

    @Test
    void listSpillUsageRejectsNonAdmin() throws Exception {
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/queries/spill")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void listSpillUsageReturnsLimitsAndRows() throws Exception {
        when(spillStore.globalBytes()).thenReturn(1024L);
        when(spillStore.globalByteLimit())
                .thenReturn(10L * 1024L * 1024L * 1024L);
        when(spillStore.perQueryByteLimit())
                .thenReturn(1024L * 1024L * 1024L);
        when(spillStore.listUsage()).thenReturn(java.util.List.of());
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/queries/spill")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.globalBytes").value(1024));
    }

    @Test
    void listQueriesReturnsGovernorSnapshot() throws Exception {
        when(queryGovernor.inFlightCount()).thenReturn(2);
        when(queryGovernor.maxConcurrent()).thenReturn(4);
        when(queryGovernor.list()).thenReturn(java.util.List.of());
        mockMvc.perform(get("/edge-api/v1/analytics/v1/admin/queries")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inFlight").value(2))
                .andExpect(jsonPath("$.maxConcurrent").value(4));
    }

    @Test
    void cancelQueryNotFoundReturns404() throws Exception {
        when(queryGovernor.cancel(any())).thenReturn(false);
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/queries/"
                        + UUID.randomUUID() + "/cancel")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void cancelQueryHappyPath() throws Exception {
        when(queryGovernor.cancel(any())).thenReturn(true);
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/queries/"
                        + UUID.randomUUID() + "/cancel")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelled").value(true));
    }

    @Test
    void cancelQueryRejectsInvalidId() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/queries/not-a-uuid/cancel")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ID"));
    }

    @Test
    void siteExportRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/export")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void siteExportRejectsInvalidMetricId() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/export")
                        .contentType("application/json")
                        .content("{\"metricIds\":[\"not-a-uuid\"]}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_METRIC_ID"));
    }

    @Test
    void siteExportReturnsPacketsJson() throws Exception {
        when(siteExporter.export(any())).thenReturn(
                new ug.ac.mak.der.analytics.distributed
                        .SiteContributionExporter.ExportResult(
                        "der-site-1", 4, 2, 7L,
                        java.time.Instant.now(), java.util.List.of()));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/export")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siteId").value("der-site-1"))
                .andExpect(jsonPath("$.cellsScanned").value(4))
                .andExpect(jsonPath("$.packetsEmitted").value(2))
                .andExpect(jsonPath("$.maxSourceCursor").value(7));
    }

    @Test
    void siteImportRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/import")
                        .contentType("application/json")
                        .content("[]")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void siteImportHappyPathReturnsCounters() throws Exception {
        when(siteReceiver.ingest(any())).thenReturn(
                new ug.ac.mak.der.analytics.distributed
                        .SiteContributionReceiver.IngestResult(
                        3, 2, 1, 0, 1));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/import")
                        .contentType("application/json")
                        .content("[]")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.received").value(3))
                .andExpect(jsonPath("$.accepted").value(2))
                .andExpect(jsonPath("$.deduped").value(1));
    }

    @Test
    void siteImportRejectsMissingBody() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/import")
                        .contentType("application/json")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void siteSummaryReturnsRepoRows() throws Exception {
        when(siteRepo.countPendingConsolidation()).thenReturn(5L);
        when(siteRepo.siteSummary()).thenReturn(java.util.List.of());
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/sites/summary")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingConsolidation").value(5));
    }

    @Test
    void consolidateRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/consolidate")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void consolidateHappyPathReturnsCells() throws Exception {
        when(siteConsolidator.consolidate(any())).thenReturn(
                java.util.List.of(new ug.ac.mak.der.analytics.distributed
                        .ConsolidatedCell(
                        UUID.randomUUID(), 1, "202611", "OU-A", "",
                        7L, new java.math.BigDecimal("70"),
                        null, null, null, null,
                        java.util.List.of("site-a", "site-b"),
                        java.util.List.of("site-c"),
                        java.util.List.of(),
                        java.time.Instant.now(),
                        java.time.Instant.now(),
                        0.6667)));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/consolidate")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cellCount").value(1))
                .andExpect(jsonPath("$.cells[0].totalCount").value(7))
                .andExpect(jsonPath("$.cells[0].completeness").value(0.6667));
    }

    @Test
    void consolidateRejectsInvalidMetricId() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/sites/consolidate")
                        .contentType("application/json")
                        .content("{\"metricIds\":[\"not-a-uuid\"]}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_METRIC_ID"));
    }

    @Test
    void columnarManifestReturnsEmptyWhenNothingPublished()
            throws Exception {
        when(columnarSink.currentManifest()).thenReturn(
                java.util.Optional.empty());
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/segments/manifest")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generation").value(-1));
    }

    @Test
    void benchmarkLatencyRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/latency")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void benchmarkLatencyRunsForAdmin() throws Exception {
        final var run = new ug.ac.mak.der.analytics.benchmark
                .AnalyticsBenchmarkRun(
                        UUID.randomUUID(),
                        ug.ac.mak.der.analytics.benchmark
                                .AnalyticsBenchmarkRun.Operation.LATENCY,
                        100, 50, 180, 420, 500, 72,
                        1024L, "{}", java.time.Instant.now());
        when(benchmarks.latency(anyInt(), anyInt())).thenReturn(
                new ug.ac.mak.der.analytics.benchmark
                        .AnalyticsBenchmarkService.Verdict(
                        run, true, 2000, "dashboard query"));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/latency")
                        .param("iterations", "100")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nfrMet").value(true))
                .andExpect(jsonPath("$.run.iterations").value(100));
    }

    @Test
    void benchmarkRunsRejectsInvalidOperation() throws Exception {
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/benchmark/runs")
                        .param("operation", "nonsense")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_OPERATION"));
    }

    @Test
    void benchmarkSeedRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/seed")
                        .contentType("application/json")
                        .content("{\"orgUnitUid\":\"OU-A\"}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void benchmarkSeedRequiresOrgUnit() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/seed")
                        .contentType("application/json")
                        .content("{}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void benchmarkSeedRunsForAdmin() throws Exception {
        when(fixtureGenerator.seed(any(), any())).thenReturn(
                new ug.ac.mak.der.analytics.benchmark
                        .AnalyticsBenchmarkFixtureGenerator.SeedResult(
                        10, 10, 50, "BENCHMARK01"));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/seed")
                        .contentType("application/json")
                        .content("{\"orgUnitUid\":\"OU-A\","
                                + "\"teiCount\":10,\"eventsPerTei\":5}")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventsCreated").value(50))
                .andExpect(jsonPath("$.programUid").value("BENCHMARK01"));
    }

    @Test
    void benchmarkSeedCleanupReturnsCounts() throws Exception {
        when(fixtureGenerator.cleanup()).thenReturn(
                new ug.ac.mak.der.analytics.benchmark
                        .AnalyticsBenchmarkFixtureGenerator.CleanupResult(
                        50, 10, 10));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/benchmark/seed/cleanup")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventsDeleted").value(50));
    }

    @Test
    void benchmarkRunsListsHistory() throws Exception {
        when(benchmarks.recent(any(), anyInt())).thenReturn(List.of());
        mockMvc.perform(get(
                        "/edge-api/v1/analytics/v1/admin/benchmark/runs")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void liveDlqListRejectsNonAdmin() throws Exception {
        mockMvc.perform(get("/edge-api/v1/analytics/v1/admin/live-dlq")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void liveDlqListReturnsEntries() throws Exception {
        when(liveDlq.list(eq(false), eq(200)))
                .thenReturn(List.of());
        when(liveDlq.countAll()).thenReturn(0L);
        when(liveDlq.countGaveUp()).thenReturn(0L);
        when(liveRetryWorker.stats()).thenReturn(
                new ug.ac.mak.der.analytics.dlq
                        .AnalyticsLiveRetryWorker.RetryStats(0, 0, 0, 0));
        mockMvc.perform(get("/edge-api/v1/analytics/v1/admin/live-dlq")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.worker.retried").value(0));
    }

    @Test
    void liveDlqRetryNotFoundReturns404() throws Exception {
        when(liveRetryWorker.retryNow(any())).thenReturn(false);
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/live-dlq/"
                        + UUID.randomUUID() + "/retry")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void liveDlqRetryRejectsInvalidId() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/live-dlq/not-a-uuid/retry")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_ID"));
    }

    @Test
    void replayVerifyRejectsNonAdmin() throws Exception {
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/replay-verify")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void replayVerifyReturnsReport() throws Exception {
        when(replayVerifier.verify(anyInt())).thenReturn(
                new ug.ac.mak.der.analytics.replay
                        .AnalyticsBaselineVerifier.BaselineReport(
                        3, 3, 0, 0, List.of()));
        mockMvc.perform(post(
                        "/edge-api/v1/analytics/v1/admin/replay-verify")
                        .with(as(EdgeRole.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cellsChecked").value(3))
                .andExpect(jsonPath("$.cellsOk").value(3))
                .andExpect(jsonPath("$.cellsDrifted").value(0));
    }

    @Test
    void drilldownReturnsRowsForReviewer() throws Exception {
        final UUID metricId = UUID.randomUUID();
        when(drilldown.drilldown(any(), any()))
                .thenReturn(new ug.ac.mak.der.analytics.drilldown
                        .AnalyticsDrilldownService.Result(UUID.randomUUID(),
                        ug.ac.mak.der.analytics.drilldown
                                .AnalyticsDrilldownService.DrilldownOutcome.OK,
                        false, 1,
                        List.of(new ug.ac.mak.der.analytics.drilldown
                                .AnalyticsDrilldownService.SourceRow(
                                "ev-1", "EVENT",
                                java.time.LocalDate.of(2026, 11, 3),
                                "COMPLETED", "OU-A", "PS-UID", "pt-abc123")),
                        null));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/drilldown")
                        .contentType("application/json")
                        .content("{\"metricId\":\"" + metricId
                                + "\",\"periodKey\":\"202611\","
                                + "\"orgUnitUid\":\"OU-A\"}")
                        .with(as(EdgeRole.REVIEWER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("OK"))
                .andExpect(jsonPath("$.rowCount").value(1))
                .andExpect(jsonPath("$.rows[0].maskedSubjectId").value("pt-abc123"));
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
    void queryRoutesToColumnarWhenPlannerPicksIt() throws Exception {
        final UUID metric = UUID.randomUUID();
        when(planSelector.select(any())).thenReturn(
                new ug.ac.mak.der.analytics.column.exec
                        .PlanSelector.PlanDecision(
                        ug.ac.mak.der.analytics.column.exec
                                .PlanSelector.Engine.COLUMNAR,
                        50.0, 500.0, 1, 10,
                        1L, java.time.Instant.now(), false,
                        "columnar cheaper"));
        when(columnarQueryEngine.query(any())).thenReturn(List.of(
                new AnalyticsCell(metric, 1, "202611", "OU-A", "",
                        5L, null, new BigDecimal("5"),
                        null, null,
                        Instant.parse("2026-11-10T12:00:00Z"),
                        "VERIFIED")));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/query")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.engine").value("columnar"))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.cells[0].countValue").value(5));
    }

    @Test
    void queryRoutesToRowStoreWhenPlannerPrefersIt() throws Exception {
        final UUID metric = UUID.randomUUID();
        when(planSelector.select(any())).thenReturn(
                new ug.ac.mak.der.analytics.column.exec
                        .PlanSelector.PlanDecision(
                        ug.ac.mak.der.analytics.column.exec
                                .PlanSelector.Engine.ROW_STORE,
                        9999.0, 100.0, 0, 5,
                        null, null, false,
                        "no columnar segments"));
        when(repo.queryCells(any())).thenReturn(List.of(
                new AnalyticsCell(metric, 1, "202611", "OU-A", "",
                        7L, null, new BigDecimal("7"),
                        null, null,
                        Instant.parse("2026-11-10T12:00:00Z"),
                        "VERIFIED")));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/query")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.engine").value("row_store"))
                .andExpect(jsonPath("$.engineRationale")
                        .value("no columnar segments"))
                .andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void queryFallsBackToRowStoreWhenColumnarIoFails() throws Exception {
        final UUID metric = UUID.randomUUID();
        when(planSelector.select(any())).thenReturn(
                new ug.ac.mak.der.analytics.column.exec
                        .PlanSelector.PlanDecision(
                        ug.ac.mak.der.analytics.column.exec
                                .PlanSelector.Engine.COLUMNAR,
                        50.0, 500.0, 1, 10,
                        1L, java.time.Instant.now(), false,
                        "columnar cheaper"));
        when(columnarQueryEngine.query(any()))
                .thenThrow(new java.io.IOException("disk gone"));
        when(repo.queryCells(any())).thenReturn(List.of(
                new AnalyticsCell(metric, 1, "202611", "OU-A", "",
                        3L, null, new BigDecimal("3"),
                        null, null,
                        Instant.parse("2026-11-10T12:00:00Z"),
                        "VERIFIED")));
        mockMvc.perform(post("/edge-api/v1/analytics/v1/query")
                        .with(as(EdgeRole.OPERATOR))
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.engine").value("row_store"))
                .andExpect(jsonPath("$.engineRationale")
                        .value(org.hamcrest.Matchers.containsString(
                                "columnar I/O failed")));
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
