package ug.ac.mak.der.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.MetadataDriftDetector;
import ug.ac.mak.der.metadata.MetadataDriftDetector.DriftReport;
import ug.ac.mak.der.metadata.MetadataDriftDetector.MissingRef;
import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * FR-05-10/11/12: drift surface + diagnostics.
 *
 * <ul>
 *   <li>{@code GET /edge-api/v1/metadata/drift/pending} — scans the
 *       pending journal and returns the entries whose metadata
 *       references no longer resolve in the local mirror.</li>
 *   <li>{@code GET /edge-api/v1/metadata/diagnostics} — summary of
 *       the effective local metadata config (per-kind row counts)
 *       and currently-known drift.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/metadata",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataDiagnosticsController {

    private final MetadataDriftDetector detector;
    private final OperationJournalRepository journal;
    private final MetadataMirrorRepository mirror;

    public MetadataDiagnosticsController(final MetadataDriftDetector detector,
                                            final OperationJournalRepository journal,
                                            final MetadataMirrorRepository mirror) {
        this.detector = Objects.requireNonNull(detector, "detector");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.mirror = Objects.requireNonNull(mirror, "mirror");
    }

    @GetMapping("/drift/pending")
    public ResponseEntity<Map<String, Object>> pendingDrift(
            final Authentication authentication,
            @RequestParam(value = "limit", defaultValue = "500") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<OperationJournalEntry> pending = journal.findPending(limit);
        final List<Map<String, Object>> rows = new ArrayList<>();
        int withDrift = 0;
        for (final OperationJournalEntry entry : pending) {
            final DriftReport report = detector.evaluate(entry);
            if (!report.hasDrift()) {
                continue;
            }
            withDrift++;
            final Map<String, Object> row = new LinkedHashMap<>();
            row.put("operationId", entry.operationId().toString());
            row.put("entityType", entry.entityType().name());
            row.put("entityRef", entry.entityRef());
            row.put("createdAt", entry.createdAt().toString());
            row.put("missing", report.missing().stream().map(m -> Map.of(
                    "kind", m.kind(), "field", m.field(), "uid", m.uid()
            )).toList());
            row.put("summary", report.summary());
            rows.add(row);
        }
        return ResponseEntity.ok(Map.of(
                "scanned", pending.size(),
                "withDrift", withDrift,
                "entries", rows));
    }

    @GetMapping("/diagnostics")
    public ResponseEntity<Map<String, Object>> diagnostics(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("organisationUnits", mirror.findAllOrganisationUnits().size());
        counts.put("dataElements", mirror.findAllDataElements().size());
        counts.put("dataSets", mirror.findAllDataSets().size());
        counts.put("programs", mirror.findAllPrograms().size());
        counts.put("trackedEntityTypes", mirror.findAllTrackedEntityTypes().size());

        final List<OperationJournalEntry> pending = journal.findPending(1_000);
        final Map<String, Integer> perKind = new LinkedHashMap<>();
        int withDrift = 0;
        for (final OperationJournalEntry e : pending) {
            final DriftReport r = detector.evaluate(e);
            if (!r.hasDrift()) {
                continue;
            }
            withDrift++;
            for (final MissingRef m : r.missing()) {
                perKind.merge(m.kind(), 1, Integer::sum);
            }
        }
        final Map<String, Object> drift = new LinkedHashMap<>();
        drift.put("pendingScanned", pending.size());
        drift.put("entriesWithDrift", withDrift);
        drift.put("missingByKind", perKind);
        return ResponseEntity.ok(Map.of(
                "mirrorCounts", counts,
                "drift", drift));
    }
}
