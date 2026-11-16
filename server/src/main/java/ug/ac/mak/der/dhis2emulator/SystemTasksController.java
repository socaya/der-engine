package ug.ac.mak.der.dhis2emulator;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2's {@code /api/system/tasks/<CATEGORY>[/<jobId>]} is the
 * polling endpoint stock apps hit after kicking off a job via a
 * POST on the owning controller
 * ({@code dataIntegrity/summary} → polled here under
 * {@code DATA_INTEGRITY}; {@code resourceTables/analytics} →
 * polled under {@code ANALYTICS_TABLE}; {@code maintenance} →
 * polled under {@code MAINTENANCE}).
 *
 * <p>DER doesn't run those central-side jobs — the owning
 * controllers return no-op "not configured on this appliance"
 * responses already. This controller mirrors the shape so the
 * polling loop terminates cleanly: an empty array means "no
 * running tasks" and the DHIS2 UI progresses to its empty-state
 * render instead of spinning forever.</p>
 */
@RestController
@RequestMapping(path = "/api/system/tasks",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SystemTasksController {

    @GetMapping({"/{category}", "/{category}/{jobId}"})
    public ResponseEntity<List<Object>> tasksByCategory(
            final Authentication auth,
            @PathVariable final String category) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // The DHIS2 shape is an array of job-status entries; the
        // DHIS2 app's polling code reads `.length === 0` or the
        // last entry's `completed` flag. Returning `[]` matches
        // the "idle / nothing running" state.
        return ResponseEntity.ok(List.of());
    }
}
