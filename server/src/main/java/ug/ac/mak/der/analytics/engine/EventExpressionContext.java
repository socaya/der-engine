package ug.ac.mak.der.analytics.engine;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ug.ac.mak.der.analytics.expression.ExpressionContext;

/**
 * Factory + glue that turns one row from
 * {@code der.edge_tracker_event} into a read-only
 * {@link ExpressionContext} the evaluator can operate on.
 *
 * <p>Spec §6.1 "metric definition schema" — a context resolves
 * {@code #{deUid}}, {@code #{stageUid.deUid}} and the small set of
 * V{…} variables the Phase-3 evaluator needs. Enrollment-level
 * attributes (A{…}) and cross-event cohort vars land in Phase 4;
 * Phase 3c keeps the grain at exactly one event.</p>
 *
 * <p>Variable vocabulary surfaced today — all that single-event
 * evaluation needs:</p>
 * <ul>
 *   <li>{@code V{event_date}} — {@code LocalDate} of the event.</li>
 *   <li>{@code V{occurredDate}} — alias for event_date.</li>
 *   <li>{@code V{event_status}} — the DHIS2 event status string.</li>
 *   <li>{@code V{org_unit_uid}} — the event's orgUnit UID.</li>
 *   <li>{@code V{current_date}} — today's local date at build time.</li>
 *   <li>{@code V{program_stage}} — program stage UID.</li>
 * </ul>
 */
public final class EventExpressionContext {

    private EventExpressionContext() { }

    /** Build a context from one event row. {@code dataValuesJson} is
     *  the raw {@code data_values} JSON blob from the edge_tracker_event
     *  table; keys are data element UIDs, values can be strings /
     *  numbers / booleans / null. */
    public static ExpressionContext of(final ObjectMapper mapper,
                                         final String stageUid,
                                         final String dataValuesJson,
                                         final LocalDate occurredDate,
                                         final String orgUnitUid,
                                         final String status) {
        final Map<String, Object> de = parseDataValues(mapper, dataValuesJson);
        final Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("event_date", occurredDate);
        vars.put("occurredDate", occurredDate);
        vars.put("event_status", status);
        vars.put("org_unit_uid", orgUnitUid);
        vars.put("current_date", LocalDate.now());
        if (stageUid != null) {
            vars.put("program_stage", stageUid);
        }
        return ExpressionContext.of(de, Map.of(), vars, Map.of());
    }

    /** Overload for tests + drilldown that already have the parsed
     *  data-values map. */
    public static ExpressionContext of(final String stageUid,
                                         final Map<String, Object> dataValues,
                                         final LocalDate occurredDate,
                                         final String orgUnitUid,
                                         final String status) {
        final Map<String, Object> vars = new LinkedHashMap<>();
        vars.put("event_date", occurredDate);
        vars.put("occurredDate", occurredDate);
        vars.put("event_status", status);
        vars.put("org_unit_uid", orgUnitUid);
        vars.put("current_date", LocalDate.now());
        if (stageUid != null) {
            vars.put("program_stage", stageUid);
        }
        return ExpressionContext.of(dataValues == null ? Map.of()
                : dataValues, Map.of(), vars, Map.of());
    }

    private static Map<String, Object> parseDataValues(
            final ObjectMapper mapper, final String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            final JsonNode root = mapper.readTree(raw);
            if (!root.isObject()) {
                return Map.of();
            }
            final Map<String, Object> out = new LinkedHashMap<>();
            root.fields().forEachRemaining(e -> {
                final JsonNode v = e.getValue();
                out.put(e.getKey(), nodeValue(v));
            });
            return out;
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private static Object nodeValue(final JsonNode v) {
        if (v == null || v.isNull()) {
            return null;
        }
        if (v.isNumber()) {
            return v.decimalValue();
        }
        if (v.isBoolean()) {
            return v.booleanValue();
        }
        return v.asText();
    }

    /** Resolve a reference in an already-built context — thin
     *  wrapper that nulls out missing keys instead of the Optional
     *  dance, useful for ingestion loops that only care about the
     *  effective value. */
    public static Object resolve(final ExpressionContext ctx,
                                   final String key) {
        Objects.requireNonNull(ctx, "ctx");
        final Optional<Object> v = ctx.variable(key);
        return v.orElse(null);
    }
}
