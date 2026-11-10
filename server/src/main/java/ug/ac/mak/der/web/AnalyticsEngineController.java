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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.analytics.engine.AnalyticsCapabilities;
import ug.ac.mak.der.analytics.engine.AnalyticsCell;
import ug.ac.mak.der.analytics.engine.AnalyticsDefinition;
import ug.ac.mak.der.analytics.engine.AnalyticsEngineRepository;
import ug.ac.mak.der.analytics.engine.AnalyticsPeriodEnumerator;
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

    public AnalyticsEngineController(final AnalyticsEngineRepository repo,
                                      final AnalyticsPeriodEnumerator periods) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.periods = Objects.requireNonNull(periods, "periods");
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
            Page page) {
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
                        q.page() == null ? 500 : Math.max(1, q.page().limit()),
                        q.page() == null || q.page().offset() == null
                                ? 0 : q.page().offset());
        final List<AnalyticsCell> cells = repo.queryCells(cq);
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("count", cells.size());
        out.put("freshnessAt", Instant.now().toString());
        out.put("cells", cells.stream()
                .map(AnalyticsEngineController::cellJson)
                .toList());
        return ResponseEntity.ok(out);
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

    @PostMapping("/admin/recompute")
    public ResponseEntity<Map<String, Object>> recompute(
            @RequestBody(required = false) final Map<String, Object> request,
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of(
                    "code", "FORBIDDEN",
                    "message", "recompute requires ADMIN"));
        }
        // Phase 1 can't actually recompute — the materializer lands
        // in Phase 2. Return 202 so the client's retry loop treats
        // the ask as "accepted, work queued" rather than a hard error.
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ACCEPTED");
        body.put("phase", "PHASE_1_NO_MATERIALIZER");
        body.put("message", "recompute queued; executed when the Phase-2 "
                + "materializer lands");
        body.put("requestedScope", request == null ? Map.of() : request);
        return ResponseEntity.status(202).body(body);
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

    private static Map<String, Object> cellJson(final AnalyticsCell c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("metricId", c.metricId().toString());
        m.put("definitionVersion", c.definitionVersion());
        m.put("periodKey", c.periodKey());
        m.put("orgUnitUid", c.orgUnitUid());
        m.put("dimensionKey", c.dimensionKey());
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
