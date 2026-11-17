package ug.ac.mak.der.dhis2emulator;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/configuration/**} surface — 37 operations across
 * 2.41–2.44. All backed by {@code der.system_setting} under the
 * {@code configuration:} namespace so the same row-level encryption /
 * audit path that covers {@code /api/systemSettings} covers these too.
 *
 * <p>Semantic buckets:
 * <ul>
 *   <li><b>Scalar text</b> — {@code appHubUrl}, {@code systemId},
 *       {@code remoteServerUrl}, {@code remoteServerUsername},
 *       {@code systemReadOnlyMode}, {@code infrastructuralPeriodType},
 *       {@code facilityOrgUnitLevel}, {@code offlineOrganisationUnitLevel}.
 *       Written as a raw string, returned as a raw string (central's
 *       shape).</li>
 *   <li><b>UID reference</b> — {@code facilityOrgUnitGroupSet},
 *       {@code infrastructuralDataElements},
 *       {@code infrastructuralIndicators},
 *       {@code selfRegistrationOrgUnit}, {@code selfRegistrationRole}.
 *       Stored as a UID string, returned as a minimal
 *       {@code {id, displayName}} object or {@code null} when cleared.</li>
 *   <li><b>String list</b> — {@code corsAllowlist}, {@code corsWhitelist}
 *       (pre-2.44 alias), {@code feedbackRecipients},
 *       {@code systemUpdateNotificationRecipients}. Comma-joined on
 *       write, split on read.</li>
 *   <li><b>Fixed enum</b> — {@code twoFactorMethods} returns the DHIS2
 *       2.44 fixed enumeration (TOTP + EMAIL).</li>
 *   <li><b>Aggregate</b> — {@code GET /api/configuration} returns the
 *       union of all of the above in one call (shape the Settings app
 *       expects on bootstrap).</li>
 * </ul>
 *
 * Writes require ADMIN role; reads require an authenticated session.
 */
@RestController
@RequestMapping(path = "/api/configuration", produces = MediaType.APPLICATION_JSON_VALUE)
public class ConfigurationController {

    private static final String NS = "configuration:";

    private final SystemSettingsRepository repo;

