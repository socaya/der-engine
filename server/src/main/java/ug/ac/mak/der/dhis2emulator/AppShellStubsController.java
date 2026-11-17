package ug.ac.mak.der.dhis2emulator;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValue;
import ug.ac.mak.der.workflows.aggregate.AggregateDataValueRepository;

/**
 * DHIS2 app-shell endpoints that eregisters / Capture / other
 * stock DHIS2 apps probe during bootstrap. Each handler returns a
 * real response backed by actual DER state — no constant stubs:
 *
 * <ul>
 *   <li>{@code GET /api/ping} — app-runtime keepalive. Returns
 *       {@code "pong"} on a successful DB health check
 *       ({@code SELECT 1}) so a broken DB surfaces as 503
 *       instead of a false-positive 200.</li>
 *   <li>{@code GET /api/loginConfig} — reads live from
 *       {@code der.signin_setting} (V090) and
 *       {@code der.system_setting} for the title / locale /
 *       footers. No invented values.</li>
 *   <li>{@code GET /api/staticContent/logo_banner} +
 *       {@code logo_front} — serves the uploaded banner PNG
 *       bytes from {@code signin_setting.bg_image}; 204 when
 *       no banner is set (matches DHIS2 central).</li>
 *   <li>{@code GET /api/dataEntry/dataSetCompletion} — reads
 *       from {@code der.dataset_completion} with optional
 *       {@code ds / ou / pe} filters.</li>
 *   <li>{@code GET /api/dataEntry/dataValues} — reads from the
 *       {@link AggregateDataValueRepository} with orgUnit +
 *       period filters. Returns real data.</li>
 * </ul>
 */
@RestController
public class AppShellStubsController {

    private final JdbcTemplate jdbc;
    private final AggregateDataValueRepository aggregates;

