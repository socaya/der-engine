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
import ug.ac.mak.der.analytics.engine.OptionSetLookup;
import ug.ac.mak.der.analytics.expression.ExpressionCompiler;

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

    public AnalyticsEngineController(final AnalyticsEngineRepository repo,
                                      final AnalyticsPeriodEnumerator periods,
                                      final AnalyticsIngestionService ingestion,
                                      final AnalyticsContributionRepository contributions,
                                      final ExpressionCompiler compiler,
                                      final AnalyticsDefinitionService definitions,
                                      final OptionSetLookup optionSets,
                                      final ObjectMapper jsonMapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.periods = Objects.requireNonNull(periods, "periods");
        this.ingestion = Objects.requireNonNull(ingestion, "ingestion");
        this.contributions = Objects.requireNonNull(contributions, "contributions");
        this.compiler = Objects.requireNonNull(compiler, "compiler");
        this.definitions = Objects.requireNonNull(definitions, "definitions");
        this.optionSets = Objects.requireNonNull(optionSets, "optionSets");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
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
        // Phase 4b — resolve OptionSet codes to display names per
        // metric. Group cells by metric so each metric's declared
        // dimensions are loaded once; the lookup cache de-dupes
        // across cells with shared OptionSets.
        final OptionSetLookup.Cache osCache = optionSets.cache();
        final Map<java.util.UUID, List<AnalyticsDimension>> dimsByMetric
                = new java.util.HashMap<>();
        for (final AnalyticsCell c : cells) {
            dimsByMetric.computeIfAbsent(c.metricId(), id ->
                    loadDimensions(id));
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", cells.size());
        out.put("freshnessAt", Instant.now().toString());
        out.put("cells", cells.stream()
                .map(c -> cellJson(c, dimsByMetric.get(c.metricId()),
                        osCache))
                .toList());
        return ResponseEntity.ok(out);
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
