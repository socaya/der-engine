package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.pull.DataPullCursor;
import ug.ac.mak.der.workflows.pull.DataPullCursorRepository;

/**
 * Phase 09.5 — read-only surface over the ADR-0034 pull cursors.
 *
 * <p>The admin UI reads this on the Data overview + per-stream
 * screens to render the "Last pulled {ago}" chip and the per-cursor
 * failure counter so operators can see when the puller is stuck.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/data/pull",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DataPullController {

    private final DataPullCursorRepository cursors;

    public DataPullController(final DataPullCursorRepository cursors) {
        this.cursors = Objects.requireNonNull(cursors, "cursors");
    }

    @GetMapping("/cursors")
    public ResponseEntity<Map<String, Object>> listCursors(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<Map<String, Object>> rows = cursors.findAll().stream()
                .map(DataPullController::toJson).toList();
        return ResponseEntity.ok(Map.of("cursors", rows));
    }

    private static Map<String, Object> toJson(final DataPullCursor c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", c.entityType().name());
        m.put("orgUnitUid", c.orgUnitUid());
        m.put("lastPulledAt", c.lastPulledAt() == null ? null : c.lastPulledAt().toString());
        m.put("lastCursor", c.lastCursor());
        m.put("consecutiveFailures", c.consecutiveFailures());
        m.put("lastError", c.lastError());
        m.put("updatedAt", c.updatedAt().toString());
        return m;
    }
}
