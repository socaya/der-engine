package ug.ac.mak.der.web;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.analytics.engine.AnalyticsCapabilities;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsContributionRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinitionService;
import ug.ac.mak.der.analytics.engine.AnalyticsDimension;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsIngestionService;
import ug.ac.mak.der.analytics.engine.AnalyticsPeriodEnumerator;
import ug.ac.mak.der.analytics.engine.AnalyticsObservability;
import ug.ac.mak.der.analytics.engine.OptionSetLookup;
import ug.ac.mak.der.analytics.engine.ProgramIndicatorSyncService;
import ug.ac.mak.der.analytics.expression.ExpressionCompiler;
import java.util.Optional;

import ug.ac.mak.der.analytics.benchmark.AnalyticsBenchmarkFixtureGenerator;
import ug.ac.mak.der.analytics.column.exec.ColumnarExplainer;
import ug.ac.mak.der.analytics.column.exec.PlanSelector;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarSink;
import ug.ac.mak.der.analytics.column.sink.AnalyticsColumnarVerifier;
import ug.ac.mak.der.analytics.benchmark.AnalyticsBenchmarkRun;
import ug.ac.mak.der.analytics.benchmark.AnalyticsBenchmarkService;
import ug.ac.mak.der.analytics.dlq.AnalyticsLiveDlqEntry;
import ug.ac.mak.der.analytics.dlq.AnalyticsLiveDlqRepository;
import ug.ac.mak.der.analytics.dlq.AnalyticsLiveRetryWorker;
import ug.ac.mak.der.analytics.drilldown.AnalyticsDrilldownService;
import ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliation;
import ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationFetcher;
import ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationRepository;
import ug.ac.mak.der.analytics.reconciliation.AnalyticsReconciliationService;
import ug.ac.mak.der.analytics.publication.PublicationMapping;
import ug.ac.mak.der.analytics.replay.AnalyticsBaselineVerifier;
import ug.ac.mak.der.analytics.publication.PublicationProposal;
import ug.ac.mak.der.analytics.publication.PublicationProposalService;
import ug.ac.mak.der.analytics.publication.PublicationRepository;