    public ConfigurationController(final SystemSettingsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    // ---- GET /api/configuration (aggregate) ----

    @GetMapping
    public ResponseEntity<Map<String, Object>> aggregate(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("systemId", readScalar("systemId"));
        out.put("systemReadOnlyMode", readBoolScalar("systemReadOnlyMode"));
        out.put("appHubUrl", readScalarOrDefault("appHubUrl", "https://apps.dhis2.org"));
        out.put("remoteServerUrl", readScalar("remoteServerUrl"));
        out.put("remoteServerUsername", readScalar("remoteServerUsername"));
        out.put("infrastructuralPeriodType", readScalarOrDefault("infrastructuralPeriodType", "Monthly"));
        out.put("facilityOrgUnitLevel", readScalar("facilityOrgUnitLevel"));
        out.put("offlineOrganisationUnitLevel", readScalar("offlineOrganisationUnitLevel"));
        out.put("facilityOrgUnitGroupSet", readUidRef("facilityOrgUnitGroupSet"));
        out.put("infrastructuralDataElements", readUidRef("infrastructuralDataElements"));
        out.put("infrastructuralIndicators", readUidRef("infrastructuralIndicators"));
        out.put("selfRegistrationOrgUnit", readUidRef("selfRegistrationOrgUnit"));
        out.put("selfRegistrationRole", readUidRef("selfRegistrationRole"));
        out.put("feedbackRecipients", readUidRef("feedbackRecipients"));
        out.put("corsAllowlist", readList("corsAllowlist"));
        out.put("corsWhitelist", readList("corsAllowlist"));
        out.put("systemUpdateNotificationRecipients", readUidRef("systemUpdateNotificationRecipients"));
        out.put("twoFactorMethods", TWO_FACTOR_METHODS);
        return ResponseEntity.ok(out);
    }

    // ---- Scalar text endpoints ----

    @GetMapping(path = "/appHubUrl", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> appHubUrl() {
        return ResponseEntity.ok(readScalarOrDefault("appHubUrl", "https://apps.dhis2.org"));
    }

    @GetMapping(path = "/systemId", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> systemId() {
        return ResponseEntity.ok(readScalarOrDefault("systemId", ""));
    }

    @PostMapping("/systemId")
    public ResponseEntity<Map<String, Object>> setSystemId(final Authentication auth,
                                                             @RequestBody(required = false) final String body) {
        return writeScalar(auth, "systemId", body);
    }

    @GetMapping(path = "/systemReadOnlyMode", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> systemReadOnlyMode() {
        return ResponseEntity.ok(Boolean.toString(readBoolScalar("systemReadOnlyMode")));
    }

    @GetMapping(path = "/remoteServerUrl", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> remoteServerUrl() {
        return ResponseEntity.ok(readScalarOrDefault("remoteServerUrl", ""));
    }

    @GetMapping(path = "/remoteServerUsername", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> remoteServerUsername() {
        return ResponseEntity.ok(readScalarOrDefault("remoteServerUsername", ""));
    }

    @GetMapping(path = "/infrastructuralPeriodType", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> infrastructuralPeriodType() {
        return ResponseEntity.ok(readScalarOrDefault("infrastructuralPeriodType", "Monthly"));
    }

    @PostMapping("/infrastructuralPeriodType")
    public ResponseEntity<Map<String, Object>> setInfrastructuralPeriodType(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "infrastructuralPeriodType", body);
    }

    @GetMapping(path = "/facilityOrgUnitLevel", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> facilityOrgUnitLevel() {
        return ResponseEntity.ok(readScalarOrDefault("facilityOrgUnitLevel", ""));
    }

    @PostMapping("/facilityOrgUnitLevel")
    public ResponseEntity<Map<String, Object>> setFacilityOrgUnitLevel(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "facilityOrgUnitLevel", body);
    }

    @GetMapping(path = "/offlineOrganisationUnitLevel", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> offlineOrgUnitLevel() {
        return ResponseEntity.ok(readScalarOrDefault("offlineOrganisationUnitLevel", ""));
    }

    @PostMapping("/offlineOrganisationUnitLevel")
    public ResponseEntity<Map<String, Object>> setOfflineOrgUnitLevel(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "offlineOrganisationUnitLevel", body);
    }

    @DeleteMapping("/offlineOrganisationUnitLevel")
    public ResponseEntity<Map<String, Object>> clearOfflineOrgUnitLevel(final Authentication auth) {
        return clearKey(auth, "offlineOrganisationUnitLevel");
    }

    // ---- UID-reference endpoints ----

    @GetMapping("/facilityOrgUnitGroupSet")
    public ResponseEntity<Map<String, Object>> facilityOrgUnitGroupSet() {
        return ResponseEntity.ok(readUidRefOrEmpty("facilityOrgUnitGroupSet"));
    }

    @PostMapping("/facilityOrgUnitGroupSet")
    public ResponseEntity<Map<String, Object>> setFacilityOrgUnitGroupSet(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "facilityOrgUnitGroupSet", body);
    }

    @GetMapping("/infrastructuralDataElements")
    public ResponseEntity<Map<String, Object>> infrastructuralDataElements() {
        return ResponseEntity.ok(readUidRefOrEmpty("infrastructuralDataElements"));
    }

    @PostMapping("/infrastructuralDataElements")
    public ResponseEntity<Map<String, Object>> setInfrastructuralDataElements(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "infrastructuralDataElements", body);
    }

    @GetMapping("/infrastructuralIndicators")
    public ResponseEntity<Map<String, Object>> infrastructuralIndicators() {
        return ResponseEntity.ok(readUidRefOrEmpty("infrastructuralIndicators"));
    }

    @PostMapping("/infrastructuralIndicators")
    public ResponseEntity<Map<String, Object>> setInfrastructuralIndicators(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "infrastructuralIndicators", body);
    }

    @GetMapping("/selfRegistrationOrgUnit")
    public ResponseEntity<Map<String, Object>> selfRegistrationOrgUnit() {
        return ResponseEntity.ok(readUidRefOrEmpty("selfRegistrationOrgUnit"));
    }

    @PostMapping("/selfRegistrationOrgUnit")
    public ResponseEntity<Map<String, Object>> setSelfRegistrationOrgUnit(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "selfRegistrationOrgUnit", body);
    }

    @DeleteMapping("/selfRegistrationOrgUnit")
    public ResponseEntity<Map<String, Object>> clearSelfRegistrationOrgUnit(final Authentication auth) {
        return clearKey(auth, "selfRegistrationOrgUnit");
    }

    @GetMapping("/selfRegistrationRole")
    public ResponseEntity<Map<String, Object>> selfRegistrationRole() {
        return ResponseEntity.ok(readUidRefOrEmpty("selfRegistrationRole"));
    }

    @PostMapping("/selfRegistrationRole")
    public ResponseEntity<Map<String, Object>> setSelfRegistrationRole(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "selfRegistrationRole", body);
    }

    @DeleteMapping("/selfRegistrationRole")
    public ResponseEntity<Map<String, Object>> clearSelfRegistrationRole(final Authentication auth) {
        return clearKey(auth, "selfRegistrationRole");
    }

    @GetMapping("/feedbackRecipients")
    public ResponseEntity<Map<String, Object>> feedbackRecipients() {
        return ResponseEntity.ok(readUidRefOrEmpty("feedbackRecipients"));
    }

    @PostMapping("/feedbackRecipients")
    public ResponseEntity<Map<String, Object>> setFeedbackRecipients(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "feedbackRecipients", body);
    }

