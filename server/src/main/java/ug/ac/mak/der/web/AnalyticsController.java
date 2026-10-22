package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.analytics.AnalyticsService;
import ug.ac.mak.der.analytics.FacilitySummaryRow;

/** ADR-0020 analytics REST surface. Reads any-auth; refresh ADMIN. */
@RestController
@RequestMapping(path = "/edge-api/v1/analytics", produces = MediaType.APPLICATION_JSON_VALUE)
public class AnalyticsController {

    private final AnalyticsService svc;

    public AnalyticsController(final AnalyticsService svc) {
        this.svc = Objects.requireNonNull(svc, "svc");
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(
            @RequestParam(name = "orgUnit", required = false) final String orgUnit,
            @RequestParam(name = "kind", required = false) final String kind) {
        final FacilitySummaryRow.Kind parsed = parseKind(kind);
        final List<FacilitySummaryRow> rows = svc.summary(orgUnit, parsed);
        final Instant refreshed = svc.lastRefreshedAt();
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("rows", rows.stream().map(AnalyticsController::toJson).toList());
        body.put("lastRefreshedAt", refreshed == null ? null : refreshed.toString());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/rejections")
    public ResponseEntity<Map<String, Object>> rejections(
            @RequestParam(name = "limit", defaultValue = "500") final int limit) {
        return ResponseEntity.ok(Map.of("count", svc.rejections(limit)));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh() {
        try {
            svc.refreshNow();
            return ResponseEntity.ok(Map.of("outcome", "OK",
                    "lastRefreshedAt", String.valueOf(svc.lastRefreshedAt())));
        } catch (RuntimeException ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "code", "ANALYTICS_REFRESH_FAILED",
                    "message", String.valueOf(ex.getMessage())));
        }
    }

    private static FacilitySummaryRow.Kind parseKind(final String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return FacilitySummaryRow.Kind.valueOf(raw.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static Map<String, Object> toJson(final FacilitySummaryRow r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("orgUnitId", r.orgUnitId());
        m.put("period", r.period());
        m.put("kind", r.kind().name());
        m.put("n", r.n());
        m.put("refreshedAt", r.refreshedAt().toString());
        return m;
    }
}
