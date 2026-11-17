package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DER emulates the DHIS2 app-shell surfaces a stock DHIS2 2.4x
 * custom app ({@code eregisters}, {@code capture},
 * {@code dashboard}, {@code data-administration}, …) reads
 * during bootstrap. ADR-0004 only sanctions the write + metadata-
 * read paths we persist on-edge; purely central-side features
 * (interpretations, messages, system maintenance, analytics-table
 * rebuilds, saved-dashboard search, …) are out of scope.
 *
 * <p>A 404 on these paths crashes the DHIS2 app's render instead
 * of letting it degrade to an empty state — stock DHIS2 bundles
 * don't handle a 404 as "feature unavailable." This controller
 * returns the DHIS2-shaped empty response per path so the app
 * renders cleanly:
 *
 * <ul>
 *   <li><b>Data Administration</b> —
 *       {@code lockExceptions} + {@code lockExceptions/combinations}
 *       + {@code maintenance} + {@code resourceTables} +
 *       {@code resourceTables/analytics}</li>
 *   <li><b>Dashboard</b> —
 *       {@code dashboards/search} + {@code dataStatistics} +
 *       {@code dataStatistics/favorites} + {@code dimensions} +
 *       {@code interpretations} + {@code messageConversations} +
 *       {@code configuration/dataOutputPeriodTypes} +
 *       {@code locales/db} + {@code users/gist}</li>
 *   <li><b>Capture</b> —
 *       {@code eventFilters} +
 *       {@code trackedEntityInstanceFilters} +
 *       {@code programStageWorkingLists} + {@code sharing} +
 *       {@code sharing/search} + {@code userLookup} +
 *       {@code users} + {@code programs/orgUnits} +
 *       {@code tracker/enrollments} + {@code tracker/relationships} +
 *       {@code tracker/ownership/*}</li>
 * </ul>
 * </p>
 *
 * <p>Each stub emits the key the app destructures. A GET list
 * returns {@code {<resource>: [], pager: {page:1,pageSize:50,
 * pageCount:1,total:0}}}; a POST returns a 200 job-ack so the
 * UI's spinner clears. The real pilot-signal surfaces live
 * under DER's own {@code /edge-api/v1/admin/ops/*} endpoints
 * (FR-15-03 / FR-15-04).</p>
 */
@RestController
@RequestMapping(produces = MediaType.APPLICATION_JSON_VALUE)
public class AppShellEmptySurfacesController {

    // ---- Data Administration ----

    @GetMapping("/api/lockExceptions")
    public ResponseEntity<Map<String, Object>> lockExceptions(final Authentication auth) {
        return listEmpty(auth, "lockExceptions");
    }

    @GetMapping("/api/lockExceptions/combinations")
    public ResponseEntity<Map<String, Object>> lockExceptionsCombinations(final Authentication auth) {
        return listEmpty(auth, "lockExceptions");
    }

    @GetMapping("/api/maintenance")
    public ResponseEntity<Map<String, Object>> maintenance(final Authentication auth) {
        return listEmpty(auth, "maintenance");
    }

    /** DA kicks the maintenance job via POST and polls
     *  {@code /api/system/tasks/MAINTENANCE}; ack cleanly. */
    @PostMapping("/api/maintenance")
    public ResponseEntity<Map<String, Object>> runMaintenance(final Authentication auth) {
        return jobAck(auth, "maintenance");
    }

    @GetMapping("/api/resourceTables")
    public ResponseEntity<Map<String, Object>> resourceTables(final Authentication auth) {
        return listEmpty(auth, "resourceTables");
    }

    @GetMapping("/api/resourceTables/analytics")
    public ResponseEntity<Map<String, Object>> resourceTablesAnalytics(final Authentication auth) {
        return listEmpty(auth, "resourceTables");
    }

    @PostMapping({"/api/resourceTables", "/api/resourceTables/analytics"})
    public ResponseEntity<Map<String, Object>> runResourceTables(final Authentication auth) {
        return jobAck(auth, "resourceTables");
    }

    /**
     * Data Administration → "Generate Min Max Values" posts to
     * {@code /api/minMaxValues} with a dataSet + OU scope;
     * central scans analytics-table history to derive bounds.
     * DER is an edge appliance — the analytics table isn't
     * replicated locally (too large for the appliance
     * footprint), so generation can't run here. Ack cleanly so
     * the UI progresses to its empty state instead of surfacing
     * a 404. Remove-min-max mirrors the shape (DELETE).
     */
    @PostMapping("/api/minMaxValues")
    public ResponseEntity<Map<String, Object>> generateMinMax(final Authentication auth) {
        return jobAck(auth, "minMaxValueGeneration");
    }

    @DeleteMapping("/api/minMaxValues")
    public ResponseEntity<Map<String, Object>> removeMinMax(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", "min-max values are not generated on this appliance."));
    }

    @GetMapping("/api/minMaxValues")
    public ResponseEntity<Map<String, Object>> listMinMax(final Authentication auth) {
        return listEmpty(auth, "minMaxDataElements");
    }

    // ---- Dashboard ----

    @GetMapping({"/api/dashboards/search"})
    public ResponseEntity<Map<String, Object>> dashboardsSearch(final Authentication auth) {
        return listEmpty(auth, "dashboardItems");
    }

    @GetMapping({"/api/dataStatistics", "/api/dataStatistics/favorites"})
    public ResponseEntity<List<Object>> dataStatistics(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/api/dimensions")
    public ResponseEntity<Map<String, Object>> dimensions(final Authentication auth) {
        return listEmpty(auth, "dimensions");
    }

    /**
     * {@code @dhis2/analytics}'s {@code apiFetchRecommendedIds}
     * calls {@code dataEngine.query({recommendedDimensions: {...}})}
     * and then destructures
     * {@code recommendedDimensionsData.recommendedDimensions.dimensions
     * .map(item => item.id)}. d2 app-runtime wraps the server body
     * as {@code {<queryKey>: body}}, so the <em>server</em> body
     * must be the inner {@code {dimensions: [...]}} shape — not the
     * doubly-wrapped {@code {recommendedDimensions: {dimensions:
     * [...]}}} that DHIS2 central serialises for its own REST
     * wrapper (central strips the outer envelope via content
     * negotiation before d2 sees it). Returning the bare
     * {@code {dimensions: []}} here matches what d2 expects.
     */
    @GetMapping("/api/dimensions/recommendations")
    public ResponseEntity<Map<String, Object>> dimensionsRecommendations(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("dimensions", List.of()));
    }

    /**
     * DHIS2 period types are a fixed built-in set (not operator-defined),
     * driven off the {@code PeriodType} enum in dhis2-core. The listing
     * is what Data Visualizer / Maps / Event Reports call when the
     * operator opens the Period dimension — an empty response makes
     * {@code @dhis2/analytics} render "No period types enabled in the
     * system. Please contact your system administrator." Returning
     * the stock DHIS2 2.4x set lets Period selection, Relative Periods,
     * and the "Update" action all work on-edge with no central round-
     * trip. Enumeration + ISO durations mirror
     * {@code dhis2-core/.../period/PeriodType.java}.
     */
    @GetMapping("/api/periodTypes")
    public ResponseEntity<Map<String, Object>> periodTypes(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "periodTypes", DHIS2_PERIOD_TYPES,
                "pager", pager(DHIS2_PERIOD_TYPES.size())));
    }

    private static Map<String, Object> pt(final String name, final String iso,
                                            final String fmt, final int order) {
        // DHIS2 central returns both `id` and `name` on every period type
        // (they're the same string — period types use their type-name as
        // their identifier). Data Visualizer iterates the list and reads
        // `.id` to render the picker chip; without it, DV flows undefined
        // through its hasLevelPrefix check and crashes with
        // "Cannot read properties of undefined (reading 'substr')".
        return Map.of("id", name, "name", name, "displayName", name,
                "isoDuration", iso, "isoFormat", fmt, "frequencyOrder", order);
    }

    private static final List<Map<String, Object>> DHIS2_PERIOD_TYPES = List.of(
            pt("Daily",             "P1D",  "yyyyMMdd",     1),
            pt("Weekly",            "P7D",  "yyyyWn",       7),
            pt("WeeklyWednesday",   "P7D",  "yyyyWedWn",    7),
            pt("WeeklyThursday",    "P7D",  "yyyyThuWn",    7),
            pt("WeeklySaturday",    "P7D",  "yyyySatWn",    7),
            pt("WeeklySunday",      "P7D",  "yyyySunWn",    7),
            pt("BiWeekly",          "P14D", "yyyyBiWn",    14),
            pt("Monthly",           "P1M",  "yyyyMM",      30),
            pt("BiMonthly",         "P2M",  "yyyyMMB",     61),
            pt("Quarterly",         "P3M",  "yyyyQn",      91),
            pt("QuarterlyNov",      "P3M",  "yyyyNovQn",   91),
            pt("SixMonthly",        "P6M",  "yyyySn",     182),
            pt("SixMonthlyApril",   "P6M",  "yyyyAprilSn", 182),
            pt("SixMonthlyNov",     "P6M",  "yyyyNovSn",   182),
            pt("Yearly",            "P1Y",  "yyyy",        365),
            pt("FinancialApril",    "P1Y",  "yyyyApril",   365),
            pt("FinancialJuly",     "P1Y",  "yyyyJuly",    365),
            pt("FinancialOct",      "P1Y",  "yyyyOct",     365),
            pt("FinancialNov",      "P1Y",  "yyyyNov",     365));

    private static Map<String, Object> pager(final int total) {
        return Map.of("page", 1, "pageSize", 50,
                "pageCount", total == 0 ? 0 : 1, "total", total);
    }

    /** Fixed DHIS2 relative-period catalogue — mirrors
     *  {@code RelativePeriodEnum.java} in dhis2-core. Data Visualizer
     *  reads this to populate the "Relative period" dropdown when
     *  building a visualization. 65 entries across weekly / monthly /
     *  quarterly / yearly / financial-year slices. */
    @GetMapping("/api/periodTypes/relativePeriodTypes")
    public ResponseEntity<Map<String, Object>> relativePeriodTypes(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "relativePeriods", RELATIVE_PERIOD_TYPES,
                "pager", pager(RELATIVE_PERIOD_TYPES.size())));
    }

    @GetMapping("/api/periodTypes/{name}")
    public ResponseEntity<Map<String, Object>> periodType(
            final Authentication auth,
            @PathVariable("name") final String name) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        for (final Map<String, Object> pt : DHIS2_PERIOD_TYPES) {
            if (name.equals(pt.get("name"))) {
                return ResponseEntity.ok(pt);
            }
        }
        return ResponseEntity.status(404).body(Map.of(
                "httpStatus", "NotFound",
                "httpStatusCode", 404,
                "status", "ERROR",
                "message", "PeriodType " + name + " does not exist"));
    }

    /** Period-type writes land on-edge as no-ops: DHIS2 PeriodType is a
     *  compile-time enum; "updating" one via API never changes the
     *  underlying behaviour in central either (central silently accepts
     *  the body and returns 200). The DER edge follows the same contract
     *  so the Data Administration translation flow doesn't error. */
    @PutMapping("/api/periodTypes/{name}")
    public ResponseEntity<Map<String, Object>> updatePeriodType(
            final Authentication auth,
            @PathVariable("name") final String name) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "PeriodType " + name + " noted (DHIS2 PeriodType is a compile-time enum)"));
    }

    @PutMapping("/api/periodTypes")
    public ResponseEntity<Map<String, Object>> updatePeriodTypes(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Period type collection update accepted (no-op on edge)"));
    }

    @PutMapping("/api/periodTypes/{name}/translations")
    public ResponseEntity<Map<String, Object>> updatePeriodTypeTranslations(
            final Authentication auth,
            @PathVariable("name") final String name) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Translations for " + name + " saved"));
    }

    private static Map<String, Object> rp(final String name) {
        return Map.of("id", name, "name", name);
    }

    private static final List<Map<String, Object>> RELATIVE_PERIOD_TYPES = List.of(
            rp("TODAY"), rp("YESTERDAY"), rp("LAST_3_DAYS"),
            rp("LAST_7_DAYS"), rp("LAST_14_DAYS"), rp("LAST_30_DAYS"),
            rp("LAST_60_DAYS"), rp("LAST_90_DAYS"), rp("LAST_180_DAYS"),
            rp("THIS_WEEK"), rp("LAST_WEEK"),
            rp("LAST_4_WEEKS"), rp("LAST_12_WEEKS"), rp("LAST_52_WEEKS"),
            rp("WEEKS_THIS_YEAR"),
            rp("THIS_BIWEEK"), rp("LAST_BIWEEK"), rp("LAST_4_BIWEEKS"),
            rp("THIS_MONTH"), rp("LAST_MONTH"),
            rp("LAST_3_MONTHS"), rp("LAST_6_MONTHS"), rp("LAST_12_MONTHS"),
            rp("MONTHS_THIS_YEAR"),
            rp("THIS_BIMONTH"), rp("LAST_BIMONTH"), rp("LAST_6_BIMONTHS"),
            rp("BIMONTHS_THIS_YEAR"),
            rp("THIS_QUARTER"), rp("LAST_QUARTER"),
            rp("LAST_4_QUARTERS"), rp("QUARTERS_THIS_YEAR"),
            rp("THIS_SIX_MONTH"), rp("LAST_SIX_MONTH"),
            rp("LAST_2_SIXMONTHS"),
            rp("THIS_YEAR"), rp("LAST_YEAR"),
            rp("LAST_5_YEARS"), rp("LAST_10_YEARS"),
            rp("LAST_5_FINANCIAL_YEARS"), rp("LAST_10_FINANCIAL_YEARS"),
            rp("THIS_FINANCIAL_YEAR"), rp("LAST_FINANCIAL_YEAR"),
            rp("MONTHS_LAST_YEAR"), rp("QUARTERS_LAST_YEAR"));

    @GetMapping("/api/interpretations")
    public ResponseEntity<Map<String, Object>> interpretations(final Authentication auth) {
        return listEmpty(auth, "interpretations");
    }

    @GetMapping("/api/messageConversations")
    public ResponseEntity<Map<String, Object>> messageConversations(final Authentication auth) {
        return listEmpty(auth, "messageConversations");
    }

    // /api/configuration/dataOutputPeriodTypes moved to
    // ConfigurationController which returns all 19 enabled period type
    // ids by default (empty here crashes Data Visualizer's period
    // picker with "No period types are enabled in the system").

    @GetMapping("/api/locales/db")
    public ResponseEntity<List<Object>> localesDb(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/api/users/gist")
    public ResponseEntity<Map<String, Object>> usersGist(final Authentication auth) {
        return listEmpty(auth, "users");
    }

    // ---- Capture ----

    @GetMapping("/api/eventFilters")
    public ResponseEntity<Map<String, Object>> eventFilters(final Authentication auth) {
        return listEmpty(auth, "eventFilters");
    }

    @GetMapping("/api/trackedEntityInstanceFilters")
    public ResponseEntity<Map<String, Object>> trackedEntityInstanceFilters(final Authentication auth) {
        return listEmpty(auth, "trackedEntityInstanceFilters");
    }

    @GetMapping("/api/programStageWorkingLists")
    public ResponseEntity<Map<String, Object>> programStageWorkingLists(final Authentication auth) {
        return listEmpty(auth, "programStageWorkingLists");
    }

    @GetMapping({"/api/sharing", "/api/sharing/search"})
    public ResponseEntity<Map<String, Object>> sharing(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // DHIS2 Sharing returns a unified {meta, object} shape;
        // DER has no UID-level sharing (it's an edge appliance,
        // not an authority), so emit the empty-but-valid shape.
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("meta", Map.of("allowPublicAccess", true,
                "allowExternalAccess", false));
        body.put("object", Map.of(
                "id", "",
                "name", "",
                "displayName", "",
                "externalAccess", false,
                "publicAccess", "rw------",
                "user", Map.of(),
                "userGroupAccesses", List.of(),
                "userAccesses", List.of()));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/api/userLookup")
    public ResponseEntity<Map<String, Object>> userLookup(final Authentication auth) {
        return listEmpty(auth, "users");
    }

    @GetMapping({"/api/users"})
    public ResponseEntity<Map<String, Object>> users(final Authentication auth) {
        return listEmpty(auth, "users");
    }

    @GetMapping("/api/programs/orgUnits")
    public ResponseEntity<Map<String, Object>> programsOrgUnits(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // Capture reads this to filter OUs assigned per program.
        // DER doesn't maintain the program↔OU binding at this
        // granularity; the single-OU edge posture means the
        // operator's OU is always the only choice, so the empty
        // map is accurate.
        return ResponseEntity.ok(Map.of("programs", List.of()));
    }

    @GetMapping({"/api/tracker/enrollments", "/api/tracker/relationships"})
    public ResponseEntity<Map<String, Object>> trackerSub(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", 1);
        pager.put("pageSize", 50);
        pager.put("pageCount", 0);
        pager.put("total", 0);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put("instances", List.of());
        return ResponseEntity.ok(body);
    }

    @PostMapping({"/api/tracker/ownership/override",
            "/api/tracker/ownership/transfer"})
    public ResponseEntity<Map<String, Object>> trackerOwnership(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // DER is a single-appliance context — ownership is the
        // bound-OU operator. Accept the request without state so
        // the UI progresses; a future peering phase (ADR-0027)
        // may hook in real ownership transfer via referrals.
        return ResponseEntity.ok(Map.of(
                "httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", "Ownership operations are not applicable "
                        + "on a single-OU appliance.",
                "response", Map.of("id", "noop-" + UUID.randomUUID())));
    }

    @GetMapping("/api/fileResources")
    public ResponseEntity<Map<String, Object>> fileResourcesList(final Authentication auth) {
        // FileResourceController has POST + GET /{uid}; the bare
        // list path isn't on that controller. DER doesn't surface
        // a listing (file resources are referenced by uid by the
        // capture app); return empty so the UI's fallback render
        // doesn't crash on undefined.length.
        return listEmpty(auth, "fileResources");
    }

    @GetMapping("/api/resource")
    public ResponseEntity<Map<String, Object>> resource(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        // Capture's upload-resource flow POSTs; this GET is a
        // feature-detection probe. A 200 with an empty object
        // tells it the surface exists; the actual upload hits
        // /api/fileResources.
        return ResponseEntity.ok(Map.of());
    }

    // ---- shared helpers ----

    private ResponseEntity<Map<String, Object>> listEmpty(final Authentication auth,
                                                             final String resourceKey) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> pager = new LinkedHashMap<>();
        pager.put("page", 1);
        pager.put("pageSize", 50);
        pager.put("pageCount", 0);
        pager.put("total", 0);
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("pager", pager);
        body.put(resourceKey, List.of());
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> jobAck(final Authentication auth,
                                                           final String jobKind) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", jobKind + " is not configured on this appliance.",
                "response", Map.of(
                        "name", jobKind,
                        "id", "noop-" + UUID.randomUUID())));
    }
}