    @DeleteMapping("/feedbackRecipients")
    public ResponseEntity<Map<String, Object>> clearFeedbackRecipients(final Authentication auth) {
        return clearKey(auth, "feedbackRecipients");
    }

    @GetMapping("/systemUpdateNotificationRecipients")
    public ResponseEntity<Map<String, Object>> systemUpdateNotificationRecipients() {
        return ResponseEntity.ok(readUidRefOrEmpty("systemUpdateNotificationRecipients"));
    }

    @PostMapping("/systemUpdateNotificationRecipients")
    public ResponseEntity<Map<String, Object>> setSystemUpdateNotificationRecipients(
            final Authentication auth, @RequestBody(required = false) final String body) {
        return writeScalar(auth, "systemUpdateNotificationRecipients", body);
    }

    @DeleteMapping("/systemUpdateNotificationRecipients")
    public ResponseEntity<Map<String, Object>> clearSystemUpdateNotificationRecipients(final Authentication auth) {
        return clearKey(auth, "systemUpdateNotificationRecipients");
    }

    // ---- String-list endpoints ----

    @GetMapping("/corsAllowlist")
    public ResponseEntity<List<String>> corsAllowlist() {
        return ResponseEntity.ok(readList("corsAllowlist"));
    }

    @PostMapping("/corsAllowlist")
    public ResponseEntity<Map<String, Object>> setCorsAllowlist(
            final Authentication auth, @RequestBody(required = false) final Object body) {
        return writeList(auth, "corsAllowlist", body);
    }

    /** Pre-2.44 alias of {@code corsAllowlist}. Shares storage so a value
     *  written via either path reads back from both. */
    @GetMapping("/corsWhitelist")
    public ResponseEntity<List<String>> corsWhitelist() {
        return ResponseEntity.ok(readList("corsAllowlist"));
    }

    @PostMapping("/corsWhitelist")
    public ResponseEntity<Map<String, Object>> setCorsWhitelist(
            final Authentication auth, @RequestBody(required = false) final Object body) {
        return writeList(auth, "corsAllowlist", body);
    }

    // ---- Fixed enum ----

    private static final List<String> TWO_FACTOR_METHODS = List.of("TOTP", "EMAIL");

    @GetMapping("/twoFactorMethods")
    public ResponseEntity<List<String>> twoFactorMethods() {
        return ResponseEntity.ok(TWO_FACTOR_METHODS);
    }

    // ---- 2.43+ dataOutputPeriodTypes ----

