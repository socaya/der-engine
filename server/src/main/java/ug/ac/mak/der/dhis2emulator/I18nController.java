package ug.ac.mak.der.dhis2emulator;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * DER-APPS-DHIS2-001 FR-EMU-003 — minimal {@code /api/i18n} stub.
 *
 * <p>DER does not ship DHIS2 translation bundles; most hosted DHIS2
 * apps call {@code /api/i18n} to resolve their shell chrome. Returning
 * 404 would make those apps look broken, so we return an empty English
 * dictionary and attach {@code I18N_FALLBACK} when a non-English locale
 * was requested. The admin diagnostic can then surface how often apps
 * are falling back.
 */
@RestController
@RequestMapping(path = "/api/i18n")
public class I18nController {

    private static final String DEFAULT_LOCALE = "en";

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> get(
            @RequestParam(value = "locale", required = false) final String locale) {
        final String requested = (locale == null || locale.isBlank())
                ? DEFAULT_LOCALE : locale;
        final boolean englishFamily = requested.toLowerCase().startsWith("en");
        final Map<String, Object> body = englishFamily
                ? Map.of(
                        "locale", DEFAULT_LOCALE,
                        "messages", Map.of())
                : Map.of(
                        "locale", DEFAULT_LOCALE,
                        "requestedLocale", requested,
                        "messages", Map.of(),
                        "warnings", List.of("I18N_FALLBACK"));
        return ResponseEntity.ok(body);
    }
}
