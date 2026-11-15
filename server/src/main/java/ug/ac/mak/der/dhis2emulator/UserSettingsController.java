package ug.ac.mak.der.dhis2emulator;

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

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER-APPS-DHIS2-001 FR-EMU-001 — emulated {@code /api/userSettings}
 * for DHIS2 apps that store per-user preferences (favoured OU, default
 * date format, dashboard layout, etc.).
 *
 * <p>DHIS2 central's surface shape:
 * <ul>
 *   <li>{@code GET /api/userSettings} — all settings for the current
 *       user as a flat JSON object, {@code key: value}</li>
 *   <li>{@code GET /api/userSettings/{key}} — one setting value as a
 *       plain-text body</li>
 *   <li>{@code POST /api/userSettings/{key}?value=foo} — upsert one
 *       setting. DER also accepts a plain-text request body.</li>
 *   <li>{@code DELETE /api/userSettings/{key}} — clear one setting</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/api/userSettings")
public class UserSettingsController {

    private final UserSettingsRepository repo;

    public UserSettingsController(final UserSettingsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> readAll(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(repo.readAll(principal.user().userId()));
    }

    @GetMapping(path = "/{key}",
            produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> read(final Authentication auth,
                                         @PathVariable("key") final String key) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String value = repo.read(principal.user().userId(), key);
        if (value == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(value);
    }

    @PostMapping(path = "/{key}")
    public ResponseEntity<Map<String, Object>> upsert(
            final Authentication auth,
            @PathVariable("key") final String key,
            @org.springframework.web.bind.annotation.RequestParam(
                    value = "value", required = false) final String queryValue,
            @RequestBody(required = false) final String body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String value = queryValue != null ? queryValue
                : body != null ? body : "";
        repo.upsert(principal.user().userId(), key, value);
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Setting " + key + " saved"));
    }

    @DeleteMapping(path = "/{key}")
    public ResponseEntity<Map<String, Object>> delete(
            final Authentication auth,
            @PathVariable("key") final String key) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.delete(principal.user().userId(), key);
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Setting " + key + " cleared"));
    }
}
