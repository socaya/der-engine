package ug.ac.mak.der.dhis2emulator;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.locale.TemporalContext;

/**
 * DER-APPS-DHIS2-001 FR-EMU-003 — minimal {@code /api/i18n} stub.
 *
 * <p>DER does not ship DHIS2 translation bundles; most hosted DHIS2
 * apps call {@code /api/i18n} to resolve their shell chrome. Returning
 * 404 would make those apps look broken, so we return an empty
 * dictionary tagged with the configured default locale and attach
 * {@code I18N_FALLBACK} when a non-English-family locale was
 * requested. The admin diagnostic can then surface how often apps
 * are falling back.
 *
 * <p>FR-04-09 — the "English family" check + default-locale label
 * both come from {@link TemporalContext} so admins can widen or
 * narrow the fallback window via {@code der.locale.*}.</p>
 */
@RestController
@RequestMapping(path = "/api/i18n")
public class I18nController {

    private final ObjectProvider<TemporalContext> temporalProvider;

    public I18nController(final ObjectProvider<TemporalContext> temporalProvider) {
        this.temporalProvider = Objects.requireNonNull(temporalProvider,
                "temporalProvider");
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> get(
            @RequestParam(value = "locale", required = false) final String locale) {
        final TemporalContext temporal = temporalProvider.getIfAvailable();
        final String defaultLocale = temporal == null
                ? "en" : temporal.defaultLocaleTag();
        final String requested = (locale == null || locale.isBlank())
                ? defaultLocale : locale;
        final boolean englishFamily = temporal == null
                ? requested.toLowerCase().startsWith("en")
                : temporal.isEnglishFamily(requested);
        final Map<String, Object> body = englishFamily
                ? Map.of(
                        "locale", defaultLocale,
                        "messages", Map.of())
                : Map.of(
                        "locale", defaultLocale,
                        "requestedLocale", requested,
                        "messages", Map.of(),
                        "warnings", List.of("I18N_FALLBACK"));
        return ResponseEntity.ok(body);
    }
}