    /**
     * DHIS2 central semantics: this list is the set of period types
     * <em>enabled for data output</em>. An empty list means "nothing
     * enabled" and causes Data Visualizer to render "No period types
     * are enabled in the system. Please contact your system
     * administrator." and then crash downstream when the user opens
     * the period picker.
     *
     * <p>On an edge appliance we default to <strong>all 19 DHIS2 period
     * types enabled</strong> when the operator hasn't narrowed the set.
     * Once an admin POSTs a narrower list it takes precedence. The
     * response shape is a JSON array of period-type id strings — the
     * exact format DV iterates.</p>
     */
    @GetMapping("/dataOutputPeriodTypes")
    public ResponseEntity<List<Map<String, Object>>> getDataOutputPeriodTypes(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<String> override = readList("dataOutputPeriodTypes");
        final List<String> types = override.isEmpty() ? ALL_PERIOD_TYPE_IDS : override;
        // DHIS2 central returns an array of OBJECTS (not plain strings)
        // here — Data Visualizer does b.find(j => j.name === R) so every
        // entry must carry a .name field. Returning ["Daily","Weekly"]
        // leaves DV's find returning undefined for every lookup and the
        // Period Type dropdown renders empty.
        final List<Map<String, Object>> out = new java.util.ArrayList<>(types.size());
        for (final String t : types) {
            out.add(Map.of("name", t, "displayName", t));
        }
        return ResponseEntity.ok(out);
    }

    private static final List<String> ALL_PERIOD_TYPE_IDS = List.of(
            "Daily", "Weekly", "WeeklyWednesday", "WeeklyThursday",
            "WeeklySaturday", "WeeklySunday", "BiWeekly",
            "Monthly", "BiMonthly",
            "Quarterly", "QuarterlyNov",
            "SixMonthly", "SixMonthlyApril", "SixMonthlyNov",
            "Yearly", "FinancialApril", "FinancialJuly",
            "FinancialOct", "FinancialNov");

    @PostMapping("/dataOutputPeriodTypes")
    public ResponseEntity<Map<String, Object>> setDataOutputPeriodTypes(
            final Authentication auth, @RequestBody(required = false) final Object body) {
        return writeList(auth, "dataOutputPeriodTypes", body);
    }

    // ---- helpers ----

    private String readScalar(final String key) {
        final String v = repo.read(NS + key);
        return v == null ? "" : v;
    }

    private String readScalarOrDefault(final String key, final String def) {
        final String v = repo.read(NS + key);
        return v == null || v.isEmpty() ? def : v;
    }

    private boolean readBoolScalar(final String key) {
        return "true".equalsIgnoreCase(repo.read(NS + key));
    }

    private List<String> readList(final String key) {
        final String v = repo.read(NS + key);
        if (v == null || v.isBlank()) {
            return List.of();
        }
        return Arrays.stream(v.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    /** Null when unset — central returns {@code null} here, not an empty
     *  object, and the Settings UI's optional-chaining depends on it. */
    private Map<String, Object> readUidRef(final String key) {
        final String uid = repo.read(NS + key);
        if (uid == null || uid.isBlank()) {
            return null;
        }
        return Map.of("id", uid, "displayName", uid);
    }

    private Map<String, Object> readUidRefOrEmpty(final String key) {
        final Map<String, Object> ref = readUidRef(key);
        return ref == null ? Map.of() : ref;
    }

    private ResponseEntity<Map<String, Object>> writeScalar(final Authentication auth,
                                                              final String key,
                                                              final String value) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to write configuration"));
        }
        repo.upsert(NS + key, value == null ? "" : value.trim(),
                principal.user().userId());
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Configuration " + key + " saved"));
    }

    @SuppressWarnings("unchecked")
    private ResponseEntity<Map<String, Object>> writeList(final Authentication auth,
                                                            final String key,
                                                            final Object body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to write configuration"));
        }
        final String joined;
        if (body instanceof List<?> list) {
            joined = list.stream()
                    .filter(o -> o != null && !o.toString().isBlank())
                    .map(Object::toString)
                    .reduce((a, b) -> a + "," + b)
                    .orElse("");
        } else if (body instanceof String s) {
            joined = s.trim();
        } else {
            joined = "";
        }
        repo.upsert(NS + key, joined, principal.user().userId());
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Configuration " + key + " saved"));
    }

    private ResponseEntity<Map<String, Object>> clearKey(final Authentication auth,
                                                           final String key) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!hasAdmin(principal)) {
            return ResponseEntity.status(403).body(Map.of(
                    "httpStatus", "Forbidden",
                    "message", "ADMIN role required to clear configuration"));
        }
        repo.delete(NS + key);
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "message", "Configuration " + key + " cleared"));
    }

    private static boolean hasAdmin(final EdgeUserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
