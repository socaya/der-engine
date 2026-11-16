package ug.ac.mak.der.dhis2emulator;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2's {@code /api/dataIntegrity} is central's catalogue-wide
 * structural scanner (orphan references, duplicate names,
 * metadata inconsistencies). DER is an edge appliance that
 * mirrors metadata — authoring + global structural audits belong
 * on central, not on the appliance. Running the full scanner on
 * a device with only a sliced mirror would yield false positives
 * (every un-mirrored dependency looks like an orphan from the
 * edge's point of view).
 *
 * <p>DER therefore returns the DHIS2-shaped empty responses so
 * the stock Data Administration app's Data Integrity screen
 * renders "no checks configured on this appliance" instead of
 * crashing on a 404. Operators who need the scanner run it on
 * central; results don't need to replicate to the edge.</p>
 *
 * <p>Endpoints covered:
 * <ul>
 *   <li>{@code GET /api/dataIntegrity} — the list of available
 *       checks. Empty array matches "no checks exposed."</li>
 *   <li>{@code GET /api/dataIntegrity/summary} — per-check
 *       summary counters.</li>
 *   <li>{@code GET /api/dataIntegrity/details} — per-check
 *       detail rows.</li>
 *   <li>{@code POST /api/dataIntegrity/summary} +
 *       {@code details} — the Data Admin UI kicks a scheduled
 *       run via POST; return a 200 so the UI's "Run checks"
 *       button doesn't fail, with an empty job tag.</li>
 * </ul>
 * </p>
 */
@RestController
@RequestMapping(path = "/api/dataIntegrity",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DataIntegrityController {

    @GetMapping
    public ResponseEntity<List<Object>> list(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("dataIntegrityChecks",
                List.of(), "summary", List.of()));
    }

    @GetMapping("/details")
    public ResponseEntity<Map<String, Object>> details(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("dataIntegrityChecks",
                List.of(), "details", List.of()));
    }

    /**
     * The Data Administration UI kicks checks via POST and polls
     * {@code /api/system/tasks/DATA_INTEGRITY} for completion.
     * Ack the kickoff with a 200 + empty job tag so the UI
     * progresses to the polling state; the polling endpoint lives
     * elsewhere ({@code SystemTasksController}) and returns an
     * empty-job shape so the UI eventually renders "no results."
     */
    @PostMapping("/summary")
    public ResponseEntity<Map<String, Object>> runSummary(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "httpStatusCode", 200, "status", "OK",
                "message", "Data integrity checks not configured on this appliance.",
                "response", Map.of("name", "dataIntegrityCheck",
                        "id", "noop-" + java.util.UUID.randomUUID())));
    }

    @PostMapping("/details")
    public ResponseEntity<Map<String, Object>> runDetails(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "httpStatusCode", 200, "status", "OK",
                "message", "Data integrity checks not configured on this appliance.",
                "response", Map.of("name", "dataIntegrityCheck",
                        "id", "noop-" + java.util.UUID.randomUUID())));
    }
}
