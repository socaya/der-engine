package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

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
 * DHIS2 {@code /api/locales/**} surface. Four sub-paths:
 * <ul>
 *   <li>{@code /countries} + {@code /languages} — ISO 3166 / ISO 639
 *       reference catalogues the Users app pulls to build the locale
 *       pickers. Backed by the JDK's built-in {@code Locale} tables
 *       so DER ships the same list regardless of which JRE runs it.</li>
 *   <li>{@code /ui} — the subset of UI locales DHIS2 central bundles
 *       translation JARs for. Fixed list mirrored from the 2.44
 *       {@code i18n_modules} listing.</li>
 *   <li>{@code /dbLocales} + {@code /dbLocales/{uid}} — operator-managed
 *       data-store locales (metadata translations). Persisted in
 *       {@code der.system_setting} under the {@code dbLocale:} namespace.</li>
 * </ul>
 *
 * Covers Wave 1 P0 endpoints
 * {@code /api/locales/countries}, {@code /api/locales/languages},
 * {@code /api/locales/ui}, {@code /api/locales/dbLocales} (GET/POST),
 * {@code /api/locales/dbLocales/{uid}} (GET/DELETE), plus
 * {@code DELETE /api/locales/dbLocales} (2.44 only).
 */
@RestController
@RequestMapping(path = "/api/locales", produces = MediaType.APPLICATION_JSON_VALUE)
public class LocalesController {

    private static final String DB_LOCALE_NS = "dbLocale:";

    private final SystemSettingsRepository repo;

    public LocalesController(final SystemSettingsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping("/countries")
    public ResponseEntity<List<Map<String, String>>> countries() {
        final List<Map<String, String>> out = new ArrayList<>();
        for (final String code : Locale.getISOCountries()) {
            final Locale l = Locale.of("", code);
            out.add(Map.of("id", code.toLowerCase(Locale.ROOT),
                    "name", l.getDisplayCountry(Locale.ENGLISH)));
        }
        out.sort((a, b) -> a.get("name").compareTo(b.get("name")));
        return ResponseEntity.ok(out);
    }

    @GetMapping("/languages")
    public ResponseEntity<List<Map<String, String>>> languages() {
        final List<Map<String, String>> out = new ArrayList<>();
        for (final String code : Locale.getISOLanguages()) {
            final Locale l = Locale.of(code);
            out.add(Map.of("id", code, "name", l.getDisplayLanguage(Locale.ENGLISH)));
        }
        out.sort((a, b) -> a.get("name").compareTo(b.get("name")));
        return ResponseEntity.ok(out);
    }

    /** UI locale set DHIS2 central ships translation bundles for in 2.44.
     *  Mirrored from the {@code dhis-web-portal} i18n module manifest so
     *  the Users app's dropdown matches what central shows. */
    private static final List<String> UI_LOCALE_CODES = List.of(
            "ar", "bn_BD", "en", "es", "fa", "fr", "hi_IN", "id",
            "km", "lo", "my", "ne_NP", "nb", "pt", "pt_BR", "ru",
            "rw", "sv", "sw", "ta_IN", "tg", "ur_PK", "vi", "zh");

    @GetMapping("/ui")
    public ResponseEntity<List<Map<String, String>>> ui() {
        final List<Map<String, String>> out = new ArrayList<>();
        for (final String code : UI_LOCALE_CODES) {
            out.add(Map.of("locale", code, "name", displayNameOf(code)));
        }
        return ResponseEntity.ok(out);
    }

    private static String displayNameOf(final String code) {
        final int underscore = code.indexOf('_');
        if (underscore < 0) {
            return Locale.of(code).getDisplayLanguage(Locale.ENGLISH);
        }
        final Locale l = Locale.of(code.substring(0, underscore),
                code.substring(underscore + 1));
        return l.getDisplayLanguage(Locale.ENGLISH)
                + " (" + l.getDisplayCountry(Locale.ENGLISH) + ")";
    }

    @GetMapping("/dbLocales")
    public ResponseEntity<List<Map<String, Object>>> dbLocales(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, String> all = repo.readAll();
        final List<Map<String, Object>> out = new ArrayList<>();
        new TreeMap<>(all).forEach((k, v) -> {
            if (k.startsWith(DB_LOCALE_NS)) {
                final String code = k.substring(DB_LOCALE_NS.length());
                out.add(Map.of("locale", code, "name", displayNameOf(code)));
            }
        });
        return ResponseEntity.ok(out);
    }

    @PostMapping("/dbLocales")
    public ResponseEntity<Map<String, Object>> addDbLocale(
            final Authentication auth,
            @RequestBody final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to manage db locales"));
        }
        final Object code = body == null ? null : body.getOrDefault("locale", body.get("code"));
        if (!(code instanceof String s) || s.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "message", "locale required"));
        }
        repo.upsert(DB_LOCALE_NS + s, "1", principal.user().userId());
        return ResponseEntity.ok(Map.of("httpStatus", "Created",
                "message", "DB locale " + s + " added"));
    }

    /** 2.44-only bulk delete (?locales=en,fr or body list) — pre-2.44
     *  clients hit {@code DELETE /dbLocales/{uid}} per item. We accept
     *  either shape so the single handler covers both clients. */
    @DeleteMapping("/dbLocales")
    public ResponseEntity<Map<String, Object>> deleteDbLocalesBulk(
            final Authentication auth,
            @RequestBody(required = false) final Object body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to manage db locales"));
        }
        int deleted = 0;
        if (body instanceof List<?> list) {
            for (final Object o : list) {
                if (o instanceof String s && !s.isBlank()) {
                    deleted += repo.delete(DB_LOCALE_NS + s);
                }
            }
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "deleted", deleted));
    }

    /** {@code uid} here is the locale code (en / fr_CA / ...); DHIS2 central
     *  uses the locale string as its dbLocale primary key. */
    @GetMapping("/dbLocales/{uid}")
    public ResponseEntity<Map<String, Object>> getDbLocale(
            final Authentication auth,
            @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (repo.read(DB_LOCALE_NS + uid) == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "httpStatus", "NotFound",
                    "message", "DB locale " + uid + " not found"));
        }
        return ResponseEntity.ok(Map.of("locale", uid, "name", displayNameOf(uid)));
    }

    @DeleteMapping("/dbLocales/{uid}")
    public ResponseEntity<Map<String, Object>> deleteDbLocale(
            final Authentication auth,
            @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to manage db locales"));
        }
        final int n = repo.delete(DB_LOCALE_NS + uid);
        if (n == 0) {
            return ResponseEntity.status(404).body(Map.of(
                    "httpStatus", "NotFound",
                    "message", "DB locale " + uid + " not found"));
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "DB locale " + uid + " removed"));
    }

    private static boolean hasAdmin(final EdgeUserPrincipal principal) {
        final Set<String> auths = new java.util.HashSet<>();
        principal.getAuthorities().forEach(a -> auths.add(a.getAuthority()));
        return auths.contains("ROLE_ADMIN");
    }
}
