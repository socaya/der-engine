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

import org.springframework.beans.factory.ObjectProvider;

import ug.ac.mak.der.metadata.MetadataMirrorRepository;
import ug.ac.mak.der.metadata.MirroredEntity;
import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
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
    private final ObjectProvider<OrgUnitBindingService> bindingProvider;

    public MetadataListController(final MetadataMirrorRepository mirror,
                                   final org.springframework.jdbc.core.JdbcTemplate jdbc,
                                   final ObjectProvider<OrgUnitBindingService> bindingProvider) {
        this.mirror = mirror;
        this.jdbc = jdbc;
        this.bindingProvider = bindingProvider;
    }

    @GetMapping("/organisationUnits")
    public ResponseEntity<Map<String, Object>> organisationUnits(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page,
            @RequestParam(name = "filter", required = false) final List<String> filters,
            @RequestParam(name = "level", required = false) final Integer level) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final OrgUnitBindingService svc = bindingProvider.getIfAvailable();
        final EdgeOrgUnitBinding binding = svc == null ? null : svc.current();

        List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> rows =
                mirror.findAllOrganisationUnits();

        // FR-OU-003 — when the appliance is bound and the caller gave no
        // explicit filter, scope the list to the bound subtree so DHIS2
        // apps cannot see or write into other facilities by accident.
        final boolean noExplicitFilter = filters == null || filters.isEmpty();
        if (noExplicitFilter && binding != null && binding.isBound()) {
            rows = filterByBoundSubtree(rows, binding.orgUnitPath());
        }

        // FR-OU-004 — a DHIS2 app treating the bound OU as its root asks
        // for `?level=1` and expects the bound OU back. Rewrite the
        // requested level into the absolute level the mirror stores so the
        // bound OU shows up at app-level=1, its children at app-level=2,
        // etc.
        final Integer absoluteLevel = rewriteRequestedLevel(level, binding, rows);
        if (absoluteLevel != null) {
            rows = filterByLevel(rows, absoluteLevel);
        }

        rows = applyOrgUnitFilters(rows, filters);
        return ResponseEntity.ok(buildList("organisationUnits", rows, page, pageSize));
    }

    /** FR-OU-003 — keep rows whose path falls under the bound OU's path
     *  (including the bound OU itself). Path format in the mirror is the
     *  DHIS2 convention: {@code /A/B/C} where each segment is an OU UID. */
    static List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> filterByBoundSubtree(
            final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> rows,
            final String boundPath) {
        if (boundPath == null || boundPath.isBlank()) {
            return rows;
        }
        final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> out =
                new java.util.ArrayList<>(rows.size());
        for (final var ou : rows) {
            final String p = ou.path();
            if (p == null) {
                continue;
            }
            if (p.equals(boundPath) || p.startsWith(boundPath + "/")) {
                out.add(ou);
            }
        }
        return out;
    }

    static List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> filterByLevel(
            final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> rows,
            final int level) {
        final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> out =
                new java.util.ArrayList<>(rows.size());
        for (final var ou : rows) {
            if (ou.level() != null && ou.level() == level) {
                out.add(ou);
            }
        }
        return out;
    }

    /** Resolve the bound OU's absolute level by looking it up in the
     *  filtered row set (we already restricted to the subtree so the
     *  bound OU row is in {@code rows}), then rewrite the app-supplied
     *  level offset onto the absolute hierarchy. Returns {@code null}
     *  when there's nothing to rewrite — caller should skip level
     *  filtering. */
    private static Integer rewriteRequestedLevel(
            final Integer requested,
            final EdgeOrgUnitBinding binding,
            final List<ug.ac.mak.der.metadata.MirroredOrganisationUnit> rows) {
        if (requested == null) {
            return null;
        }
        if (binding == null || !binding.isBound()) {
            return requested;
        }
        for (final var ou : rows) {
            if (binding.orgUnitId().equals(ou.dhis2Uid()) && ou.level() != null) {
                return ou.level() + requested - 1;
            }
        }
        return requested;
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

    /**
     * DHIS2 central's {@code /api/organisationUnits/{uid}} has two
     * shapes:
     * <ul>
     *   <li>default — single OU object (just the row).</li>
     *   <li>{@code ?includeDescendants=true} — wraps the OU + its
     *       descendants in {@code {organisationUnits: [...]}}.</li>
     * </ul>
     * eregisters' bulk metadata pull uses the descendants shape to
     * get the facility + any sub-clinics in one call. Returning the
     * bare object there would leave eregisters reading
     * {@code e.organisationUnits.organisationUnits} as undefined
     * and {@code putRows} throwing {@code Cannot read properties
     * of undefined (reading 'length')}.
     */
    @GetMapping("/organisationUnits/{uid}")
    public ResponseEntity<?> organisationUnit(final Authentication auth,
                                                  @PathVariable final String uid,
                                                  @RequestParam(name = "includeDescendants",
                                                          defaultValue = "false")
                                                      final boolean includeDescendants) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final var root = mirror.findOrganisationUnit(uid);
        if (root.isEmpty()) {
            return single(auth, "organisationUnit", uid, java.util.Optional.empty());
        }
        if (!includeDescendants) {
            return ResponseEntity.ok(root.get().payload());
        }
        // Descendant walk: every OU whose `path` starts with this
        // one's `path + "/"`, plus the root itself. The path
        // prefix is cheap and avoids a recursive CTE.
        final String rootPath = root.get().path();
        final String descendantPrefix = rootPath == null
                ? null : rootPath + "/";
        final List<JsonNode> out = new ArrayList<>();
        out.add(root.get().payload());
        if (descendantPrefix != null) {
            for (final var ou : mirror.findAllOrganisationUnits()) {
                if (ou.path() != null && ou.path().startsWith(descendantPrefix)) {
                    out.add(ou.payload());
                }
            }
        }
        return ResponseEntity.ok(Map.of("organisationUnits", out));
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
    public ResponseEntity<?> dataElement(final Authentication auth, @PathVariable final String uid) {
        return single(auth, "dataElement", uid,
                mirror.findDataElement(uid).map(MirroredEntity::payload));
    }

    @GetMapping("/dataSets")
    public ResponseEntity<Map<String, Object>> dataSets(
            final Authentication auth,
            @RequestParam(name = "pageSize", defaultValue = "50") final int pageSize,
            @RequestParam(name = "page", defaultValue = "1") final int page,
            @RequestParam(name = "orgUnit", required = false) final String orgUnit) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // §2.3.84 — hide unassigned datasets at the source so neither
        // the data-entry app nor the admin surface can offer a form
        // the operator's OU is not permitted to capture against.
        // Central DHIS2 rejects such submissions with E8022 "Data set
        // not usable with org unit", producing CONFLICT_REVIEW
        // envelopes that can never drain. Filtering here prevents
        // the bad state from being created in the first place.
        final List<ug.ac.mak.der.metadata.MirroredDataSet> all =
                mirror.findAllDataSets();
        final List<ug.ac.mak.der.metadata.MirroredDataSet> rows =
                orgUnit == null || orgUnit.isBlank()
                        ? all
                        : filterDataSetsByOrgUnit(all, orgUnit.trim());
        return ResponseEntity.ok(buildList("dataSets", rows, page, pageSize));
    }

    static List<ug.ac.mak.der.metadata.MirroredDataSet> filterDataSetsByOrgUnit(
            final List<ug.ac.mak.der.metadata.MirroredDataSet> rows,
            final String orgUnitUid) {
        final List<ug.ac.mak.der.metadata.MirroredDataSet> kept =
                new java.util.ArrayList<>(rows.size());
        for (final var ds : rows) {
            final JsonNode ous = ds.payload().get("organisationUnits");
            if (ous == null || !ous.isArray()) {
                continue;
            }
            for (final JsonNode node : ous) {
                final JsonNode id = node.get("id");
                if (id != null && orgUnitUid.equals(id.asText())) {
                    kept.add(ds);
                    break;
                }
            }
        }
        return kept;
    }

    @GetMapping("/dataSets/{uid}")
    public ResponseEntity<?> dataSet(final Authentication auth, @PathVariable final String uid) {
        return single(auth, "dataSet", uid,
                mirror.findDataSet(uid).map(MirroredEntity::payload));
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

    /**
     * DHIS2 custom apps (eregisters' metadata sync, Capture) read
     * {@code programs/{uid}} with a deep {@code fields=
     * programStages[programStageDataElements[dataElement[...]]]}
     * projection. The raw program payload stored by the metadata
     * mirror keeps {@code programStages} as a shallow list of
     * {@code {id}} references (that's how DHIS2 central ships the
     * export), so a client that walks
     * {@code programStages[0].programStageDataElements.map(...)}
     * hits {@code .map} on undefined and crashes the whole app.
     *
     * <p>Hydrate here: inline each referenced stage's full payload
     * from {@code der.metadata_program_stage.payload}. The
     * stage-level payload already carries full
     * {@code programStageDataElements} + {@code
     * programStageSections} (with their own shallow {@code
     * dataElement: {id}} refs, which eregisters reconciles client-
     * side against its separate {@code dataElements} list pull).</p>
     */
    @GetMapping("/programs/{uid}")
    public ResponseEntity<?> program(final Authentication auth, @PathVariable final String uid) {
        final var p = mirror.findProgram(uid).map(MirroredEntity::payload);
        if (p.isEmpty()) {
            return single(auth, "program", uid, p);
        }
        final JsonNode hydrated = hydrateProgramStages(p.get());
        return single(auth, "program", uid, java.util.Optional.of(hydrated));
    }

    private JsonNode hydrateProgramStages(final JsonNode program) {
        final JsonNode stages = program.get("programStages");
        if (!(stages instanceof com.fasterxml.jackson.databind.node.ArrayNode)
                || stages.size() == 0) {
            return program;
        }
        final com.fasterxml.jackson.databind.ObjectMapper mapper =
                new com.fasterxml.jackson.databind.ObjectMapper();
        final com.fasterxml.jackson.databind.node.ArrayNode hydrated =
                mapper.createArrayNode();
        for (final JsonNode ref : stages) {
            final JsonNode id = ref.get("id");
            if (id == null || !id.isTextual()) {
                hydrated.add(ref);
                continue;
            }
            try {
                final String payload = jdbc.queryForObject(
                        "SELECT payload::text FROM der.metadata_program_stage "
                                + "WHERE dhis2_uid = ?",
                        String.class, id.asText());
                if (payload == null) {
                    hydrated.add(ref);
                } else {
                    hydrated.add(mapper.readTree(payload));
                }
            } catch (final org.springframework.dao.EmptyResultDataAccessException ex) {
                hydrated.add(ref);
            } catch (final java.io.IOException ex) {
                throw new IllegalStateException(
                        "could not parse program_stage payload for "
                                + id.asText(), ex);
            }
        }
        // Partial hydration (anyMissing=true) is still better than
        // returning only {id} refs — eregisters tolerates a
        // ProgramStage that's minimal provided the shape is right.
        // Missing-stage events land on the request-logging
        // interceptor if a sync blocker surfaces.
        final com.fasterxml.jackson.databind.node.ObjectNode out =
                (com.fasterxml.jackson.databind.node.ObjectNode) program.deepCopy();
        out.set("programStages", hydrated);
        return out;
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
    public ResponseEntity<?> trackedEntityType(final Authentication auth, @PathVariable final String uid) {
        return single(auth, "trackedEntityType", uid,
                mirror.findTrackedEntityType(uid).map(MirroredEntity::payload));
    }

    /**
     * DHIS2-shaped {@code /api/<resource>/{uid}} responder.
     *
     * <p>When the mirror doesn't carry the row, return the exact
     * error envelope DHIS2 central emits:
     * {@code {httpStatus, httpStatusCode, status, message}} with
     * a human-readable message that names the resource + uid.
     * Stock DHIS2 apps (eregisters, Capture) surface the
     * {@code message} field to the operator; a bare 404 with no
     * body degrades to "An unknown error occurred (404)" which
     * sends operators on a wild goose chase. Pointing the message
     * at "{resource} with id {uid} does not exist on this edge
     * — run metadata sync to pull it from central" tells the
     * operator exactly what to do.</p>
     */
    private static ResponseEntity<?> single(final Authentication auth,
                                                final String resource,
                                                final String uid,
                                                final java.util.Optional<JsonNode> payload) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (payload.isPresent()) {
            return ResponseEntity.ok(payload.get());
        }
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_FOUND)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                        "httpStatus", "NotFound",
                        "httpStatusCode", 404,
                        "status", "ERROR",
                        "message", resource + " with id " + uid
                                + " does not exist on this edge."
                                + " Run metadata sync to pull it from central"
                                + " (Admin → Sync → Metadata).",
                        "resource", resource,
                        "uid", uid));
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

    @GetMapping({
            "/programRules", "/programRuleActions",
            "/trackedEntityAttributes", "/programStages",
            "/categoryOptionCombos"
    })
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
        final String table = switch (resource) {
            case "programRules" -> "der.metadata_program_rule";
            case "programRuleActions" -> "der.metadata_program_rule_action";
            case "trackedEntityAttributes" -> "der.metadata_tracked_entity_attribute";
            case "programStages" -> "der.metadata_program_stage";
            case "categoryOptionCombos" -> "der.metadata_category_option_combo";
            default -> throw new IllegalStateException("no dedicated table for " + resource);
        };
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

    /**
     * DHIS2 custom apps (eregisters, Capture) commonly fetch
     * {@code /api/options?fields=...} on bootstrap to populate
     * option-set dropdowns, and {@code
     * /api/categoryCombos/<uid>/categoryOptionCombos} to resolve
     * disaggregation axes. DER doesn't mirror the Option table
     * directly (options travel with option sets), and the nested
     * categoryOptionCombos lookup isn't shipped yet. Both return
     * empty-but-well-formed DHIS2 shapes so the app gets a 200
     * and continues bootstrap instead of hanging on retry loops.
     *
     * <p>If an operator needs real values, they come through the
     * existing {@code /api/optionSets/<uid>} and
     * {@code /api/categoryOptionCombos} endpoints.</p>
     */
    @GetMapping("/options")
    public ResponseEntity<Map<String, Object>> options(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", 1);
        pager.put("pageSize", 50);
        pager.put("total", 0);
        pager.put("pageCount", 0);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put("options", java.util.List.of());
        return ResponseEntity.ok(body);
    }

    @GetMapping("/categoryCombos/{uid}/categoryOptionCombos")
    public ResponseEntity<Map<String, Object>> categoryOptionCombosForCombo(
            final Authentication auth,
            @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("categoryOptionCombos", java.util.List.of());
        return ResponseEntity.ok(body);
    }

    // ─── Catalog-backed resources (V030 der-2.0.17) ──────────────────

    @GetMapping({
            "/optionSets", "/optionGroups", "/optionGroupSets",
            "/categories", "/categoryCombos",
            "/categoryOptions", "/categoryOptionGroups",
            "/categoryOptionGroupSets",
            "/programIndicators", "/programRuleVariables",
            "/programSections",
            "/programStageSections", "/programNotificationTemplates",
            "/relationshipTypes",
            "/indicators", "/indicatorTypes", "/indicatorGroups", "/indicatorGroupSets",
            "/legendSets", "/constants", "/predictors", "/predictorGroups",
            "/dataElementGroups", "/dataElementGroupSets",
            "/validationRules", "/validationRuleGroups", "/validationNotificationTemplates",
            "/organisationUnitGroups", "/organisationUnitGroupSets", "/organisationUnitLevels",
            "/userGroups", "/userRoles",
            "/attributes", "/documents",
            "/sqlViews", "/dashboards", "/visualizations", "/reports", "/maps",
            "/eventReports", "/eventCharts", "/dataEntryForms"
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
            "/categories/{uid}", "/categoryCombos/{uid}",
            "/categoryOptions/{uid}", "/categoryOptionGroups/{uid}",
            "/categoryOptionGroupSets/{uid}",
            "/programIndicators/{uid}", "/programRuleVariables/{uid}",
            "/programSections/{uid}",
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
            "/attributes/{uid}", "/documents/{uid}",
            "/sqlViews/{uid}", "/dashboards/{uid}", "/visualizations/{uid}",
            "/reports/{uid}", "/maps/{uid}",
            "/eventReports/{uid}", "/eventCharts/{uid}", "/dataEntryForms/{uid}"
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
