package ug.ac.mak.der.dhis2emulator;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2's {@code /api/dataSummary} is the Data Statistics screen's
 * backing endpoint: catalogue-level counts of every major metadata
 * object type + user-activity rollups. The Data Administration app
 * reads this on load; a 404 here surfaces as "unable to load
 * statistics" instead of a graceful empty-state.
 *
 * <p>DER emits real counts for the object types it mirrors (every
 * {@code der.metadata_*} table has an exact row count) + zeroed
 * placeholders for the user-activity + saved-objects rollups
 * (which are central-side telemetry we don't replicate). The
 * emitted shape matches DHIS2 central 2.4x so the Data Admin app
 * renders the counts under the expected labels.</p>
 *
 * <p>No authorisation gate beyond "signed in" — object counts
 * leak zero PII and are visible to any user with
 * {@code /api/me} access. Matches DHIS2 central's posture.</p>
 */
@RestController
@RequestMapping(path = "/api/dataSummary",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DataSummaryController {

    private final JdbcTemplate jdbc;

    public DataSummaryController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> summary(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("objectCounts", objectCounts());
        // User-activity + saved-objects + event-count rollups are
        // central-side telemetry; DER surfaces zeros so the app
        // renders the panels without crashing. The real pilot
        // signal comes from /admin/ops/journal/recent + /admin/
        // ops/worker-health (FR-15-03 surfaces).
        body.put("activeUsers", emptyBucketMap());
        body.put("userInvocations", emptyBucketMap());
        body.put("savedObjects", emptyBucketMap());
        body.put("eventCount", emptyBucketMap());
        body.put("dataValueCount", emptyBucketMap());
        final Map<String, Object> userAccounts = new LinkedHashMap<>();
        userAccounts.put("active", count("der.edge_user WHERE enabled = true"));
        userAccounts.put("disabled", count("der.edge_user WHERE enabled = false"));
        userAccounts.put("invitations", 0);
        userAccounts.put("twoFA", 0);
        userAccounts.put("expiring", 0);
        body.put("userAccounts", userAccounts);
        body.put("system", Map.of(
                "serverDate", Instant.now().toString(),
                "lastAnalyticsTableSuccess", ""));
        return ResponseEntity.ok(body);
    }

    private Map<String, Integer> objectCounts() {
        final Map<String, Integer> counts = new LinkedHashMap<>();
        // Keys match DHIS2 2.44's response shape — camelCase on
        // the resource name. Missing tables fall back to 0 so an
        // early-boot appliance with no mirror yet still renders.
        counts.put("dataElement", count("der.metadata_data_element"));
        counts.put("dataSet", count("der.metadata_data_set"));
        counts.put("organisationUnit", count("der.metadata_organisation_unit"));
        counts.put("program", count("der.metadata_program"));
        counts.put("programStage", count("der.metadata_program_stage"));
        counts.put("trackedEntityAttribute",
                count("der.metadata_tracked_entity_attribute"));
        counts.put("trackedEntityType",
                count("der.metadata_tracked_entity_type"));
        counts.put("programRule", count("der.metadata_program_rule"));
        counts.put("programRuleAction",
                count("der.metadata_program_rule_action"));
        counts.put("relationshipType", count("der.metadata_relationship_type"));
        counts.put("user", count("der.edge_user"));
        return counts;
    }

    private int count(final String fromClause) {
        try {
            final Integer n = jdbc.queryForObject(
                    "SELECT count(*) FROM " + fromClause, Integer.class);
            return n == null ? 0 : n;
        } catch (final RuntimeException ex) {
            // Missing table (pre-migration dev host) → 0; a 500
            // here would blank the whole Data Statistics screen.
            return 0;
        }
    }

    /**
     * DHIS2 central emits each activity rollup keyed on a day-
     * offset ("0" = today, "1" = yesterday, …) out to 365. The
     * Data Admin app tolerates any key set as long as the values
     * are numbers; an empty map renders as a flat zero-baseline
     * chart, which is the honest edge-side picture.
     */
    private static Map<String, Integer> emptyBucketMap() {
        return Map.of();
    }
}
