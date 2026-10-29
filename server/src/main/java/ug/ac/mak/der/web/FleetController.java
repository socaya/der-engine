package ug.ac.mak.der.web;

import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.fleet.FleetService;
import ug.ac.mak.der.fleet.UserPreferenceService;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/** §8 UI maturity — fleet view + per-operator preferences. */
@RestController
@RequestMapping(path = "/edge-api/v1", produces = MediaType.APPLICATION_JSON_VALUE)
public class FleetController {

    private final FleetService fleet;
    private final UserPreferenceService prefs;

    public FleetController(final FleetService fleet, final UserPreferenceService prefs) {
        this.fleet = Objects.requireNonNull(fleet, "fleet");
        this.prefs = Objects.requireNonNull(prefs, "prefs");
    }

    /* ─── Fleet ───────────────────────────────────────────── */

    @GetMapping("/fleet")
    public ResponseEntity<Map<String, Object>> fleet() {
        return ResponseEntity.ok(Map.of(
            "summary", fleet.summary(),
            "edges",   fleet.listFleet(),
            "peers",   fleet.perPeerHealth()));
    }

    @GetMapping("/fleet/summary")
    public ResponseEntity<Map<String, Object>> fleetSummary() {
        return ResponseEntity.ok(fleet.summary());
    }

    /* ─── User preferences ────────────────────────────────── */

    @GetMapping("/user-prefs")
    public ResponseEntity<Map<String, Object>> readPrefs(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal p)) {
            return ResponseEntity.status(401).body(Map.of("code", "UNAUTHENTICATED"));
        }
        return ResponseEntity.ok(Map.of("prefs", prefs.readAll(p.userId())));
    }

    @PostMapping(path = "/user-prefs/{key}",
                 consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> writePref(
            final Authentication auth, @PathVariable final String key,
            @RequestBody final PrefBody body) {
        if (!(auth instanceof EdgeUserPrincipal p)) {
            return ResponseEntity.status(401).body(Map.of("code", "UNAUTHENTICATED"));
        }
        if (body == null || body.value == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "code", "VALUE_REQUIRED", "message", "value required"));
        }
        prefs.write(p.userId(), key, body.value);
        return ResponseEntity.ok(Map.of("key", key, "value", body.value));
    }

    @DeleteMapping("/user-prefs/{key}")
    public ResponseEntity<Map<String, Object>> deletePref(final Authentication auth,
                                                           @PathVariable final String key) {
        if (!(auth instanceof EdgeUserPrincipal p)) {
            return ResponseEntity.status(401).body(Map.of("code", "UNAUTHENTICATED"));
        }
        return ResponseEntity.ok(Map.of("deleted", prefs.delete(p.userId(), key)));
    }

    public static final class PrefBody {
        public String value;
    }
}