import com.fasterxml.jackson.databind.ObjectMapper;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * REST surface for the DER Analytics engine v1 (docs/apps/analytics,
 * spec §9). Namespaced under {@code /edge-api/v1/analytics/v1} so
 * the earlier {@link AnalyticsController} facility-summary endpoints
 * stay untouched.
 *
 * <p>Phase 1 scope — read-only + stubs:</p>
 * <ul>
 *   <li>{@code GET  /capabilities} — compatibility manifest.</li>
 *   <li>{@code GET  /periods?type=&year=} — canonical period windows.</li>
 *   <li>{@code GET  /metrics} — definitions catalogue.</li>
 *   <li>{@code GET  /explain/{metricId}} — one definition in detail.</li>
 *   <li>{@code POST /query} — matrix of analytics cells.</li>
 *   <li>{@code POST /timeseries} — single metric, multiple periods.</li>
 *   <li>{@code GET  /quality} — quality-state counts + source cursors.</li>
 *   <li>{@code GET  /admin/jobs} — Phase-1 stub, always returns idle.</li>
 *   <li>{@code POST /admin/recompute} — Phase-1 stub, 202 queued.</li>
 * </ul>
 *
 * <p>Ingestion, publication proposals, drilldown and reconciliation
 * land in subsequent phases (P2–P6 per spec §15).</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/analytics/v1",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AnalyticsEngineController {

    private final AnalyticsEngineRepository repo;
    private final AnalyticsPeriodEnumerator periods;
    private final AnalyticsIngestionService ingestion;
    private final AnalyticsContributionRepository contributions;
    private final ExpressionCompiler compiler;
    private final AnalyticsDefinitionService definitions;
    private final OptionSetLookup optionSets;
    private final ObjectMapper jsonMapper;
    private final ProgramIndicatorSyncService piSync;
    private final PublicationProposalService publication;
    private final PublicationRepository publicationRepo;
    private final AnalyticsObservability metrics;
    private final AnalyticsDrilldownService drilldown;
    private final AnalyticsReconciliationService reconciliation;
    private final AnalyticsReconciliationRepository reconciliationRepo;
    private final AnalyticsBaselineVerifier replayVerifier;
    private final AnalyticsReconciliationFetcher reconciliationFetcher;
    private final AnalyticsLiveDlqRepository liveDlq;
    private final AnalyticsLiveRetryWorker liveRetryWorker;
    private final AnalyticsBenchmarkService benchmarks;
    private final AnalyticsBenchmarkFixtureGenerator fixtureGenerator;
    private final AnalyticsColumnarSink columnarSink;
    private final AnalyticsColumnarVerifier columnarVerifier;
    private final ColumnarExplainer columnarExplainer;
    private final PlanSelector planSelector;

    /** Phase 6 — minimum cell count for a non-suppressed value.
     *  Cells backed by fewer than this many contributions emit as
     *  {@code SUPPRESSED} with the value hidden. Zero disables
     *  suppression; sites with privacy regulations typically set
     *  this to 5. */
    @org.springframework.beans.factory.annotation.Value(
            "${der.analytics.min-cell-size:0}")
    private int minCellSize;

    public AnalyticsEngineController(final AnalyticsEngineRepository repo,
                                      final AnalyticsPeriodEnumerator periods,
                                      final AnalyticsIngestionService ingestion,
                                      final AnalyticsContributionRepository contributions,
                                      final ExpressionCompiler compiler,
                                      final AnalyticsDefinitionService definitions,
                                      final OptionSetLookup optionSets,
                                      final ObjectMapper jsonMapper,
                                      final ProgramIndicatorSyncService piSync,
                                      final PublicationProposalService publication,
                                      final PublicationRepository publicationRepo,
                                      final AnalyticsObservability metrics,
                                      final AnalyticsDrilldownService drilldown,
                                      final AnalyticsReconciliationService reconciliation,
                                      final AnalyticsReconciliationRepository reconciliationRepo,
                                      final AnalyticsBaselineVerifier replayVerifier,
                                      final AnalyticsReconciliationFetcher reconciliationFetcher,
                                      final AnalyticsLiveDlqRepository liveDlq,
                                      final AnalyticsLiveRetryWorker liveRetryWorker,
                                      final AnalyticsBenchmarkService benchmarks,
                                      final AnalyticsBenchmarkFixtureGenerator fixtureGenerator,
                                      final AnalyticsColumnarSink columnarSink,
                                      final AnalyticsColumnarVerifier columnarVerifier,
                                      final ColumnarExplainer columnarExplainer,
                                      final PlanSelector planSelector) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.periods = Objects.requireNonNull(periods, "periods");
        this.ingestion = Objects.requireNonNull(ingestion, "ingestion");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.compiler = Objects.requireNonNull(compiler, "compiler");
        this.definitions = Objects.requireNonNull(definitions, "definitions");
        this.optionSets = Objects.requireNonNull(optionSets, "optionSets");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.piSync = Objects.requireNonNull(piSync, "piSync");
        this.publication = Objects.requireNonNull(publication, "publication");
        this.publicationRepo = Objects.requireNonNull(publicationRepo,
                "publicationRepo");
        this.metrics = Objects.requireNonNull(metrics, "metrics");
        this.drilldown = Objects.requireNonNull(drilldown, "drilldown");
        this.reconciliation = Objects.requireNonNull(reconciliation,
                "reconciliation");
        this.reconciliationRepo = Objects.requireNonNull(reconciliationRepo,
                "reconciliationRepo");
        this.replayVerifier = Objects.requireNonNull(replayVerifier,
                "replayVerifier");
        this.reconciliationFetcher = Objects.requireNonNull(
                reconciliationFetcher, "reconciliationFetcher");
        this.liveDlq = Objects.requireNonNull(liveDlq, "liveDlq");
        this.liveRetryWorker = Objects.requireNonNull(liveRetryWorker,
                "liveRetryWorker");
        this.benchmarks = Objects.requireNonNull(benchmarks, "benchmarks");
        this.fixtureGenerator = Objects.requireNonNull(fixtureGenerator,
                "fixtureGenerator");
        this.columnarSink = Objects.requireNonNull(columnarSink,
                "columnarSink");
        this.columnarVerifier = Objects.requireNonNull(columnarVerifier,
                "columnarVerifier");
        this.columnarExplainer = Objects.requireNonNull(columnarExplainer,
                "columnarExplainer");
        this.planSelector = Objects.requireNonNull(planSelector,
                "planSelector");
    }

    /* ─────────────── /admin/observability ─────────────── */

    @GetMapping("/admin/observability")
    public ResponseEntity<Map<String, Object>> observability(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        return ResponseEntity.ok(metrics.snapshot());
    }

    /* ─────────────── /publication/* ─────────────── */

    public record MappingBody(
            String datasetUid,
            String dataElementUid,
            String categoryOptionComboUid,
            String attributeOptionComboUid,
            Map<String, String> dimensionFilter,
            String publicationMode,
            String overlapPolicy) { }

    @PostMapping("/admin/publication/mappings/{metricId}")
    public ResponseEntity<Map<String, Object>> createMapping(
            @PathVariable final String metricId,
            @RequestBody final MappingBody body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "mapping CRUD requires ADMIN"));
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BODY_REQUIRED"));
        }
        final UUID metric;
        try {
            metric = UUID.fromString(metricId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID",
                    "message", "metricId must be a UUID"));
        }
        final var def = repo.findDefinition(metric);
        if (def.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "code", "METRIC_NOT_FOUND"));
        }
        final PublicationMapping m = new PublicationMapping(
                UUID.randomUUID(),
                metric,
                def.get().definitionVersion(),
                body.datasetUid(),
                body.dataElementUid(),
                body.categoryOptionComboUid(),
                body.attributeOptionComboUid(),
                body.dimensionFilter() == null
                        ? Map.of() : body.dimensionFilter(),
                PublicationMapping.Mode.valueOf(
                        body.publicationMode() == null
                                ? "REVIEW_REQUIRED"
                                : body.publicationMode()),
                body.overlapPolicy() == null
                        ? "EXCLUSIVE_CELL_OWNER"
                        : body.overlapPolicy(),
                Instant.now(), Instant.now());
        publicationRepo.insertMapping(m);
        return ResponseEntity.status(201).body(Map.of(
                "mappingId", m.mappingId().toString(),
                "metricId", m.metricId().toString()));
    }

    @GetMapping("/publication/mappings")
    public ResponseEntity<Map<String, Object>> listMappings(
            @RequestParam(name = "metricId", required = false)
            final String metricIdRaw,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        UUID metric = null;
        if (metricIdRaw != null && !metricIdRaw.isBlank()) {
            try {
                metric = UUID.fromString(metricIdRaw);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INVALID_ID"));
            }
        }
        final List<PublicationMapping> rows =
                publicationRepo.listMappings(metric);
        return ResponseEntity.ok(Map.of(
                "count", rows.size(),
                "mappings", rows.stream()
                        .map(AnalyticsEngineController::mappingJson)
                        .toList()));
    }

    @DeleteMapping("/admin/publication/mappings/{mappingId}")
    public ResponseEntity<Map<String, Object>> deleteMapping(
            @PathVariable final String mappingId,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final UUID id;
        try {
            id = UUID.fromString(mappingId);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID"));
        }
        final int n = publicationRepo.deleteMapping(id);
        return n > 0 ? ResponseEntity.ok(Map.of("deleted", true))
                : ResponseEntity.status(404).body(Map.of(
                        "code", "MAPPING_NOT_FOUND"));
    }

    public record GenerateProposalsBody(String metricId, String periodKey) { }

    @PostMapping("/admin/publication/proposals")
    public ResponseEntity<Map<String, Object>> generateProposals(
            @RequestBody(required = false) final GenerateProposalsBody body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        UUID metric = null;
        if (body != null && body.metricId() != null) {
            try {
                metric = UUID.fromString(body.metricId());
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INVALID_ID"));
            }
        }
        final var r = publication.generate(
                new PublicationProposalService.GenerateScope(metric,
                        body == null ? null : body.periodKey()));
        return ResponseEntity.ok(Map.of(
                "mappingsConsidered", r.mappingsConsidered(),
                "cellsScanned", r.cellsScanned(),
                "proposalsUpserted", r.proposalsUpserted(),
                "proposalIds", r.proposalIds().stream()
                        .map(UUID::toString).toList()));
    }

    @GetMapping("/publication/proposals")
    public ResponseEntity<Map<String, Object>> listProposals(
            @RequestParam(name = "metricId", required = false)
            final String metricIdRaw,
            @RequestParam(name = "state", required = false)
            final String state,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        UUID metric = null;
        if (metricIdRaw != null && !metricIdRaw.isBlank()) {
            try {
                metric = UUID.fromString(metricIdRaw);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INVALID_ID"));
            }
        }
        final List<PublicationProposal> rows =
                publicationRepo.listProposals(metric, state);
        return ResponseEntity.ok(Map.of(
                "count", rows.size(),
                "stateCounts", publicationRepo.stateCounts(),
                "proposals", rows.stream()
                        .map(AnalyticsEngineController::proposalJson)
                        .toList()));
    }

    public record ReviewBody(
            BigDecimal reviewedValue,
            String reason) { }

    @PostMapping("/admin/publication/proposals/{id}/approve")
    public ResponseEntity<Map<String, Object>> approveProposal(
            @PathVariable final String id,
            @RequestBody(required = false) final ReviewBody body,
            final Authentication auth) {
        return reviewProposal(id, body, auth, true);
    }

    @PostMapping("/admin/publication/proposals/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectProposal(
            @PathVariable final String id,
            @RequestBody(required = false) final ReviewBody body,
            final Authentication auth) {
        return reviewProposal(id, body, auth, false);
    }

    private ResponseEntity<Map<String, Object>> reviewProposal(
            final String id, final ReviewBody body,
            final Authentication auth, final boolean approve) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final UUID pid;
        try {
            pid = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID"));
        }
        final UUID reviewer = principal.user().userId();
        final Optional<PublicationProposal> updated = approve
                ? publication.approve(pid,
                        body == null ? null : body.reviewedValue(),
                        body == null ? null : body.reason(),
                        reviewer)
                : publication.reject(pid,
                        body == null ? null : body.reason(),
                        reviewer);
        return updated.map(p -> ResponseEntity.ok(proposalJson(p)))
                .orElse(ResponseEntity.status(404).body(Map.of(
                        "code", "PROPOSAL_NOT_FOUND")));
    }

    private static Map<String, Object> mappingJson(
            final PublicationMapping m) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("mappingId", m.mappingId().toString());
        out.put("metricId", m.metricId().toString());
        out.put("definitionVersion", m.definitionVersion());
        out.put("datasetUid", m.datasetUid());
        out.put("dataElementUid", m.dataElementUid());
        out.put("categoryOptionComboUid", m.categoryOptionComboUid());
        out.put("attributeOptionComboUid", m.attributeOptionComboUid());
        out.put("dimensionFilter", m.dimensionFilter());
        out.put("publicationMode", m.publicationMode().name());
        out.put("overlapPolicy", m.overlapPolicy());
        out.put("createdAt", m.createdAt() == null
                ? null : m.createdAt().toString());
        out.put("updatedAt", m.updatedAt() == null
                ? null : m.updatedAt().toString());
        return out;
    }

    private static Map<String, Object> proposalJson(
            final PublicationProposal p) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("proposalId", p.proposalId().toString());
        out.put("mappingId", p.mappingId().toString());
        out.put("metricId", p.metricId().toString());
        out.put("datasetUid", p.datasetUid());
        out.put("dataElementUid", p.dataElementUid());
        out.put("categoryOptionComboUid", p.categoryOptionComboUid());
        out.put("attributeOptionComboUid", p.attributeOptionComboUid());
        out.put("periodKey", p.periodKey());
        out.put("orgUnitUid", p.orgUnitUid());
        out.put("proposedValue",
                p.proposedValue() == null ? null
                        : p.proposedValue().toPlainString());
        out.put("reviewedValue",
                p.reviewedValue() == null ? null
                        : p.reviewedValue().toPlainString());
        out.put("state", p.state().name());
        out.put("reviewReason", p.reviewReason());
        out.put("reviewedBy", p.reviewedBy() == null
                ? null : p.reviewedBy().toString());
        out.put("reviewedAt", p.reviewedAt() == null
                ? null : p.reviewedAt().toString());
        out.put("createdAt", p.createdAt() == null
                ? null : p.createdAt().toString());
        out.put("updatedAt", p.updatedAt() == null
                ? null : p.updatedAt().toString());
        return out;
    }

    /* ─────────────── /capabilities ─────────────── */

    @GetMapping("/capabilities")
    public ResponseEntity<Map<String, Object>> capabilities(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(AnalyticsCapabilities.manifest());
    }

    /* ─────────────── /periods ─────────────── */

    @GetMapping("/periods")
    public ResponseEntity<Map<String, Object>> periods(
            @RequestParam("type") final String typeRaw,
            @RequestParam("year") final int year,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final AnalyticsPeriodEnumerator.Type type =
                AnalyticsPeriodEnumerator.resolve(typeRaw);
        if (type == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "PERIOD_TYPE_UNSUPPORTED",
                    "message", "period type '" + typeRaw
                            + "' is not enabled in Phase 1 "
                            + "(fiscal variants need version verification)",
                    "supported", Arrays.stream(AnalyticsPeriodEnumerator.Type.values())
                            .map(Enum::name).toList()));
        }
        final List<AnalyticsPeriodEnumerator.Window> ws;
        try {
            ws = periods.enumerate(type, year);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "PERIOD_YEAR_OUT_OF_RANGE",
                    "message", ex.getMessage()));
        }
        final List<Map<String, Object>> rows = new ArrayList<>(ws.size());
        for (final AnalyticsPeriodEnumerator.Window w : ws) {
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", w.id());
            row.put("startDate", w.startDate().toString());
            row.put("endDate", w.endDate().toString());
            rows.add(row);
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type.name());
        body.put("year", year);
        body.put("count", rows.size());
        body.put("periods", rows);
        return ResponseEntity.ok(body);
    }

    /* ─────────────── /metrics ─────────────── */

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> listMetrics(
            @RequestParam(name = "supportState", required = false)
            final String supportState,
            @RequestParam(name = "limit", defaultValue = "200")
            final int limit,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<AnalyticsDefinition> defs =
                repo.listDefinitions(supportState, limit);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("count", defs.size());
        body.put("metrics", defs.stream()
                .map(AnalyticsEngineController::definitionJson)
                .toList());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/explain/{metricId}")
    public ResponseEntity<Map<String, Object>> explain(
            @PathVariable final String metricId,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final UUID id;
        try {
            id = UUID.fromString(metricId);
        } catch (IllegalArgumentException ex) {
            // Fall back to code-based lookup — operators often paste the
            // canonical code (e.g. "OPPI0001") rather than the UUID.
            return repo.findDefinitionByCode(metricId)
                    .map(d -> ResponseEntity.ok(definitionJson(d)))
                    .orElse(ResponseEntity.status(404).body(Map.of(
                            "code", "METRIC_NOT_FOUND",
                            "message", "no analytics definition for '"
                                    + metricId + "'")));
        }
        return repo.findDefinition(id)
                .map(d -> ResponseEntity.ok(definitionJson(d)))
                .orElse(ResponseEntity.status(404).body(Map.of(
                        "code", "METRIC_NOT_FOUND",
                        "message", "no analytics definition for '"
                                + metricId + "'")));
    }

    /* ─────────────── /query + /timeseries ─────────────── */

    public record QueryBody(
            List<String> metrics,
            PeriodRef period,
            List<PeriodRef> periods,
            List<String> orgUnits,
            Map<String, String> dimensions,
            Page page) {

        public QueryBody {
            dimensions = dimensions == null ? Map.of()
                    : Map.copyOf(dimensions);
        }

        /** Legacy 5-arg form for Phase 1-3 clients. */
        public QueryBody(final List<String> metrics,
                           final PeriodRef period,
                           final List<PeriodRef> periods,
                           final List<String> orgUnits,
                           final Page page) {
            this(metrics, period, periods, orgUnits, Map.of(), page);
        }

        public record PeriodRef(String type, String id) { }
        public record Page(int limit, Integer offset) { }
    }

    @PostMapping("/query")
    public ResponseEntity<Map<String, Object>> query(
            @RequestBody(required = false) final QueryBody body,
            final Authentication auth) {
        final long t0 = System.currentTimeMillis();
        try {
            if (!(auth instanceof EdgeUserPrincipal)) {
                return ResponseEntity.status(401).build();
            }
            final QueryBody q = body == null
                    ? new QueryBody(List.of(), null, null, List.of(), null) : body;
            final List<UUID> metricIds = resolveMetricIds(q.metrics());
            final List<String> periodKeys = new ArrayList<>();
            if (q.period() != null && q.period().id() != null) {
                periodKeys.add(q.period().id());
            }
            if (q.periods() != null) {
                for (final QueryBody.PeriodRef p : q.periods()) {
                    if (p != null && p.id() != null) {
                        periodKeys.add(p.id());
                    }
                }
            }
            final AnalyticsEngineRepository.CellQuery cq =
                    new AnalyticsEngineRepository.CellQuery(
                            metricIds, periodKeys,
                            q.orgUnits() == null ? List.of() : q.orgUnits(),
                            q.dimensions() == null ? Map.of() : q.dimensions(),
                            q.page() == null ? 500 : Math.max(1, q.page().limit()),
                            q.page() == null || q.page().offset() == null
                                    ? 0 : q.page().offset());
            final List<AnalyticsCell> cells = repo.queryCells(cq);
            final OptionSetLookup.Cache osCache = optionSets.cache();
            final Map<java.util.UUID, List<AnalyticsDimension>> dimsByMetric
                    = new java.util.HashMap<>();
            for (final AnalyticsCell c : cells) {
                dimsByMetric.computeIfAbsent(c.metricId(), id ->
                        loadDimensions(id));
            }
            // Phase 6 — apply suppression: any cell whose countValue is
            // below minCellSize emits with value/sum/numerator/denominator
            // nulled and qualityState set to SUPPRESSED. Preserves cell
            // existence + dimension identity so pivots don't lose
            // columns, just the specific numbers.
            long suppressed = 0;
            final List<AnalyticsCell> rendered = new ArrayList<>(cells.size());
            for (final AnalyticsCell c : cells) {
                if (minCellSize > 0 && c.countValue() != null
                        && c.countValue() < minCellSize) {
                    rendered.add(suppress(c));
                    suppressed++;
                } else {
                    rendered.add(c);
                }
            }
            if (suppressed > 0) {
                metrics.bumpSuppressed(suppressed);
            }
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("count", rendered.size());
            out.put("suppressedCount", suppressed);
            out.put("freshnessAt", Instant.now().toString());
            out.put("cells", rendered.stream()
                    .map(c -> cellJson(c, dimsByMetric.get(c.metricId()),
                            osCache))
                    .toList());
            return ResponseEntity.ok(out);
        } finally {
            metrics.record("query",
                    System.currentTimeMillis() - t0);
        }
    }

    private static AnalyticsCell suppress(final AnalyticsCell c) {
        return new AnalyticsCell(
                c.metricId(), c.definitionVersion(),
                c.periodKey(), c.orgUnitUid(), c.dimensionKey(),
                null, null, null, null, null,
                c.freshnessAt(), "SUPPRESSED");
    }

    /** Load a metric's declared dimensions from its stored JSONB
     *  body. Returns empty list on any read / parse failure so a
     *  bad definition never fails the whole query. */
    private List<AnalyticsDimension> loadDimensions(
            final java.util.UUID metricId) {
        try {
            return repo.findDefinition(metricId).map(d -> {
                final String body = repo.loadDefinitionBody(metricId);
                return AnalyticsDefinitionService.parseDimensions(
                        jsonMapper, body);
            }).orElse(List.of());
        } catch (RuntimeException ex) {
            return List.of();
        }
    }

    @PostMapping("/timeseries")
    public ResponseEntity<Map<String, Object>> timeseries(
            @RequestBody(required = false) final QueryBody body,
            final Authentication auth) {
        // Phase 1 shares the same cell read-path as /query; the
        // distinction will emerge in Phase 2 when timeseries picks up
        // partial-period flags + period alignment logic (AN-FR-033).
        return query(body, auth);
    }

    /* ─────────────── /drilldown ─────────────── */

    public record DrilldownBody(
            String metricId,
            String periodKey,
            String orgUnitUid,
            String dimensionKey,
            String purpose,
            Integer limit) { }

    /** Spec §11 drilldown + privacy contract. Returns authorised
     *  source contributions for a specific materialised cell.
     *  Suppressed cells, unauthorised roles and unknown cells all
     *  land here with an audit row written before the response. */
    @PostMapping("/drilldown")
    public ResponseEntity<Map<String, Object>> drilldown(
            @RequestBody(required = false) final DrilldownBody body,
            final jakarta.servlet.http.HttpServletRequest request,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.metricId() == null
                || body.periodKey() == null || body.orgUnitUid() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_REQUEST",
                    "message", "metricId, periodKey, orgUnitUid required"));
        }
        final UUID metricId;
        try {
            metricId = UUID.fromString(body.metricId());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID"));
        }
        final EdgeRole role = principal.user().roles().contains(EdgeRole.ADMIN)
                ? EdgeRole.ADMIN
                : principal.user().roles().contains(EdgeRole.REVIEWER)
                        ? EdgeRole.REVIEWER
                        : EdgeRole.OPERATOR;
        final AnalyticsDrilldownService.Caller caller =
                new AnalyticsDrilldownService.Caller(
                        principal.user().userId(), role,
                        request == null ? null : request.getRemoteAddr());
        final AnalyticsDrilldownService.Request r =
                new AnalyticsDrilldownService.Request(
                        metricId, body.periodKey(), body.orgUnitUid(),
                        body.dimensionKey(), body.purpose(),
                        body.limit() == null ? 0 : body.limit());
        final AnalyticsDrilldownService.Result result =
                drilldown.drilldown(caller, r);
        final int status = switch (result.outcome()) {
            case OK, SUPPRESSED -> 200;
            case UNAUTHORISED -> 403;
            case METRIC_NOT_FOUND, CELL_NOT_FOUND -> 404;
        };
        return ResponseEntity.status(status)
                .body(AnalyticsDrilldownService.asMap(result));
    }

    /* ─────────────── /admin/segments ─────────────── */

    /** SRS Gate 2.8 — snapshot every materialised cell into
     *  columnar segments and publish a new manifest generation.
     *  Returns compression evidence so the operator can see the
     *  ratio against the uncompressed baseline (owner emphasis). */
    @PostMapping("/admin/segments/flush")
    public ResponseEntity<Map<String, Object>> flushColumnarSegments(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        try {
            final var r = columnarSink.flush();
            return ResponseEntity.ok(Map.of(
                    "generation", r.generation(),
                    "segmentsWritten", r.segmentsWritten(),
                    "rowsWritten", r.rowsWritten(),
                    "bytesWritten", r.bytesWritten(),
                    "compressionRatio", r.compressionRatio(),
                    "manifestPath", r.manifestPath()));
        } catch (java.io.IOException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "FLUSH_IO_FAILURE",
                    "message", ex.getMessage()));
        }
    }

    /** SRS §13.1 oracle verification. Read every segment from the
     *  current manifest and compare row-by-row against the row-
     *  store cells. Zero drift is the gate Gate 3 vectorised
     *  reads will require before shipping. */
    @PostMapping("/admin/segments/verify")
    public ResponseEntity<Map<String, Object>> verifyColumnarSegments(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        try {
            final var r = columnarVerifier.verify();
            final List<Map<String, Object>> drifts =
                    new ArrayList<>(r.drifts().size());
            for (final var d : r.drifts()) {
                final Map<String, Object> m = new LinkedHashMap<>();
                m.put("metricId", d.metricId().toString());
                m.put("periodKey", d.periodKey());
                m.put("orgUnitUid", d.orgUnitUid());
                m.put("dimensionKey", d.dimensionKey());
                m.put("reason", d.reason());
                m.put("rowStoreValue", d.rowStoreValue());
                m.put("columnStoreValue", d.columnStoreValue());
                drifts.add(m);
            }
            return ResponseEntity.ok(Map.of(
                    "generation", r.generation(),
                    "segmentsChecked", r.segmentsChecked(),
                    "rowsChecked", r.rowsChecked(),
                    "rowsOk", r.rowsOk(),
                    "rowsDrifted", r.rowsDrifted(),
                    "drifts", drifts));
        } catch (java.io.IOException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "VERIFY_IO_FAILURE",
                    "message", ex.getMessage()));
        }
    }

    /** SRS FR-QRY-004 plan selection. Shows which engine the
     *  planner would route a query through and why. */
    @PostMapping("/admin/segments/plan")
    public ResponseEntity<Map<String, Object>> selectPlan(
            @RequestBody final ExplainBody body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final List<UUID> metricIds = new ArrayList<>();
        if (body != null && body.metricIds() != null) {
            for (final String s : body.metricIds()) {
                try {
                    metricIds.add(UUID.fromString(s));
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "INVALID_METRIC_ID",
                            "message", s));
                }
            }
        }
        final AnalyticsEngineRepository.CellQuery q =
                new AnalyticsEngineRepository.CellQuery(
                        metricIds,
                        body == null || body.periodKeys() == null
                                ? List.of() : body.periodKeys(),
                        body == null || body.orgUnits() == null
                                ? List.of() : body.orgUnits(),
                        Map.of(),
                        body == null || body.limit() == null
                                ? 2000 : body.limit(),
                        0);
        try {
            final var decision = planSelector.select(q);
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("selected", decision.selected().name());
            out.put("columnarCost", decision.columnarCost());
            out.put("rowStoreCost", decision.rowStoreCost());
            out.put("columnarSegments", decision.columnarSegments());
            out.put("rowStoreRows", decision.rowStoreRows());
            out.put("manifestGeneration", decision.manifestGeneration());
            out.put("manifestCreatedAt",
                    decision.manifestCreatedAt() == null
                            ? null : decision.manifestCreatedAt().toString());
            out.put("manifestStale", decision.manifestStale());
            out.put("rationale", decision.rationale());
            return ResponseEntity.ok(out);
        } catch (java.io.IOException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "PLAN_IO_FAILURE",
                    "message", ex.getMessage()));
        }
    }

    public record ExplainBody(
            List<String> metricIds,
            List<String> periodKeys,
            List<String> orgUnits,
            Integer limit) { }

    /** SRS FR-QRY-007 EXPLAIN. Shows which segments the columnar
     *  engine would open for a query and which it would prune,
     *  plus projected columns + filter description + estimated
     *  row count. Read-only — never touches segment bytes. */
    @PostMapping("/admin/segments/explain")
    public ResponseEntity<Map<String, Object>> explainColumnarQuery(
            @RequestBody final ExplainBody body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final List<UUID> metricIds = new ArrayList<>();
        if (body != null && body.metricIds() != null) {
            for (final String s : body.metricIds()) {
                try {
                    metricIds.add(UUID.fromString(s));
                } catch (IllegalArgumentException ex) {
                    return ResponseEntity.badRequest().body(Map.of(
                            "code", "INVALID_METRIC_ID",
                            "message", s));
                }
            }
        }
        final AnalyticsEngineRepository.CellQuery q =
                new AnalyticsEngineRepository.CellQuery(
                        metricIds,
                        body == null || body.periodKeys() == null
                                ? List.of() : body.periodKeys(),
                        body == null || body.orgUnits() == null
                                ? List.of() : body.orgUnits(),
                        Map.of(),
                        body == null || body.limit() == null
                                ? 2000 : body.limit(),
                        0);
        try {
            final var plan = columnarExplainer.explain(q);
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("generation", plan.generation());
            out.put("segmentsMatched", plan.segmentsMatched());
            out.put("segmentsSkipped", plan.segmentsSkipped());
            out.put("projectedColumns", plan.projectedColumns());
            out.put("filter", plan.filterDescription());
            out.put("rowLimit", plan.rowLimit());
            out.put("estimatedRows", plan.estimatedRows());
            out.put("estimatedTotalCost", plan.estimatedTotalCost());
            out.put("matched", plan.matched().stream()
                    .map(AnalyticsEngineController
                            ::explainSegmentJson).toList());
            out.put("skipped", plan.skipped().stream()
                    .map(AnalyticsEngineController
                            ::explainSegmentJson).toList());
            return ResponseEntity.ok(out);
        } catch (java.io.IOException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "EXPLAIN_IO_FAILURE",
                    "message", ex.getMessage()));
        }
    }

    private static Map<String, Object> explainSegmentJson(
            final ColumnarExplainer.SegmentPlan s) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("segmentId", s.segmentId().toString());
        m.put("metricId", s.metricId().toString());
        m.put("definitionVersion", s.definitionVersion());
        m.put("periodKey", s.periodKey());
        m.put("rowCount", s.rowCount());
        m.put("file", s.file());
        m.put("decision", s.decision());
        m.put("estimatedSelectivity", s.estimatedSelectivity());
        m.put("estimatedRowsOut", s.estimatedRowsOut());
        m.put("estimatedBytesScanned", s.estimatedBytesScanned());
        m.put("estimatedCost", s.estimatedCost());
        return m;
    }

    @GetMapping("/admin/segments/manifest")
    public ResponseEntity<Map<String, Object>> currentColumnarManifest(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        try {
            final var opt = columnarSink.currentManifest();
            if (opt.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "generation", -1,
                        "segmentCount", 0,
                        "message", "no manifest published yet"));
            }
            final var m = opt.get();
            return ResponseEntity.ok(Map.of(
                    "generation", m.generation(),
                    "createdAt", m.createdAt().toString(),
                    "engineVersion", m.engineVersion(),
                    "segmentCount", m.segments().size()));
        } catch (java.io.IOException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "MANIFEST_IO_FAILURE",
                    "message", ex.getMessage()));
        }
    }

    /* ─────────────── /admin/benchmark ─────────────── */

    @PostMapping("/admin/benchmark/latency")
    public ResponseEntity<Map<String, Object>> benchLatency(
            @RequestParam(name = "iterations", required = false,
                    defaultValue = "100") final int iterations,
            @RequestParam(name = "p95CeilingMillis", required = false,
                    defaultValue = "2000") final int p95CeilingMillis,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final var v = benchmarks.latency(iterations, p95CeilingMillis);
        return ResponseEntity.ok(AnalyticsBenchmarkService.asJson(v));
    }

    @PostMapping("/admin/benchmark/freshness")
    public ResponseEntity<Map<String, Object>> benchFreshness(
            @RequestParam(name = "iterations", required = false,
                    defaultValue = "100") final int iterations,
            @RequestParam(name = "p95CeilingMillis", required = false,
                    defaultValue = "10000") final int p95CeilingMillis,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final var v = benchmarks.freshness(iterations, p95CeilingMillis);
        return ResponseEntity.ok(AnalyticsBenchmarkService.asJson(v));
    }

    public record BenchmarkSeedBody(
            String orgUnitUid,
            Integer teiCount,
            Integer eventsPerTei,
            Long seed) { }

    @PostMapping("/admin/benchmark/seed")
    public ResponseEntity<Map<String, Object>> benchmarkSeed(
            @RequestBody final BenchmarkSeedBody body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        if (body == null || body.orgUnitUid() == null
                || body.orgUnitUid().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_REQUEST",
                    "message", "orgUnitUid is required"));
        }
        final AnalyticsBenchmarkFixtureGenerator.SeedRequest req =
                new AnalyticsBenchmarkFixtureGenerator.SeedRequest(
                        body.orgUnitUid(),
                        body.teiCount() == null ? 100 : body.teiCount(),
                        body.eventsPerTei() == null ? 10
                                : body.eventsPerTei(),
                        body.seed() == null ? 42L : body.seed());
        try {
            final var r = fixtureGenerator.seed(req,
                    principal.user().userId());
            return ResponseEntity.ok(Map.of(
                    "teisCreated", r.teisCreated(),
                    "enrollmentsCreated", r.enrollmentsCreated(),
                    "eventsCreated", r.eventsCreated(),
                    "programUid", r.programUid()));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_REQUEST",
                    "message", ex.getMessage()));
        }
    }

    @PostMapping("/admin/benchmark/seed/cleanup")
    public ResponseEntity<Map<String, Object>> benchmarkSeedCleanup(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final var r = fixtureGenerator.cleanup();
        return ResponseEntity.ok(Map.of(
                "eventsDeleted", r.eventsDeleted(),
                "enrollmentsDeleted", r.enrollmentsDeleted(),
                "teisDeleted", r.teisDeleted()));
    }

    @GetMapping("/admin/benchmark/runs")
    public ResponseEntity<Map<String, Object>> benchmarkRuns(
            @RequestParam(name = "operation", required = false)
            final String operationRaw,
            @RequestParam(name = "limit", required = false,
                    defaultValue = "50") final int limit,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        AnalyticsBenchmarkRun.Operation op = null;
        if (operationRaw != null && !operationRaw.isBlank()) {
            try {
                op = AnalyticsBenchmarkRun.Operation.valueOf(
                        operationRaw.toUpperCase());
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INVALID_OPERATION"));
            }
        }
        final List<AnalyticsBenchmarkRun> rows = benchmarks.recent(op, limit);
        return ResponseEntity.ok(Map.of(
                "count", rows.size(),
                "runs", AnalyticsBenchmarkService.asJson(rows)));
    }

    /* ─────────────── /admin/live-dlq ─────────────── */

    @GetMapping("/admin/live-dlq")
    public ResponseEntity<Map<String, Object>> listLiveDlq(
            @RequestParam(name = "gaveUpOnly", required = false,
                    defaultValue = "false") final boolean gaveUpOnly,
            @RequestParam(name = "limit", required = false,
                    defaultValue = "200") final int limit,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final List<AnalyticsLiveDlqEntry> rows = liveDlq.list(
                gaveUpOnly, limit);
        return ResponseEntity.ok(Map.of(
                "count", rows.size(),
                "totalCount", liveDlq.countAll(),
                "gaveUpCount", liveDlq.countGaveUp(),
                "entries", rows.stream()
                        .map(AnalyticsEngineController::liveDlqJson)
                        .toList(),
                "worker", Map.of(
                        "retried", liveRetryWorker.stats().retried(),
                        "recovered", liveRetryWorker.stats().recovered(),
                        "gaveUp", liveRetryWorker.stats().gaveUp(),
                        "lastRunAt", liveRetryWorker.stats().lastRunAt())));
    }

    @PostMapping("/admin/live-dlq/{id}/retry")
    public ResponseEntity<Map<String, Object>> retryLiveDlqEntry(
            @PathVariable final String id,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final UUID dlqId;
        try {
            dlqId = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID"));
        }
        final boolean ok = liveRetryWorker.retryNow(dlqId);
        if (!ok) {
            return ResponseEntity.status(404).body(Map.of(
                    "code", "NOT_FOUND"));
        }
        return ResponseEntity.ok(Map.of("scheduled", true,
                "dlqId", dlqId.toString()));
    }

    @DeleteMapping("/admin/live-dlq/{id}")
    public ResponseEntity<Map<String, Object>> deleteLiveDlqEntry(
            @PathVariable final String id,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final UUID dlqId;
        try {
            dlqId = UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID"));
        }
        final int removed = liveDlq.remove(dlqId);
        if (removed == 0) {
            return ResponseEntity.status(404).body(Map.of(
                    "code", "NOT_FOUND"));
        }
        return ResponseEntity.ok(Map.of("removed", true,
                "dlqId", dlqId.toString()));
    }

    private static Map<String, Object> liveDlqJson(
            final AnalyticsLiveDlqEntry e) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("dlqId", e.dlqId().toString());
        out.put("sourceType", e.sourceType().name());
        out.put("sourceKey", e.sourceKey());
        out.put("sourceVersion", e.sourceVersion());
        out.put("occurredOn", e.occurredOn().toString());
        out.put("orgUnitUid", e.orgUnitUid());
        out.put("status", e.status());
        out.put("errorSummary", e.errorSummary());
        out.put("attemptCount", e.attemptCount());
        out.put("nextRetryAt", e.nextRetryAt().toString());
        out.put("gaveUp", e.gaveUp());
        out.put("lastAttemptedAt", e.lastAttemptedAt() == null ? null
                : e.lastAttemptedAt().toString());
        return out;
    }

    /* ─────────────── /admin/replay-verify ─────────────── */

    /** Spec §17 release gate — re-aggregate every materialised
     *  cell from the ledger and report any drift. Read-only; never
     *  rewrites cells. ADMIN only because a drifted cell is an
     *  operational incident, not an operator-facing number. */
    @PostMapping("/admin/replay-verify")
    public ResponseEntity<Map<String, Object>> replayVerify(
            @RequestParam(name = "limit", required = false,
                    defaultValue = "2000") final int limit,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final var report = replayVerifier.verify(limit);
        return ResponseEntity.ok(AnalyticsBaselineVerifier.asJson(report));
    }

    /* ─────────────── /reconciliation ─────────────── */

    @GetMapping("/reconciliation")
    public ResponseEntity<Map<String, Object>> listReconciliations(
            @RequestParam(name = "metricId", required = false)
            final String metricIdRaw,
            @RequestParam(name = "classification", required = false)
            final String classification,
            @RequestParam(name = "limit", required = false,
                    defaultValue = "200") final int limit,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        UUID metricId = null;
        if (metricIdRaw != null && !metricIdRaw.isBlank()) {
            try {
                metricId = UUID.fromString(metricIdRaw);
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "INVALID_ID"));
            }
        }
        final List<AnalyticsReconciliation> rows =
                reconciliationRepo.list(metricId, classification, limit);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("count", rows.size());
        body.put("byClassification",
                reconciliationRepo.classificationCounts());
        body.put("rows", AnalyticsReconciliationService.asJson(rows));
        return ResponseEntity.ok(body);
    }

    public record CentralSampleBody(
            String metricId,
            String periodKey,
            String orgUnitUid,
            String dimensionKey,
            BigDecimal centralValue,
            Integer centralDefinitionVersion,
            String centralRefreshAt,
            Boolean metricFormulaCompatibleWithCentral,
            Boolean sameOrgUnitAnchor,
            Boolean sameDateAnchor,
            Boolean sameDedupPolicy,
            Boolean hasRejectedTrackerUpdate,
            Boolean localHasUnpublishedSources,
            Boolean lateDataAfterRefresh,
            String lastLocalPublishAt) { }

    /** On-demand central fetch — polls DHIS2 /api/analytics.json
     *  for every PUBLISHED proposal and compares the result. The
     *  scheduler runs this at a fixed cadence; this endpoint
     *  lets admin tooling force an immediate pass. */
    @PostMapping("/admin/reconciliation/fetch")
    public ResponseEntity<Map<String, Object>> runReconciliationFetch(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final int upserts = reconciliationFetcher.runNow();
        final var stats = reconciliationFetcher.stats();
        return ResponseEntity.ok(Map.of(
                "rowsUpserted", upserts,
                "sampled", stats.sampled(),
                "fetchFailed", stats.fetchFailed(),
                "lastRunAt", stats.lastRunAt()));
    }

    /** Post a batch of authoritative central samples for comparison.
     *  Classifier-only slice — the DHIS2 /api/analytics fetch worker
     *  lands in a later slice; this endpoint lets admin tooling (or
     *  tests) drive the comparison deterministically. */
    @PostMapping("/admin/reconciliation/compare")
    public ResponseEntity<Map<String, Object>> compareReconciliations(
            @RequestBody(required = false) final List<CentralSampleBody> body,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN"));
        }
        final List<AnalyticsReconciliationService.CentralSample> samples =
                new ArrayList<>();
        if (body != null) {
            for (final CentralSampleBody b : body) {
                if (b == null || b.metricId() == null
                        || b.periodKey() == null || b.orgUnitUid() == null) {
                    continue;
                }
                final UUID id;
                try {
                    id = UUID.fromString(b.metricId());
                } catch (IllegalArgumentException ex) {
                    continue;
                }
                samples.add(new AnalyticsReconciliationService.CentralSample(
                        id, b.periodKey(), b.orgUnitUid(),
                        b.dimensionKey(), b.centralValue(),
                        b.centralDefinitionVersion(),
                        parseInstant(b.centralRefreshAt()),
                        Boolean.TRUE.equals(
                                b.metricFormulaCompatibleWithCentral()),
                        !Boolean.FALSE.equals(b.sameOrgUnitAnchor()),
                        !Boolean.FALSE.equals(b.sameDateAnchor()),
                        !Boolean.FALSE.equals(b.sameDedupPolicy()),
                        Boolean.TRUE.equals(b.hasRejectedTrackerUpdate()),
                        Boolean.TRUE.equals(b.localHasUnpublishedSources()),
                        Boolean.TRUE.equals(b.lateDataAfterRefresh()),
                        parseInstant(b.lastLocalPublishAt())));
            }
        }
        final var result = reconciliation.compare(samples);
        return ResponseEntity.ok(Map.of(
                "samplesConsidered", result.samplesConsidered(),
                "rowsUpserted", result.rowsUpserted(),
                "byClassification", result.byClassification()));
    }

    private static Instant parseInstant(final String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(s);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    /* ─────────────── /quality ─────────────── */

    @GetMapping("/quality")
    public ResponseEntity<Map<String, Object>> quality(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("qualityCounts", repo.qualityCounts());
        body.put("contributionsTotal", contributions.countAll());
        body.put("sourceCursors", repo.allCursors());
        body.put("reportedAt", Instant.now().toString());
        return ResponseEntity.ok(body);
    }

    /* ─────────────── /admin/* ─────────────── */

    @GetMapping("/admin/jobs")
    public ResponseEntity<Map<String, Object>> jobs(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // Phase 1 has no background materializer yet — report an idle
        // state so the admin UI can render the panel against a stable
        // contract. Phase 2 will fill `activeJobs` + lag metrics.
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("activeJobs", List.of());
        body.put("deadLetters", 0);
        body.put("staleCells", 0);
        body.put("reportedAt", Instant.now().toString());
        return ResponseEntity.ok(body);
    }

    public record IngestRequest(
            String orgUnit, String program,
            String fromDate, String toDate) { }

    /* ─────────────── /admin/compile ─────────────── */

    public record CompileRequest(String expression) { }

    @PostMapping("/admin/compile")
    public ResponseEntity<Map<String, Object>> compile(
            @RequestBody(required = false) final CompileRequest request,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "expression compile requires ADMIN"));
        }
        final String expr = request == null ? null : request.expression();
        final ExpressionCompiler.CompileResult r = compiler.compile(expr);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("expression", expr);
        body.put("supportState", r.supportState().name());
        body.put("diagnostics", r.diagnostics());
        body.put("referencedDataElements", r.referencedDataElements());
        body.put("referencedAttributes", r.referencedAttributes());
        body.put("referencedVariables", r.referencedVariables());
        body.put("referencedConstants", r.referencedConstants());
        body.put("referencedFunctions", r.referencedFunctions());
        body.put("parsed", r.parsed());
        body.put("reportedAt", Instant.now().toString());
        return ResponseEntity.ok(body);
    }

    /* ─────────────── /admin/definitions — CRUD ─────────────── */

    @PostMapping("/admin/definitions")
    public ResponseEntity<Map<String, Object>> createDefinition(
            @RequestBody(required = false)
            final AnalyticsDefinitionService.CreateRequest request,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "definition CRUD requires ADMIN"));
        }
        if (request == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "BODY_REQUIRED",
                    "message", "request body is required"));
        }
        final AnalyticsDefinitionService.CreateResult result =
                definitions.create(request);
        return switch (result.outcome()) {
            case CREATED -> ResponseEntity.status(201).body(
                    definitionResponse(result));
            case UNSUPPORTED -> ResponseEntity.status(422).body(
                    definitionResponse(result));
            case PARSE_ERROR -> ResponseEntity.badRequest().body(
                    definitionResponse(result));
            case CODE_TAKEN -> ResponseEntity.status(409).body(
                    definitionResponse(result));
            case VALIDATION_ERROR -> ResponseEntity.badRequest().body(
                    definitionResponse(result));
        };
    }

    @DeleteMapping("/admin/definitions/{id}")
    public ResponseEntity<Map<String, Object>> deprecateDefinition(
            @PathVariable final String id,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "definition deprecate requires ADMIN"));
        }
        final java.util.UUID uuid;
        try {
            uuid = java.util.UUID.fromString(id);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "INVALID_ID",
                    "message", "definition id must be a UUID"));
        }
        try {
            final boolean ok = definitions.deprecate(uuid);
            if (!ok) {
                return ResponseEntity.status(404).body(Map.of(
                        "code", "METRIC_NOT_FOUND",
                        "message", "no analytics definition for '"
                                + id + "'"));
            }
            return ResponseEntity.ok(Map.of(
                    "id", id, "supportState", "DEPRECATED"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(Map.of(
                    "code", "RESERVED_CODE",
                    "message", ex.getMessage()));
        }
    }

    /* ─────────────── /admin/import-program-indicators ─────────────── */

    public record ImportPIRequest(String programUid) { }

    @PostMapping("/admin/import-program-indicators")
    public ResponseEntity<Map<String, Object>> importProgramIndicators(
            @RequestBody(required = false) final ImportPIRequest request,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "PI import requires ADMIN"));
        }
        final ProgramIndicatorSyncService.ImportScope scope =
                new ProgramIndicatorSyncService.ImportScope(
                        request == null ? null : request.programUid());
        final ProgramIndicatorSyncService.ImportSummary summary =
                piSync.importAll(scope);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("scanned", summary.scanned());
        body.put("outcomeCounts", summary.outcomeCounts());
        body.put("items", summary.items().stream().map(i -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("sourceUid", i.sourceUid());
            m.put("code", i.code());
            m.put("outcome", i.outcome().name());
            if (i.message() != null) {
                m.put("message", i.message());
            }
            return m;
        }).toList());
        body.put("completedAt", Instant.now().toString());
        return ResponseEntity.ok(body);
    }

    private static Map<String, Object> definitionResponse(
            final AnalyticsDefinitionService.CreateResult result) {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("outcome", result.outcome().name());
        if (result.definition() != null) {
            body.put("definition",
                    definitionJson(result.definition()));
        }
        if (result.compile() != null) {
            body.put("supportState",
                    result.compile().supportState().name());
            body.put("diagnostics", result.compile().diagnostics());
            body.put("referencedDataElements",
                    result.compile().referencedDataElements());
            body.put("referencedAttributes",
                    result.compile().referencedAttributes());
            body.put("referencedVariables",
                    result.compile().referencedVariables());
            body.put("referencedFunctions",
                    result.compile().referencedFunctions());
        }
        if (!result.validationErrors().isEmpty()) {
            body.put("validationErrors", result.validationErrors());
        }
        return body;
    }

    @PostMapping("/admin/recompute")
    public ResponseEntity<Map<String, Object>> recompute(
            @RequestBody(required = false) final IngestRequest request,
            final Authentication auth) {
        return runIngestion(request, auth, true);
    }

    @PostMapping("/admin/ingest")
    public ResponseEntity<Map<String, Object>> ingest(
            @RequestBody(required = false) final IngestRequest request,
            final Authentication auth) {
        return runIngestion(request, auth, false);
    }

    private ResponseEntity<Map<String, Object>> runIngestion(
            final IngestRequest request, final Authentication auth,
            final boolean resetFirst) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "analytics ingestion requires ADMIN"));
        }
        final AnalyticsIngestionService.IngestScope scope =
                new AnalyticsIngestionService.IngestScope(
                        request == null ? null : request.orgUnit(),
                        request == null ? null : request.program(),
                        parseDate(request == null ? null : request.fromDate()),
                        parseDate(request == null ? null : request.toDate()));
        Map<String, Integer> reset = null;
        if (resetFirst) {
            reset = ingestion.resetBuiltIns();
        }
        final List<AnalyticsIngestionService.IngestResult> results =
                ingestion.ingestBuiltIns(scope);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "OK");
        body.put("resetContributions", reset);
        body.put("results", results.stream().map(r -> {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("metricCode", r.metricCode());
            m.put("rowsScanned", r.rowsScanned());
            m.put("contributionsWritten", r.contributionsWritten());
            m.put("cellsMaterialised", r.cellsMaterialised());
            return m;
        }).toList());
        body.put("completedAt", Instant.now().toString());
        return ResponseEntity.ok(body);
    }

    private static java.time.LocalDate parseDate(final String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(raw.trim());
        } catch (java.time.format.DateTimeParseException ex) {
            return null;
        }
    }

    /* ─────────────── helpers ─────────────── */

    private List<UUID> resolveMetricIds(final List<String> metrics) {
        if (metrics == null || metrics.isEmpty()) {
            return List.of();
        }
        final List<UUID> out = new ArrayList<>(metrics.size());
        for (final String m : metrics) {
            if (m == null || m.isBlank()) {
                continue;
            }
            try {
                out.add(UUID.fromString(m));
            } catch (IllegalArgumentException ex) {
                // Code lookup — operators submit the metric code.
                repo.findDefinitionByCode(m).ifPresent(d -> out.add(d.id()));
            }
        }
        return out;
    }

    private static Map<String, Object> definitionJson(final AnalyticsDefinition d) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.id().toString());
        m.put("sourceUid", d.sourceUid());
        m.put("code", d.code());
        m.put("displayName", d.displayName());
        m.put("definitionVersion", d.definitionVersion());
        m.put("metadataHash", d.metadataHash());
        m.put("analyticsType", d.analyticsType());
        m.put("aggregationType", d.aggregationType());
        m.put("programUid", d.programUid());
        m.put("stageUids", d.stageUids());
        m.put("dateAnchor", d.dateAnchor());
        m.put("orgUnitAnchor", d.orgUnitAnchor());
        m.put("supportState", d.supportState());
        m.put("unsupportedReason", d.unsupportedReason());
        m.put("effectiveFrom",
                d.effectiveFrom() == null ? null : d.effectiveFrom().toString());
        m.put("createdAt",
                d.createdAt() == null ? null : d.createdAt().toString());
        m.put("updatedAt",
                d.updatedAt() == null ? null : d.updatedAt().toString());
        return m;
    }

    private static Map<String, Object> cellJson(final AnalyticsCell c,
                                                   final List<AnalyticsDimension> dims,
                                                   final OptionSetLookup.Cache osCache) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("metricId", c.metricId().toString());
        m.put("definitionVersion", c.definitionVersion());
        m.put("periodKey", c.periodKey());
        m.put("orgUnitUid", c.orgUnitUid());
        m.put("dimensionKey", c.dimensionKey());
        final Map<String, String> codes =
                ug.ac.mak.der.analytics.engine.DimensionKey.decode(
                        c.dimensionKey());
        m.put("dimensions", codes);
        // Phase 4b — resolve OptionSet labels alongside the raw codes.
        if (dims != null && !dims.isEmpty() && !codes.isEmpty()) {
            final Map<String, String> labels = new LinkedHashMap<>();
            for (final AnalyticsDimension d : dims) {
                final String code = codes.get(d.name());
                if (code == null) {
                    continue;
                }
                if (d.optionSetUid() != null && osCache != null) {
                    labels.put(d.name(),
                            osCache.label(d.optionSetUid(), code));
                } else {
                    labels.put(d.name(), code);
                }
            }
            m.put("dimensionLabels", labels);
        }
        m.put("countValue", c.countValue());
        m.put("sumValue", decimal(c.sumValue()));
        m.put("value", decimal(c.value()));
        m.put("numeratorValue", decimal(c.numeratorValue()));
        m.put("denominatorValue", decimal(c.denominatorValue()));
        m.put("freshnessAt",
                c.freshnessAt() == null ? null : c.freshnessAt().toString());
        m.put("qualityState", c.qualityState());
        return m;
    }

    private static Object decimal(final BigDecimal v) {
        return v == null ? null : v.toPlainString();
    }
}
