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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER-APPS-DHIS2-001 FR-EMU-002 — emulated {@code /api/systemSettings}
 * for DHIS2 apps that read or write appliance-wide settings. Any
 * authenticated user can read; writes require the ADMIN role so a
 * compromised dashboard can't rewrite the appliance's branding or
 * default date format.
 */
@RestController
@RequestMapping(path = "/api/systemSettings")
public class SystemSettingsController {

    private final SystemSettingsRepository repo;

    public SystemSettingsController(final SystemSettingsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> readAll() {
        return ResponseEntity.ok(repo.readAll());
    }

    /**
     * DHIS2 central content-negotiates
     * {@code /api/systemSettings/<key>} the same way as
     * {@link UserSettingsController#read}: {@code
     * application/json} gets a JSON-encoded string, text/plain
     * gets the raw value. The d2 app-runtime library sends
     * {@code Accept: application/json}, so both media types must
     * be produced to avoid 404 content-type-mismatch at bootstrap.
     */
    @GetMapping(path = "/{key}", produces = {
            MediaType.APPLICATION_JSON_VALUE,
            MediaType.TEXT_PLAIN_VALUE })
    public ResponseEntity<?> read(@PathVariable("key") final String key,
                                      @org.springframework.web.bind.annotation.RequestHeader(
                                              value = "Accept", required = false)
                                          final String accept) {
        String value = repo.read(key);
        if (value == null) {
            value = defaultFor(key);
        }
        final boolean wantsJson = accept != null && accept.contains("application/json");
        if (wantsJson) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"");
        }
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .body(value);
    }

    private static String defaultFor(final String key) {
        return switch (key) {
            case "keyUiLocale", "keyDbLocale" -> "en";
            case "keyAnalysisDisplayProperty" -> "name";
            case "keyStyle" -> "light_blue/light_blue.css";
            case "applicationTitle" -> "DHIS 2";
            case "keyFlag" -> "dhis2";
            default -> "";
        };
    }

    @PostMapping(path = "/{key}")
    public ResponseEntity<Map<String, Object>> upsert(
            final Authentication auth,
            @PathVariable("key") final String key,
            @RequestParam(value = "value", required = false) final String queryValue,
            @RequestBody(required = false) final String body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to write system settings"));
        }
        final String value = queryValue != null ? queryValue
                : body != null ? body : "";
        repo.upsert(key, value, principal.user().userId());
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "System setting " + key + " saved"));
    }

    @DeleteMapping(path = "/{key}")
    public ResponseEntity<Map<String, Object>> delete(
            final Authentication auth,
            @PathVariable("key") final String key) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to clear system settings"));
        }
        repo.delete(key);
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "System setting " + key + " cleared"));
    }

    private static boolean hasAdmin(final EdgeUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
