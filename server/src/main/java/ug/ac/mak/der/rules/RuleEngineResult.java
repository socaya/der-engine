package ug.ac.mak.der.rules;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Outcome of running {@link RuleEngine#evaluate} on an incoming write.
 *
 * <ul>
 *   <li>{@link #assigned} — values computed by {@code ASSIGN} actions, keyed
 *       by the target data-element or attribute UID. Services apply these
 *       alongside the client-submitted values before persisting.</li>
 *   <li>{@link #errors} — {@code SHOWERROR} / {@code ERRORONCOMPLETE} /
 *       {@code SETMANDATORYFIELD} violations. Non-empty means the write
 *       must be rejected.</li>
 *   <li>{@link #warnings} — {@code SHOWWARNING} / {@code WARNINGONCOMPLETE}
 *       messages. Write continues.</li>
 * </ul>
 */
public record RuleEngineResult(
        Map<String, Object> assigned,
        List<RuleMessage> errors,
        List<RuleMessage> warnings
) {

    public RuleEngineResult {
        Objects.requireNonNull(assigned, "assigned");
        Objects.requireNonNull(errors, "errors");
        Objects.requireNonNull(warnings, "warnings");
        assigned = Collections.unmodifiableMap(new LinkedHashMap<>(assigned));
        errors = Collections.unmodifiableList(new ArrayList<>(errors));
        warnings = Collections.unmodifiableList(new ArrayList<>(warnings));
    }

    public boolean rejected() {
        return !errors.isEmpty();
    }

    public record RuleMessage(String ruleUid, String target, String message) { }
}
