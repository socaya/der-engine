package ug.ac.mak.der.analytics.engine;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Static capability manifest surfaced by {@code GET
 * /edge-api/v1/analytics/v1/capabilities}.
 *
 * <p>Mirrors the shape of {@code
 * docs/apps/analytics/DER_Analytics_Compatibility_and_Dataset_Manifest.json}
 * and is the single source of truth clients consult before enabling an
 * analytics feature (AN-FR-003 — versioned support matrix). Status
 * values:</p>
 *
 * <ul>
 *   <li>{@code REQUIRED_IMPLEMENTATION} — core engine feature DER
 *       always provides when deployed.</li>
 *   <li>{@code DER_EXTENDED} — DER value-add on top of the DHIS2
 *       base model (distinct-patient tally, drilldown, aggregate
 *       proposals).</li>
 *   <li>{@code VERSION_VERIFICATION_REQUIRED} — behaves like DHIS2
 *       in the common case but needs a target-version test before
 *       being advertised as safe.</li>
 *   <li>{@code UNSUPPORTED} — explicitly refused. The client should
 *       not expose the feature.</li>
 * </ul>
 */
public final class AnalyticsCapabilities {

    private AnalyticsCapabilities() { }

    /** Build the capability JSON as a plain map ready for serialisation. */
    public static Map<String, Object> manifest() {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("package", "DER Analytics engine v1");
        out.put("status", "PHASE_1_FOUNDATION");
        out.put("targetDhis2Versions", List.of("2.41", "2.42", "2.43", "2.44"));
        out.put("evaluationPolicy", "deny unsupported expressions by default");

        final List<Map<String, Object>> features = new java.util.ArrayList<>();
        features.add(feature("event_count", "REQUIRED_IMPLEMENTATION",
                "Count distinct events in a period / orgUnit.",
                "golden fixture + central comparison"));
        features.add(feature("enrollment_count", "REQUIRED_IMPLEMENTATION",
                "Count distinct enrollments in a period / orgUnit.",
                "golden fixture + central comparison"));
        features.add(feature("unique_patient_count", "DER_EXTENDED",
                "Distinct tracked entities producing at least one event "
              + "in the window.",
                "distinct/merge/parity within site"));
        features.add(feature("program_indicator_event",
                "VERSION_VERIFICATION_REQUIRED",
                "Event-type program indicators via compiled AST.",
                "expression parser / semantics"));
        features.add(feature("program_indicator_enrollment",
                "VERSION_VERIFICATION_REQUIRED",
                "Enrollment-type program indicators across stages.",
                "repeatable stage latest-event cases"));
        features.add(feature("period_types",
                "VERSION_VERIFICATION_REQUIRED",
                "Daily / Weekly (ISO) / Monthly / Quarterly / Yearly.",
                "native period id and boundary mapping"));
        features.add(feature("aggregate_proposal", "DER_EXTENDED",
                "Prefill DER Aggregate Capture cells (Phase 5+).",
                "metadata-cell mapping and approval"));
        features.add(feature("drilldown", "DER_EXTENDED",
                "Lineage queries from a cell to contributing records "
              + "(Phase 3+).",
                "permission and lineage audit"));
        out.put("capabilities", features);

        out.put("supportedPeriodTypes", List.of(
                "Daily", "Weekly", "Monthly", "Quarterly", "Yearly"));
        out.put("notes", List.of(
                "Fiscal-year variants are NOT auto-enabled; each needs "
              + "per-target DHIS2 verification (AN-FR-027).",
                "Phase 1 ships the foundation tables, period service, "
              + "capabilities + metrics + cell query surface. Phase 2 "
              + "wires the incremental materializer that writes "
              + "analytics_cell from the journal."));
        return out;
    }

    private static Map<String, Object> feature(final String id,
                                                 final String status,
                                                 final String description,
                                                 final String testing) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("feature", id);
        m.put("status", status);
        m.put("description", description);
        m.put("testing", testing);
        return m;
    }
}