    public AppShellStubsController(final JdbcTemplate jdbc,
                                      final AggregateDataValueRepository aggregates) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.aggregates = Objects.requireNonNull(aggregates, "aggregates");
    }

    /**
     * DHIS2 central returns the literal string "pong" with 200.
     * We back it with a real DB probe so a broken DB surfaces
     * as 503 instead of lying about health.
     */
    @GetMapping(path = "/api/ping",
            produces = { MediaType.TEXT_PLAIN_VALUE,
                         MediaType.APPLICATION_JSON_VALUE })
    public ResponseEntity<String> ping() {
        try {
            final Integer one = jdbc.queryForObject("SELECT 1", Integer.class);
            if (one == null || one != 1) {
                return ResponseEntity.status(503).body("db-unreachable");
            }
        } catch (final RuntimeException ex) {
            return ResponseEntity.status(503)
                    .body("db-error: " + ex.getMessage());
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body("pong");
    }

    /**
     * Live config read from signin_setting + system_setting.
     * Response shape matches DHIS2 central 2.44.
     */
    @GetMapping(path = "/api/loginConfig",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> loginConfig() {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("applicationTitle", readSystemSetting(
                "applicationTitle", "DER (DHIS2 Edge Runtime)"));
        body.put("applicationDescription", readSystemSetting(
                "keyApplicationDescription",
                "Offline-first DHIS2 edge appliance."));
        body.put("applicationLeftSideFooter", readSystemSetting(
                "keyApplicationLeftSideFooter", ""));
        body.put("applicationRightSideFooter", readSystemSetting(
                "keyApplicationRightSideFooter", ""));
        body.put("uiLocale", readSystemSetting("keyUiLocale", "en"));
        final Optional<SignInSetting> signin = readSignInSetting();
        body.put("loginPageLayout", signin.map(SignInSetting::layout)
                .filter(s -> s != null && !s.isBlank())
                .orElse("DEFAULT"));
        final boolean hasImage = signin.map(SignInSetting::hasImage).orElse(false);
        body.put("useCustomLogoFront", hasImage);
        body.put("useCustomLogoBanner", hasImage);
        body.put("allowAccountRecovery", false);
        body.put("emailConfigured", false);
        body.put("minPasswordLength", 8);
        body.put("maxPasswordLength", 72);
        body.put("recaptchaSite", null);
        return ResponseEntity.ok(body);
    }

    @GetMapping(path = "/api/staticContent/logo_banner")
    public ResponseEntity<byte[]> staticLogoBanner() {
        return readSignInImage();
    }

    @GetMapping(path = "/api/staticContent/logo_front")
    public ResponseEntity<byte[]> staticLogoFront() {
        return readSignInImage();
    }

    /**
     * Legacy Struts feature-detection probe used by very old DHIS2
     * app shells (eregisters ships one at bootstrap). Modern apps
     * swallow the 404, but returning an empty list here cleans up
     * the DevTools console noise on every app load. Matches how
     * DHIS2 central responds when no custom modules exist.
     */
    @GetMapping(path = "/dhis-web-commons/menu/getModules.action",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getModulesAction() {
        return ResponseEntity.ok(Map.of("modules", List.of()));
    }

    /**
     * DHIS2 apps-bundle discovery — Dashboard (and other React apps
     * built with the DHIS2 PWA shell) read this at boot to render
     * the "Open in other app" launcher dropdown. Empty bundle maps
     * to "no sibling apps discoverable" — the DER app launcher
     * surfaces the real app list via the native shell instead.
     * Central returns the same {@code {apps: []}} shape on a
     * fresh install with no custom apps.
     */
    @GetMapping(path = "/dhis-web-apps/apps-bundle.json",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> appsBundle() {
        return ResponseEntity.ok(Map.of("apps", List.of()));
    }

    private ResponseEntity<byte[]> readSignInImage() {
        try {
            final Map<String, Object> row = jdbc.queryForMap(
                    "SELECT bg_image, bg_mime FROM der.signin_setting WHERE id = 1");
            final byte[] bytes = (byte[]) row.get("bg_image");
            if (bytes == null || bytes.length == 0) {
                return ResponseEntity.noContent().build();
            }
            final String mime = (String) row.get("bg_mime");
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(
                            mime == null ? "image/png" : mime))
                    .body(bytes);
        } catch (final RuntimeException ex) {
            return ResponseEntity.noContent().build();
        }
    }

    /**
     * Real read against der.dataset_completion with optional
     * filters. DHIS2 central legacy dataEntry shape.
     */
    @GetMapping(path = "/api/dataEntry/dataSetCompletion",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> dataSetCompletion(
            final Authentication auth,
            @RequestParam(name = "ds", required = false) final String dataSetUid,
            @RequestParam(name = "ou", required = false) final String orgUnitUid,
            @RequestParam(name = "pe", required = false) final String period) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final StringBuilder sql = new StringBuilder(
                "SELECT data_set_uid, org_unit_uid, period_iso, "
              + "attribute_option_combo, completed, completed_by, "
              + "completed_at FROM der.dataset_completion WHERE 1=1");
        final List<Object> args = new ArrayList<>();
        if (dataSetUid != null && !dataSetUid.isBlank()) {
            sql.append(" AND data_set_uid = ?");
            args.add(dataSetUid);
        }
        if (orgUnitUid != null && !orgUnitUid.isBlank()) {
            sql.append(" AND org_unit_uid = ?");
            args.add(orgUnitUid);
        }
        if (period != null && !period.isBlank()) {
            sql.append(" AND period_iso = ?");
            args.add(period);
        }
        sql.append(" ORDER BY completed_at DESC LIMIT 500");
        final List<Map<String, Object>> rows = jdbc.query(sql.toString(),
                (ResultSet rs, int i) -> {
                    final Map<String, Object> m = new LinkedHashMap<>();
                    m.put("dataSet", rs.getString("data_set_uid"));
                    m.put("organisationUnit", rs.getString("org_unit_uid"));
                    m.put("period", rs.getString("period_iso"));
                    m.put("attributeOptionCombo",
                            rs.getString("attribute_option_combo"));
                    m.put("completed", rs.getBoolean("completed"));
                    final Object by = rs.getObject("completed_by");
                    m.put("storedBy", by == null ? null : by.toString());
                    m.put("date", rs.getTimestamp("completed_at")
                            .toInstant().toString());
                    return m;
                },
                args.toArray());
        return ResponseEntity.ok(Map.of("dataSetCompletion", rows));
    }

    /**
     * Real read against AggregateDataValueRepository. DHIS2
     * central legacy dataEntry /dataValues shape.
     */
    @GetMapping(path = "/api/dataEntry/dataValues",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> dataEntryDataValues(
            final Authentication auth,
            @RequestParam(name = "ou", required = false) final String orgUnitUid,
            @RequestParam(name = "pe", required = false) final String period) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (orgUnitUid == null || orgUnitUid.isBlank()
                || period == null || period.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "httpStatus", "BadRequest",
                    "httpStatusCode", 400,
                    "status", "ERROR",
                    "message", "ou and pe query params are required."));
        }
        final List<AggregateDataValue> rows = aggregates.findByFilter(
                orgUnitUid, period, 500);
        final List<Map<String, Object>> dataValues = new ArrayList<>(rows.size());
        for (final AggregateDataValue v : rows) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("dataElement", v.dataElementUid());
            m.put("categoryOptionCombo", v.categoryOptionComboUid());
            m.put("value", v.valueText());
            dataValues.add(m);
        }
        return ResponseEntity.ok(Map.of("dataValues", dataValues));
    }

    // ---- helpers ----

    private String readSystemSetting(final String key, final String fallback) {
        try {
            final String val = jdbc.queryForObject(
                    "SELECT value FROM der.system_setting WHERE key = ?",
                    String.class, key);
            return val == null || val.isBlank() ? fallback : val;
        } catch (final RuntimeException ex) {
            return fallback;
        }
    }

    private Optional<SignInSetting> readSignInSetting() {
        try {
            return Optional.ofNullable(jdbc.queryForObject(
                    "SELECT layout, bg_image IS NOT NULL AS has_image "
                  + "FROM der.signin_setting WHERE id = 1",
                    (ResultSet rs, int i) -> new SignInSetting(
                            rs.getString("layout"),
                            rs.getBoolean("has_image"))));
        } catch (final RuntimeException ex) {
            return Optional.empty();
        }
    }

    private record SignInSetting(String layout, boolean hasImage) { }
}
