package ug.ac.mak.der.analytics.expression;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

/**
 * Runtime facts an expression evaluator needs to resolve references.
 *
 * <p>Implementations plug the evaluator into the DER data model — a
 * single-event evaluation reads {@link #dataElement}, {@link
 * #attribute} and {@link #variable} against one event + its parent
 * enrollment + tracked entity. The evaluator never touches JDBC —
 * the context is expected to be pre-loaded so evaluation stays
 * deterministic and fast.</p>
 *
 * <p>Any reference whose value isn't known returns {@link
 * Optional#empty()}; the evaluator propagates that as {@code null}
 * so expressions like {@code d2:hasValue(#{foo})} can distinguish
 * "no value" from "zero".</p>
 */
public interface ExpressionContext {

    /** Return the value of a data element reference. {@code stageUid}
     *  is null for event-type program indicators that don't qualify
     *  the DE with a stage. */
    Optional<Object> dataElement(String stageUid, String dataElementUid);

    /** Tracked entity attribute by UID. */
    Optional<Object> attribute(String attributeUid);

    /** Pre-defined variable ({@code event_date}, {@code enrollment_date},
     *  {@code current_date}, {@code org_unit_count}, …). */
    Optional<Object> variable(String name);

    /** Numeric constant metadata. */
    Optional<Object> constant(String uid);

    /** Convenience builder for tests + single-event evaluation —
     *  callers assemble four maps and a date and get back a
     *  deterministic read-only context. */
    static ExpressionContext of(
            final Map<String, Object> dataElements,
            final Map<String, Object> attributes,
            final Map<String, Object> variables,
            final Map<String, Object> constants) {
        return new ExpressionContext() {
            @Override
            public Optional<Object> dataElement(final String stage,
                                                  final String de) {
                if (de == null) {
                    return Optional.empty();
                }
                if (stage != null && !stage.isBlank()) {
                    final Object v = dataElements.get(stage + "." + de);
                    if (v != null) {
                        return Optional.of(v);
                    }
                }
                // Fall back to the bare DE uid so single-stage
                // programs work without stage-qualifying every ref.
                return Optional.ofNullable(dataElements.get(de));
            }
            @Override
            public Optional<Object> attribute(final String uid) {
                return uid == null
                        ? Optional.empty()
                        : Optional.ofNullable(attributes.get(uid));
            }
            @Override
            public Optional<Object> variable(final String name) {
                return name == null
                        ? Optional.empty()
                        : Optional.ofNullable(variables.get(name));
            }
            @Override
            public Optional<Object> constant(final String uid) {
                return uid == null
                        ? Optional.empty()
                        : Optional.ofNullable(constants.get(uid));
            }
        };
    }

    /** Convenience — expose a LocalDate for V{current_date} style
     *  variables without the caller stringifying first. Returns null
     *  if the context doesn't have one. */
    static LocalDate asDate(final Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof LocalDate ld) {
            return ld;
        }
        if (v instanceof CharSequence s) {
            try {
                return LocalDate.parse(s.toString());
            } catch (java.time.format.DateTimeParseException ex) {
                return null;
            }
        }
        return null;
    }
}
