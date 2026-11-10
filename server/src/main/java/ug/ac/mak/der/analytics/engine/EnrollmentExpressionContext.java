package ug.ac.mak.der.analytics.engine;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ug.ac.mak.der.analytics.expression.ExpressionContext;

/**
 * Multi-event {@link ExpressionContext} for ENROLLMENT-type program
 * indicators.
 *
 * <p>Spec §6.2 — "enrollment analytics may reference events across
 * stages, and a repeatable stage can have special latest-event
 * semantics." For {@code #{stage.de}} this resolver returns the
 * value from the single latest event of that stage (newest
 * {@code occurredDate}, then newest {@code updatedAt} as a tiebreak).
 * Unqualified {@code #{de}} falls back to the latest event across
 * every stage carrying that DE.</p>
 *
 * <p>Variables surfaced for enrollment grain:</p>
 * <ul>
 *   <li>{@code V{enrollment_date}} — enrollment start.</li>
 *   <li>{@code V{incident_date}} — incident date if recorded.</li>
 *   <li>{@code V{enrollment_status}} — ACTIVE / COMPLETED / CANCELLED.</li>
 *   <li>{@code V{org_unit_uid}} — enrollment orgUnit.</li>
 *   <li>{@code V{program_uid}} — bound program.</li>
 *   <li>{@code V{tei_uid}} — tracked entity.</li>
 *   <li>{@code V{event_count}} — total events under this enrollment.</li>
 *   <li>{@code V{current_date}} — today's local date.</li>
 * </ul>
 *
 * <p>Attribute references ({@code A{teaUid}}) still return empty
 * — TEA joins land in Phase 4e; the context is constructed without
 * requiring the TEI row so the evaluator can at least handle every
 * expression that doesn't depend on attributes today.</p>
 */
public final class EnrollmentExpressionContext {

    private EnrollmentExpressionContext() { }

    /** One event summary the context pulls data from. */
    public record EventRow(
            String eventUid,
            String programStageUid,
            LocalDate occurredDate,
            String updatedAtKey,
            String status,
            String dataValuesJson) {

        public EventRow {
            Objects.requireNonNull(eventUid, "eventUid");
            Objects.requireNonNull(programStageUid, "programStageUid");
        }
    }

    /** Enrollment summary — minimum the context needs. */
    public record Enrollment(
            String enrollmentUid,
            String programUid,
            String teiUid,
            String orgUnitUid,
            LocalDate enrollmentDate,
            LocalDate incidentDate,
            String status) {

        public Enrollment {
            Objects.requireNonNull(enrollmentUid, "enrollmentUid");
        }
    }

    /** Build a context from one enrollment + its event rows. No
     *  tracked-entity attributes supplied — {@code A{uid}} returns
     *  empty. Retained for Phase-4d call sites + tests. */
    public static ExpressionContext of(final ObjectMapper mapper,
                                         final Enrollment enrollment,
                                         final List<EventRow> events) {
        return of(mapper, enrollment, events, Map.of());
    }

    /** Phase 4e — full form. {@code attributes} is the parsed TEA
     *  map from {@code der.tracked_entity.attributes} (JSONB):
     *  {@code teaUid → value}. {@code A{teaUid}} resolves against
     *  this map; unknowns stay null-safe. */
    public static ExpressionContext of(final ObjectMapper mapper,
                                         final Enrollment enrollment,
                                         final List<EventRow> events,
                                         final Map<String, Object> attributes) {
        Objects.requireNonNull(mapper, "mapper");
        Objects.requireNonNull(enrollment, "enrollment");
        final List<EventRow> sorted = new ArrayList<>(
                events == null ? List.of() : events);
        sorted.sort(Comparator
                .comparing(EventRow::occurredDate,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(EventRow::updatedAtKey,
                        Comparator.nullsLast(Comparator.reverseOrder())));
        // Pre-parse each event's data_values JSON once.
        final List<Map<String, Object>> parsed =
                new ArrayList<>(sorted.size());
        for (final EventRow r : sorted) {
            parsed.add(parseDataValues(mapper, r.dataValuesJson()));
        }

        final Map<String, Object> vars = buildVariables(enrollment,
                sorted.size());

        return new ExpressionContext() {
            @Override
            public Optional<Object> dataElement(final String stage,
                                                  final String de) {
                if (de == null) {
                    return Optional.empty();
                }
                for (int i = 0; i < sorted.size(); i++) {
                    final EventRow r = sorted.get(i);
                    if (stage != null && !stage.isBlank()
                            && !stage.equals(r.programStageUid())) {
                        continue;
                    }
                    final Object v = parsed.get(i).get(de);
                    if (v != null) {
                        return Optional.of(v);
                    }
                }
                return Optional.empty();
            }

            @Override
            public Optional<Object> attribute(final String uid) {
                if (uid == null || attributes == null) {
                    return Optional.empty();
                }
                return Optional.ofNullable(attributes.get(uid));
            }

            @Override
            public Optional<Object> variable(final String name) {
                return name == null
                        ? Optional.empty()
                        : Optional.ofNullable(vars.get(name));
            }

            @Override
            public Optional<Object> constant(final String uid) {
                return Optional.empty();
            }
        };
    }

    private static Map<String, Object> buildVariables(
            final Enrollment e, final int eventCount) {
        final Map<String, Object> m = new LinkedHashMap<>();
        if (e.enrollmentDate() != null) {
            m.put("enrollment_date", e.enrollmentDate());
        }
        if (e.incidentDate() != null) {
            m.put("incident_date", e.incidentDate());
        }
        if (e.status() != null) {
            m.put("enrollment_status", e.status());
        }
        if (e.orgUnitUid() != null) {
            m.put("org_unit_uid", e.orgUnitUid());
        }
        if (e.programUid() != null) {
            m.put("program_uid", e.programUid());
        }
        if (e.teiUid() != null) {
            m.put("tei_uid", e.teiUid());
        }
        m.put("event_count", java.math.BigDecimal.valueOf(eventCount));
        m.put("current_date", LocalDate.now());
        return m;
    }

    /** Parse a {@code der.tracked_entity.attributes} JSONB blob into
     *  a {@code teaUid → value} map with typed coercion matching the
     *  event data_values parser. */
    public static Map<String, Object> parseAttributes(
            final ObjectMapper mapper, final String raw) {
        return parseDataValues(mapper, raw);
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
}
