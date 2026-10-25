package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredEntity;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER's emulation of the DHIS2 Web API metadata list endpoints:
 *
 * <ul>
 *   <li>{@code GET /api/organisationUnits}</li>
 *   <li>{@code GET /api/dataElements}</li>
 *   <li>{@code GET /api/dataSets}</li>
 *   <li>{@code GET /api/programs}</li>
 *   <li>{@code GET /api/trackedEntityTypes}</li>
 *   <li>{@code GET /api/{resource}/{uid}} for each of the above</li>
 * </ul>
 *
 * <p>Each list response is DHIS2-shape-compatible: a top-level array keyed by
 * the resource name plus a {@code pager}. Fields are projected from the
 * mirrored JSONB payload so clients receive the full DHIS2 object. Phase 03b
 * does not implement field-filtering (DHIS2's {@code fields=} parameter) —
 * the stored payload is returned as-is.</p>
 */
@RestController
@RequestMapping(path = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
public class MetadataListController {

    private final MetadataMirrorRepository mirror;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public MetadataListController(final MetadataMirrorRepository mirror,
                                   final org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.mirror = mirror;
        this.jdbc = jdbc;
    }

    @GetMapping("/organisationUnits")
    public ResponseEntity<Map<String, Object>> organisationUnits(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page,
            @RequestParam(name = "filter", required = false) final List<String> filters) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> all = mirror.findAllOrganisationUnits();
        final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> filtered =
                applyOrgUnitFilters(all, filters);
        return ResponseEntity.ok(buildList("organisationUnits", filtered, page, pageSize));
    }

    /**
     * Minimal DHIS2-web-api-style filter engine for the mirrored OU list.
     * Supports {@code field:op:value} tokens with AND semantics across
     * repeated {@code filter=} parameters. Recognised fields:
     * {@code level}, {@code displayName}, {@code parent.id},
     * {@code organisationUnitGroups.id}. Operators {@code eq}, {@code ilike}
     * (substring, case-insensitive). Unknown tokens are ignored silently so
     * clients get a response rather than a 400 for a typo.
     */
    static List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> applyOrgUnitFilters(
            final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> rows,
            final List<String> filters) {
        if (filters == null || filters.isEmpty()) {
            return rows;
        }
        final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> out = new java.util.ArrayList<>(rows.size());
        for (final var ou : rows) {
            boolean keep = true;
            for (final String f : filters) {
                if (f == null || f.isBlank()) {
                    continue;
                }
                final String[] parts = f.split(":", 3);
                if (parts.length < 3) {
                    continue;
                }
                final String field = parts[0].trim();
                final String op = parts[1].trim();
                final String value = parts[2].trim();
                if (!matchOrgUnit(ou, field, op, value)) {
                    keep = false;
                    break;
                }
            }
            if (keep) {
                out.add(ou);
            }
        }
        return out;
    }

    private static boolean matchOrgUnit(final ug.ac.mak.der.metadata.MirroredOrganisationUnit ou,
                                         final String field, final String op, final String value) {
        if ("level".equals(field)) {
            final Integer lvl = ou.level();
            if (lvl == null) {
                return false;
            }
            if ("eq".equals(op)) {
                try {
                    return lvl.equals(Integer.valueOf(value));
                } catch (NumberFormatException ex) {
                    return false;
                }
            }
            return false;
        }
        if ("displayName".equals(field)) {
            final String name = ou.displayName();
            if (name == null) {
                return false;
            }
            if ("ilike".equals(op) || "like".equals(op)) {
                return name.toLowerCase().contains(value.toLowerCase());
            }
            if ("eq".equals(op)) {
                return name.equalsIgnoreCase(value);
            }
            return false;
        }
        if ("parent.id".equals(field)) {
            return "eq".equals(op) && value.equals(ou.parentUid());
        }
        if ("organisationUnitGroups.id".equals(field)) {
            if (!"eq".equals(op)) {
                return false;
            }
            final JsonNode p = ou.payload();
            if (p == null) {
                return false;
            }
            final JsonNode groups = p.get("organisationUnitGroups");
            if (groups == null || !groups.isArray()) {
                return false;
            }
            for (final JsonNode g : groups) {
                final JsonNode gid = g.get("id");
                if (gid != null && value.equals(gid.asText())) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }

    @GetMapping("/organisationUnits/{uid}")
    public ResponseEntity<JsonNode> organisationUnit(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findOrganisationUnit(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/dataElements")
    public ResponseEntity<Map<String, Object>> dataElements(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("dataElements", mirror.findAllDataElements(), page, pageSize));
    }

    @GetMapping("/dataElements/{uid}")
    public ResponseEntity<JsonNode> dataElement(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findDataElement(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/dataSets")
    public ResponseEntity<Map<String, Object>> dataSets(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("dataSets", mirror.findAllDataSets(), page, pageSize));
    }

    @GetMapping("/dataSets/{uid}")
    public ResponseEntity<JsonNode> dataSet(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findDataSet(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/programs")
    public ResponseEntity<Map<String, Object>> programs(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("programs", mirror.findAllPrograms(), page, pageSize));
    }

    @GetMapping("/programs/{uid}")
    public ResponseEntity<JsonNode> program(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findProgram(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/trackedEntityTypes")
    public ResponseEntity<Map<String, Object>> trackedEntityTypes(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(buildList("trackedEntityTypes", mirror.findAllTrackedEntityTypes(), page, pageSize));
    }

    @GetMapping("/trackedEntityTypes/{uid}")
    public ResponseEntity<JsonNode> trackedEntityType(final Authentication auth, @PathVariable final String uid) {
        return single(auth, mirror.findTrackedEntityType(uid).map(MirroredEntity::payload));
    }

    private static ResponseEntity<JsonNode> single(final Authentication auth,
                                                    final java.util.Optional<JsonNode> payload) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return payload.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static Map<String, Object> buildList(final String key,
                                                  final List<? extends MirroredEntity> rows,
                                                  final int page,
                                                  final int pageSize) {
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final int total = rows.size();
        final int from = Math.min((safePage - 1) * safeSize, total);
        final int to = Math.min(from + safeSize, total);
        final List<JsonNode> payloads = new ArrayList<>(to - from);
        for (int i = from; i < to; i++) {
            payloads.add(rows.get(i).payload());
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", safePage);
        pager.put("pageSize", safeSize);
        pager.put("total", total);
        pager.put("pageCount", (int) Math.ceil(total / (double) safeSize));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put(key, payloads);
        return body;
    }

    // ─── Dedicated-table resources served through the catalog shape ──

    @GetMapping({"/programRules", "/programRuleActions"})
    public ResponseEntity<Map<String, Object>> dedicatedList(
            final Authentication auth,
            final HttpServletRequest request,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String uri = request.getRequestURI();
        final String resource = uri.substring(uri.lastIndexOf('/') + 1);
        final String table = "programRules".equals(resource)
                ? "der.metadata_program_rule"
                : "der.metadata_program_rule_action";
        return ResponseEntity.ok(dedicatedBody(table, resource, page, pageSize));
    }

    private Map<String, Object> dedicatedBody(final String table,
                                               final String key,
                                               final int page,
                                               final int pageSize) {
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final Integer totalBoxed = jdbc.queryForObject(
                "SELECT count(*) FROM " + table, Integer.class);
        final int total = totalBoxed == null ? 0 : totalBoxed;
        // metadata_program_rule has display_name, metadata_program_rule_action
        // does not — fall back to dhis2_uid for the actions table so the
        // ORDER BY column always exists on the schema we're querying.
        final String orderCol = "der.metadata_program_rule_action".equals(table)
                ? "dhis2_uid" : "display_name";
        final List<String> rows = jdbc.queryForList(
                "SELECT payload::text FROM " + table
                        + " ORDER BY " + orderCol + " LIMIT ? OFFSET ?",
                String.class, safeSize, (safePage - 1) * safeSize);
        final List<JsonNode> payloads = new ArrayList<>(rows.size());
        for (final String r : rows) {
            payloads.add(parseJson(r));
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", safePage);
        pager.put("pageSize", safeSize);
        pager.put("total", total);
        pager.put("pageCount", (int) Math.ceil(total / (double) safeSize));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put(key, payloads);
        return body;
    }

    // ─── Catalog-backed resources (V030 der-2.0.17) ──────────────────

    @GetMapping({
            "/optionSets", "/optionGroups", "/optionGroupSets",
            "/categoryCombos", "/categoryOptions", "/categoryOptionGroups",
            "/categoryOptionGroupSets",
            "/programIndicators", "/programRuleVariables",
            "/programStageSections", "/programNotificationTemplates",
            "/relationshipTypes",
            "/indicators", "/indicatorTypes", "/indicatorGroups", "/indicatorGroupSets",
            "/legendSets", "/constants", "/predictors", "/predictorGroups",
            "/dataElementGroups", "/dataElementGroupSets",
            "/validationRules", "/validationRuleGroups", "/validationNotificationTemplates",
            "/organisationUnitGroups", "/organisationUnitGroupSets", "/organisationUnitLevels",
            "/userGroups", "/userRoles",
            "/attributes", "/documents"
    })
    public ResponseEntity<Map<String, Object>> catalogList(
            final Authentication auth,
            final HttpServletRequest request,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String uri = request.getRequestURI();
        final String resource = uri.substring(uri.lastIndexOf('/') + 1);
        return ResponseEntity.ok(catalogBody(resource, page, pageSize));
    }

    @GetMapping({
            "/optionSets/{uid}", "/optionGroups/{uid}", "/optionGroupSets/{uid}",
            "/categoryCombos/{uid}", "/categoryOptions/{uid}", "/categoryOptionGroups/{uid}",
            "/categoryOptionGroupSets/{uid}",
            "/programIndicators/{uid}", "/programRuleVariables/{uid}",
            "/programStageSections/{uid}", "/programNotificationTemplates/{uid}",
            "/relationshipTypes/{uid}",
            "/indicators/{uid}", "/indicatorTypes/{uid}",
            "/indicatorGroups/{uid}", "/indicatorGroupSets/{uid}",
            "/legendSets/{uid}", "/constants/{uid}",
            "/predictors/{uid}", "/predictorGroups/{uid}",
            "/dataElementGroups/{uid}", "/dataElementGroupSets/{uid}",
            "/validationRules/{uid}", "/validationRuleGroups/{uid}",
            "/validationNotificationTemplates/{uid}",
            "/organisationUnitGroups/{uid}", "/organisationUnitGroupSets/{uid}",
            "/organisationUnitLevels/{uid}",
            "/userGroups/{uid}", "/userRoles/{uid}",
            "/attributes/{uid}", "/documents/{uid}"
    })
    public ResponseEntity<JsonNode> catalogItem(final Authentication auth,
                                                 final HttpServletRequest request,
                                                 @PathVariable final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String uri = request.getRequestURI();
        final String withoutUid = uri.substring(0, uri.lastIndexOf('/'));
        final String resource = withoutUid.substring(withoutUid.lastIndexOf('/') + 1);
        try {
            final String payload = jdbc.queryForObject(
                    "SELECT payload::text FROM der.metadata_catalog_item "
                            + "WHERE resource = ? AND dhis2_uid = ?",
                    String.class, resource, uid);
            if (payload == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(parseJson(payload));
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    private Map<String, Object> catalogBody(final String resource,
                                             final int page,
                                             final int pageSize) {
        final int safeSize = Math.max(1, Math.min(pageSize, 500));
        final int safePage = Math.max(1, page);
        final Integer totalBoxed = jdbc.queryForObject(
                "SELECT count(*) FROM der.metadata_catalog_item WHERE resource = ?",
                Integer.class, resource);
        final int total = totalBoxed == null ? 0 : totalBoxed;
        final List<String> rows = jdbc.queryForList(
                "SELECT payload::text FROM der.metadata_catalog_item "
                        + "WHERE resource = ? ORDER BY display_name "
                        + "LIMIT ? OFFSET ?",
                String.class, resource, safeSize, (safePage - 1) * safeSize);
        final List<JsonNode> payloads = new ArrayList<>(rows.size());
        for (final String r : rows) {
            payloads.add(parseJson(r));
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", safePage);
        pager.put("pageSize", safeSize);
        pager.put("total", total);
        pager.put("pageCount", (int) Math.ceil(total / (double) safeSize));
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put(resource, payloads);
        return body;
    }

    private static JsonNode parseJson(final String s) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readTree(s);
        } catch (java.io.IOException ex) {
            throw new IllegalStateException("could not parse catalog payload", ex);
        }
    }
}
