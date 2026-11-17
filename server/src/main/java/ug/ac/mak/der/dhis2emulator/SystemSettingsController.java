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

    /**
     * DHIS2 central merges the system-level defaults into the bulk
     * {@code /api/systemSettings} response. The d2 app-runtime
     * library reads these directly on bootstrap — see
     * {@code UserSettingsController#readAll} for the matching
     * per-user path and the full rationale.
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> readAll() {
        final Map<String, String> merged = new java.util.LinkedHashMap<>();
        for (final String k : KNOWN_DEFAULTED_KEYS) {
            merged.put(k, defaultFor(k));
        }
        merged.putAll(repo.readAll());
        return ResponseEntity.ok(merged);
    }

    private static final java.util.List<String> KNOWN_DEFAULTED_KEYS =
            java.util.List.of("keyUiLocale", "keyDbLocale",
                    "keyAnalysisDisplayProperty",
                    "keyStyle", "applicationTitle", "keyFlag");

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

    /**
     * DHIS2 bulk upsert — the Settings app POSTs the full edited
     * form as {@code {"key1": "value1", "key2": "value2"}}. Central
     * walks the map and writes each in a single transaction; DER
     * does the same via per-key upsert for simplicity (each key is
     * independent so there's no cross-key invariant to protect).
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> bulkUpsert(
            final Authentication auth,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to write system settings"));
        }
        if (body == null || body.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "body required (JSON object of key/value pairs)"));
        }
        int written = 0;
        for (final Map.Entry<String, Object> e : body.entrySet()) {
            repo.upsert(e.getKey(),
                    e.getValue() == null ? "" : e.getValue().toString(),
                    principal.user().userId());
            written++;
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "written", written,
                "message", written + " system setting(s) saved"));
    }

    /**
     * 2.42+ bulk delete — the Settings app calls
     * {@code DELETE /api/systemSettings?key=k1,k2} when the operator
     * clears one or more keys. Pre-2.42 clients fall back to per-key
     * {@link #delete(Authentication, String)}; both share the same
     * underlying repo call so behaviour is consistent.
     */
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> bulkDelete(
            final Authentication auth,
            @RequestParam(value = "key", required = false) final String keysCsv,
            @RequestBody(required = false) final Object body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to clear system settings"));
        }
        final java.util.Set<String> keys = new java.util.LinkedHashSet<>();
        if (keysCsv != null && !keysCsv.isBlank()) {
            for (final String k : keysCsv.split(",")) {
                final String t = k.trim();
                if (!t.isEmpty()) {
                    keys.add(t);
                }
            }
        }
        if (body instanceof java.util.List<?> list) {
            for (final Object o : list) {
                if (o instanceof String s && !s.isBlank()) {
                    keys.add(s);
                }
            }
        }
        if (keys.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "key(s) required (?key=k1,k2 or JSON body list)"));
        }
        int cleared = 0;
        for (final String k : keys) {
            cleared += repo.delete(k);
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "cleared", cleared));
    }

    private static boolean hasAdmin(final EdgeUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
