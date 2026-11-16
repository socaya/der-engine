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

    /**
     * DHIS2 central merges the system-level defaults into the bulk
     * response so a user who has set zero per-user settings still
     * gets {@code keyUiLocale} / {@code keyDbLocale} / etc. The d2
     * app-runtime library reads these directly off the bulk
     * response (not the per-key path) during bootstrap — without
     * the defaults, {@code keyUiLocale} resolves to undefined and
     * the app errors with "Failed to fetch user locale". Mirror
     * the central contract.
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> readAll(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, String> merged = new java.util.LinkedHashMap<>();
        for (final String k : KNOWN_DEFAULTED_KEYS) {
            merged.put(k, defaultFor(k));
        }
        merged.putAll(repo.readAll(principal.user().userId()));
        return ResponseEntity.ok(merged);
    }

    private static final java.util.List<String> KNOWN_DEFAULTED_KEYS =
            java.util.List.of("keyUiLocale", "keyDbLocale",
                    "keyAnalysisDisplayProperty",
                    "keyMessageEmailNotification",
                    "keyMessageSmsNotification",
                    "keyStyle");

    /**
     * DHIS2 central serves {@code /api/userSettings/<key>} with
     * content-negotiation: {@code Accept: application/json} gets
     * the value as a JSON-encoded string ({@code "en"}),
     * {@code Accept: text/plain} (or no Accept) gets the raw
     * value. The d2 app-runtime library used by every DHIS2 custom
     * app sends {@code Accept: application/json}, so we must emit
     * both — otherwise Spring returns 404 on content-type
     * mismatch and the app surfaces "Failed to fetch user locale".
     */
    @GetMapping(path = "/{key}",
            produces = { MediaType.APPLICATION_JSON_VALUE,
                         MediaType.TEXT_PLAIN_VALUE })
    public ResponseEntity<?> read(final Authentication auth,
                                      @PathVariable("key") final String key,
                                      @org.springframework.web.bind.annotation.RequestHeader(
                                              value = "Accept", required = false)
                                          final String accept) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        String value = repo.read(principal.user().userId(), key);
        if (value == null) {
            // DHIS2 central returns 200 + the system-level default
            // when a per-user setting isn't set.
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

    /**
     * DHIS2 app-runtime defaults for common user settings. Values
     * match what a fresh DHIS2 2.44 install reports when no per-user
     * row exists. Keep the map tight — missing keys fall through to
     * empty string, which is also a legal DHIS2 response.
     */
    private static String defaultFor(final String key) {
        return switch (key) {
            case "keyUiLocale", "keyDbLocale" -> "en";
            case "keyAnalysisDisplayProperty" -> "name";
            case "keyMessageEmailNotification",
                 "keyMessageSmsNotification" -> "false";
            case "keyStyle" -> "light_blue/light_blue.css";
            default -> "";
        };
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
