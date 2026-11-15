package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * DER-APPS-DHIS2-001 FR-EMU-006 — {@code /api/schemas} endpoint.
 *
 * <p>DHIS2 apps use this surface to discover the shape of metadata
 * objects they're about to read or write (what properties exist,
 * which are required/unique, which are references vs collections).
 * DER mirrors enough of DHIS2's shape for apps to introspect without
 * failing closed — see {@link SchemaDefinitions} for the registry.</p>
 *
 * <p>Two shapes:
 * <ul>
 *   <li>{@code GET /api/schemas} — {@code { schemas: [...] }}.</li>
 *   <li>{@code GET /api/schemas/{singular}} — one schema, 404 with
 *       the FR-EMU-007 envelope when not in DER's registry.</li>
 * </ul>
 */
@RestController
@RequestMapping(path = "/api/schemas",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class SchemasController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(final HttpServletRequest request) {
        final String base = resolveBase(request);
        final List<Map<String, Object>> out = SchemaDefinitions.all().stream()
                .map(s -> toJson(s, base)).toList();
        return ResponseEntity.ok(Map.of("schemas", out));
    }

    @GetMapping("/{singular}")
    public ResponseEntity<Map<String, Object>> one(
            @PathVariable("singular") final String singular,
            final HttpServletRequest request) {
        final Optional<SchemaDefinitions.Schema> match =
                SchemaDefinitions.bySingular(singular);
        if (match.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "httpStatus", "NotFound",
                    "httpStatusCode", 404,
                    "status", "ERROR",
                    "code", "EMULATOR_NOT_IMPLEMENTED",
                    "endpoint", "/api/schemas/" + singular,
                    "message", "Schema not mirrored by the DER emulator"));
        }
        return ResponseEntity.ok(toJson(match.get(), resolveBase(request)));
    }

    private static Map<String, Object> toJson(final SchemaDefinitions.Schema s,
                                                 final String base) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("klass", s.klass());
        m.put("singular", s.singular());
        m.put("plural", s.plural());
        m.put("name", s.singular());
        m.put("displayName", humaniseDisplayName(s.singular()));
        m.put("metadata", s.metadata());
        m.put("identifiableObject", s.identifiableObject());
        m.put("nameableObject", s.nameableObject());
        m.put("persisted", s.persisted());
        m.put("shareable", false);
        m.put("dataShareable", false);
        m.put("defaultPrivate", false);
        m.put("href", base + "/api/schemas/" + s.singular());
        m.put("properties", s.properties().stream()
                .map(p -> propertyJson(p, base))
                .toList());
        return m;
    }

    private static Map<String, Object> propertyJson(
            final SchemaDefinitions.Property p, final String base) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.name());
        m.put("fieldName", p.fieldName());
        m.put("propertyType", p.propertyType());
        m.put("simple", p.simple());
        m.put("writable", p.writable());
        m.put("required", p.required());
        m.put("unique", p.unique());
        if (p.length() != null) {
            m.put("length", p.length());
        }
        return m;
    }

    /** Best-effort camelCase→Title Case for the DHIS2 UI's display
     *  label. Keeps us from maintaining a parallel i18n table for a
     *  cosmetic field. */
    private static String humaniseDisplayName(final String singular) {
        if (singular == null || singular.isEmpty()) {
            return singular;
        }
        final StringBuilder out = new StringBuilder();
        out.append(Character.toUpperCase(singular.charAt(0)));
        for (int i = 1; i < singular.length(); i++) {
            final char c = singular.charAt(i);
            if (Character.isUpperCase(c)) {
                out.append(' ').append(Character.toLowerCase(c));
            } else {
                out.append(c);
            }
        }
        return out.toString();
    }

    /** Scheme + host + port. Scheme comes from the request as seen
     *  by the servlet — upstream reverse-proxies that inject
     *  X-Forwarded-* get picked up by the Spring container when
     *  {@code server.forward-headers-strategy=framework}. */
    private static String resolveBase(final HttpServletRequest request) {
        final StringBuilder b = new StringBuilder();
        b.append(request.getScheme()).append("://").append(request.getServerName());
        final int port = request.getServerPort();
        if ((("http".equals(request.getScheme())) && port != 80)
                || (("https".equals(request.getScheme())) && port != 443)) {
            b.append(':').append(port);
        }
        return b.toString();
    }
}
