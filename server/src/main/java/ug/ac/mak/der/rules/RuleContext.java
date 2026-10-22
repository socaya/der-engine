package ug.ac.mak.der.rules;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Read-only snapshot of the data a program-rule expression can see when it
 * runs inside DER's edge engine.
 *
 * <p>Assembled by {@link ug.ac.mak.der.rules.RuleEngine} per incoming event or
 * tracker payload; mutable only through the builder.</p>
 */
public final class RuleContext {

    /** Current event's data-element values keyed by {@code programStageUid.dataElementUid}. */
    private final Map<String, Object> currentEventValues;
    /** Enrollment's TEI attribute values keyed by attribute UID. */
    private final Map<String, Object> teiAttributes;
    /** Current rule-ASSIGN outputs (visible to subsequent rules in the same pass). */
    private final Map<String, Object> assignedValues;
    /** Previous events of the same program stage (chronological). */
    private final List<Map<String, Object>> previousEvents;
    /** Mirrored constants, keyed by constant UID. */
    private final Map<String, Object> constants;
    /** Environment variables, e.g. {@code current_date}, {@code enrollment_date}. */
    private final Map<String, Object> environment;
    /** {@link LocalDate#now()} snapshot taken when the context was built. */
    private final LocalDate currentDate;

    private RuleContext(final Builder b) {
        this.currentEventValues = Collections.unmodifiableMap(new LinkedHashMap<>(b.currentEventValues));
        this.teiAttributes = Collections.unmodifiableMap(new LinkedHashMap<>(b.teiAttributes));
        this.assignedValues = new LinkedHashMap<>(b.assignedValues);
        this.previousEvents = List.copyOf(b.previousEvents);
        this.constants = Collections.unmodifiableMap(new LinkedHashMap<>(b.constants));
        this.environment = Collections.unmodifiableMap(new LinkedHashMap<>(b.environment));
        this.currentDate = Objects.requireNonNull(b.currentDate, "currentDate");
    }

    public Map<String, Object> currentEventValues() {
        return currentEventValues;
    }

    public Map<String, Object> teiAttributes() {
        return teiAttributes;
    }

    /** Live map of ASSIGN outputs — the evaluator writes here. */
    public Map<String, Object> assignedValues() {
        return assignedValues;
    }

    public List<Map<String, Object>> previousEvents() {
        return previousEvents;
    }

    public Map<String, Object> constants() {
        return constants;
    }

    public Map<String, Object> environment() {
        return environment;
    }

    public LocalDate currentDate() {
        return currentDate;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private final Map<String, Object> currentEventValues = new LinkedHashMap<>();
        private final Map<String, Object> teiAttributes = new LinkedHashMap<>();
        private final Map<String, Object> assignedValues = new LinkedHashMap<>();
        private final List<Map<String, Object>> previousEvents = new java.util.ArrayList<>();
        private final Map<String, Object> constants = new LinkedHashMap<>();
        private final Map<String, Object> environment = new LinkedHashMap<>();
        private LocalDate currentDate = LocalDate.now();

        public Builder eventValue(final String compoundKey, final Object value) {
            currentEventValues.put(compoundKey, value);
            return this;
        }

        public Builder teiAttribute(final String uid, final Object value) {
            teiAttributes.put(uid, value);
            return this;
        }

        public Builder previousEvent(final Map<String, Object> values) {
            previousEvents.add(new LinkedHashMap<>(values));
            return this;
        }

        public Builder constant(final String uid, final Object value) {
            constants.put(uid, value);
            return this;
        }

        public Builder env(final String name, final Object value) {
            environment.put(name, value);
            return this;
        }

        public Builder currentDate(final LocalDate d) {
            this.currentDate = d;
            return this;
        }

        public RuleContext build() {
            return new RuleContext(this);
        }
    }
}
