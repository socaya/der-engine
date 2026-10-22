package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.compatibility.CapabilitySnapshot;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Admin surface for the DHIS2 compatibility engine (ADR-0006).
 *
 * <ul>
 *   <li>{@code GET /edge-api/v1/compat} — the live snapshot DER is serving from.</li>
 *   <li>{@code POST /edge-api/v1/compat/refresh} — operator-triggered re-probe.
 *       Requires the ADMIN role.</li>
 *   <li>{@code GET /edge-api/v1/compat/history} — snapshot audit trail.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/compat", produces = MediaType.APPLICATION_JSON_VALUE)
public class CompatibilityController {

    private final Dhis2CompatibilityEngine engine;

    public CompatibilityController(final Dhis2CompatibilityEngine engine) {
        this.engine = engine;
    }

    @GetMapping
    public ResponseEntity<CompatSnapshotView> active(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        try {
            return ResponseEntity.ok(CompatSnapshotView.of(engine.current()));
        } catch (Dhis2CompatibilityUnavailableException ex) {
            return ResponseEntity.status(503).header(HttpHeaders.WARNING,
                            "199 - \"DHIS2 compatibility engine not initialised\"")
                    .body(CompatSnapshotView.unavailable(ex.getMessage()));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<CompatSnapshotView> refresh(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        final UUID userId = principal.userId();
        final CapabilitySnapshot snapshot = engine.refresh(userId);
        return ResponseEntity.ok(CompatSnapshotView.of(snapshot));
    }

    @GetMapping("/history")
    public ResponseEntity<HistoryView> history(final Authentication authentication,
                                                @RequestParam(name = "limit", defaultValue = "20") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<CapabilitySnapshot> rows = engine.history(limit);
        final List<CompatSnapshotView> out = new ArrayList<>(rows.size());
        for (final CapabilitySnapshot s : rows) {
            out.add(CompatSnapshotView.of(s));
        }
        return ResponseEntity.ok(new HistoryView(out));
    }

    public record CompatSnapshotView(
            @JsonProperty("status") String status,
            @JsonProperty("snapshotId") Long snapshotId,
            @JsonProperty("capturedAt") Instant capturedAt,
            @JsonProperty("centralVersion") String centralVersion,
            @JsonProperty("profileName") String profileName,
            @JsonProperty("probeReachable") Boolean probeReachable,
            @JsonProperty("probeDurationMs") Long probeDurationMs,
            @JsonProperty("engineVersion") String engineVersion,
            @JsonProperty("capabilities") Map<String, Object> capabilities,
            @JsonProperty("message") String message
    ) {

        static CompatSnapshotView of(final CapabilitySnapshot s) {
            final Map<String, Object> caps = new LinkedHashMap<>();
            caps.put("trackerApi", s.capabilities().trackerApi().name());
            caps.put("importSummaryShape", s.capabilities().importSummaryShape().name());
            caps.put("webMessageShape", s.capabilities().webMessageShape().name());
            caps.put("supportsCategoryOptionCombosEndpoint",
                    s.capabilities().supportsCategoryOptionCombosEndpoint());
            caps.put("supportsProgramRulesEndpoint",
                    s.capabilities().supportsProgramRulesEndpoint());
            caps.put("supportsMetadataBulkEndpoint",
                    s.capabilities().supportsMetadataBulkEndpoint());
            caps.put("supportsPatchDataElements",
                    s.capabilities().supportsPatchDataElements());
            caps.put("supportedPeriodTypes",
                    s.capabilities().supportedPeriodTypes().stream().map(Enum::name).toList());
            caps.put("auditSurface", s.capabilities().auditSurface().name());
            caps.put("supportedProgramTypes",
                    s.capabilities().supportedProgramTypes().stream().map(Enum::name).toList());
            final Map<String, Map<String, Object>> endpoints = new LinkedHashMap<>();
            s.capabilities().endpointPolicies().forEach((id, policy) -> {
                final Map<String, Object> row = new LinkedHashMap<>();
                row.put("path", policy.path());
                row.put("status", policy.status().name());
                row.put("sinceMinor", policy.sinceMinor());
                row.put("removedMinor", policy.removedMinor());
                row.put("replacement", policy.replacement() == null ? null : policy.replacement().name());
                row.put("notes", policy.notes());
                endpoints.put(id.name(), row);
            });
            caps.put("endpointPolicies", endpoints);
            return new CompatSnapshotView(
                    "OK",
                    s.snapshotId(),
                    s.capturedAt(),
                    s.centralVersion(),
                    s.profileName(),
                    s.probeReachable(),
                    s.probeDurationMs(),
                    s.engineVersion(),
                    caps,
                    null);
        }

        static CompatSnapshotView unavailable(final String msg) {
            return new CompatSnapshotView(
                    "UNAVAILABLE", null, null, null, null, null, null, null, Map.of(), msg);
        }
    }

    public record HistoryView(@JsonProperty("snapshots") List<CompatSnapshotView> snapshots) { }
}
