package ug.ac.mak.der.dhis2emulator;

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

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER-APPS-DHIS2-001 FR-DIAG-002 — admin read of the
 * {@code der.emulator_miss} counter. Powers the "Unmirrored endpoints"
 * panel on the {@code /system/apps} admin screen: operators see which
 * {@code /api/*} paths DHIS2 apps are asking for that DER doesn't
 * answer, with per-app attribution and hit counts so they can decide
 * whether to expand the emulator mirror, add a proxy allow-list entry,
 * or just tell the app's authors the endpoint will never be offline.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/apps",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class EmulatorMissAdminController {

    private final EmulatorMissRepository repo;

    public EmulatorMissAdminController(final EmulatorMissRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping(path = "/emulator-misses")
    public ResponseEntity<Map<String, Object>> list(
            final Authentication auth,
            @RequestParam(value = "limit", defaultValue = "50") final int limit) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        final List<EmulatorMissRepository.Row> rows = repo.topRecent(limit);
        final List<Map<String, Object>> items = new java.util.ArrayList<>(rows.size());
        for (final EmulatorMissRepository.Row r : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("endpoint", r.endpoint());
            m.put("appOrigin", r.appOrigin());
            m.put("hitCount", r.hitCount());
            m.put("firstAt", r.firstAt());
            m.put("lastAt", r.lastAt());
            items.add(m);
        }
        return ResponseEntity.ok(Map.of("misses", items));
    }
}
