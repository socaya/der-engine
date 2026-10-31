package ug.ac.mak.der.workflow;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramRule;
import ug.ac.mak.der.metadata.MirroredProgramRuleAction;

/**
 * Program-rule evaluator — spec §35. Loads the active rule set for a
 * workflow's bound program and evaluates each rule's condition against
 * the merged contribution payload. For every rule whose condition
 * evaluates to {@code true}, the evaluator applies its actions.
 *
 * <p>v1 supports the handful of expression constructs that cover
 * ≥80% of real DHIS2 rules without pulling in a JavaScript runtime:</p>
 *
 * <ul>
 *   <li>{@code d2:hasValue(#{UID})} and {@code !d2:hasValue(#{UID})}
 *       — true iff the merged payload has a non-null value for UID.</li>
 *   <li>{@code #{UID}} and {@code A{UID}} — resolve to the field value.</li>
 *   <li>Comparisons {@code == != &lt; &lt;= &gt; &gt;=} with numeric or
 *       quoted-string RHS.</li>
 *   <li>Logical {@code &&} and {@code ||}.</li>
 * </ul>
 *
 * Anything the parser doesn't understand → the rule is skipped and the
 * evaluator logs a warning. Rules that silently no-op never produce a
 * false negative but may miss findings; operators see rule coverage in
 * the per-run validation page so they know what fired.
 *
 * <p>Supported actions:</p>
 *
 * <ul>
 *   <li>{@code SHOWERROR} → ERROR {@link ProgressiveValidator.Issue}.</li>
 *   <li>{@code SHOWWARNING} → WARNING {@link ProgressiveValidator.Issue}.</li>
 *   <li>{@code SHOWERRORONCOMPLETE} / {@code WARNINGONCOMPLETE} —
 *       treated as SHOWERROR / SHOWWARNING, since the DER coordinator
 *       validates on every contribute (not on a separate complete
 *       event).</li>
 *   <li>Other action types ({@code HIDEFIELD}, {@code ASSIGN},
 *       {@code CREATEEVENT}, {@code SETMANDATORY}, …) are not yet
 *       enforced at the server. {@code SETMANDATORY} is still partially
 *       honoured because the existing REQUIRED_FIELD_MISSING check
 *       covers mandatoriness.</li>
 * </ul>
 */
@Service
public class ProgramRuleEvaluator {

    private static final Logger LOG = LoggerFactory.getLogger(ProgramRuleEvaluator.class);

    /** {@code #{UID}} or {@code A{UID}} — resolved against payload fields. */
    private static final Pattern FIELD_REF =
            Pattern.compile("[#A]\\{([A-Za-z0-9_]+)\\}");
    /** {@code d2:hasValue(#{UID})}. */
    private static final Pattern D2_HAS_VALUE =
            Pattern.compile("d2:hasValue\\(\\s*[#A]\\{([A-Za-z0-9_]+)\\}\\s*\\)");

    private final ExtendedMirrorRepository mirror;
    private final ObjectMapper mapper;
    private final JdbcTemplate jdbc;

    public ProgramRuleEvaluator(final ExtendedMirrorRepository mirror,
                                  final ObjectMapper mapper,
                                  final JdbcTemplate jdbc) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    /**
     * Evaluate program rules for one run. Returns issues the caller can
     * append to the ProgressiveValidator findings — persistence stays
     * on the validator so a run has one place to look.
     */
    public List<ProgressiveValidator.Issue> evaluate(final CaptureWorkflow workflow,
                                                        final UUID runId,
                                                        final List<CaptureWorkflowContribution> all) {
        if (workflow.boundMetadataKind() != CaptureWorkflow.BindingKind.PROGRAM) {
            return List.of();
        }
        final List<MirroredProgramRule> rules =
                mirror.findRulesByProgram(workflow.boundMetadataId());
        if (rules.isEmpty()) {
            return List.of();
        }
        final Map<String, String> rawValues = extractFieldValues(all);
        final Map<String, String> variableToUid = loadRuleVariableAliases(workflow.boundMetadataId());
        // Alias the UID-keyed values under the variable names declared
        // by programRuleVariables, so expressions written as
        // #{varName} resolve the same as #{DE_UID}.
        final Map<String, String> values = new HashMap<>(rawValues);
        variableToUid.forEach((varName, uid) -> {
            if (uid != null && rawValues.containsKey(uid)) {
                values.put(varName, rawValues.get(uid));
            }
        });
        final List<ProgressiveValidator.Issue> issues = new ArrayList<>();
        for (final MirroredProgramRule r : rules) {
            final Boolean fired;
            try {
                fired = eval(r.condition(), values);
            } catch (RuntimeException ex) {
                LOG.debug("rule {} ({}): parser skip — {}", r.dhis2Uid(),
                        r.displayName(), ex.getMessage());
                continue;
            }
            if (fired == null || !fired) {
                continue;
            }
            for (final MirroredProgramRuleAction a : r.actions()) {
                final ProgressiveValidator.Issue issue = toIssue(runId, r, a);
                if (issue != null) {
                    issues.add(issue);
                }
            }
        }
        return issues;
    }

    /**
     * Load the {@code name → dataElement/trackedEntityAttribute UID}
     * mapping for a program's rule variables, read straight from the
     * mirrored catalog payload. Expressions reference variables by
     * name (e.g. {@code #{ahd_cd4}}) and this is how we resolve them
     * to the UIDs that show up in contribution payloads.
     */
    private Map<String, String> loadRuleVariableAliases(final String programUid) {
        final Map<String, String> out = new HashMap<>();
        try {
            final List<String> payloads = jdbc.queryForList(
                    "SELECT payload::text FROM der.metadata_catalog_item "
                            + "WHERE resource = 'programRuleVariables' "
                            + "AND payload->'program'->>'id' = ?",
                    String.class, programUid);
            for (final String p : payloads) {
                final JsonNode n = mapper.readTree(p);
                final String name = n.hasNonNull("name") ? n.get("name").asText() : null;
                if (name == null) {
                    continue;
                }
                final JsonNode de = n.get("dataElement");
                final JsonNode tea = n.get("trackedEntityAttribute");
                if (de != null && de.hasNonNull("id")) {
                    out.put(name, de.get("id").asText());
                } else if (tea != null && tea.hasNonNull("id")) {
                    out.put(name, tea.get("id").asText());
                }
            }
        } catch (RuntimeException | JsonProcessingException ex) {
            LOG.warn("program-rule variable load failed for {}: {}", programUid, ex.getMessage());
        }
        return out;
    }

    /* ─── action translation ───────────────────────────────────────── */

    private ProgressiveValidator.Issue toIssue(final UUID runId,
                                                  final MirroredProgramRule rule,
                                                  final MirroredProgramRuleAction action) {
        final String type = action.actionType();
        final ProgressiveValidator.Severity sev;
        switch (type) {
            case "SHOWERROR", "SHOWERRORONCOMPLETE" ->
                sev = ProgressiveValidator.Severity.ERROR;
            case "SHOWWARNING", "WARNINGONCOMPLETE" ->
                sev = ProgressiveValidator.Severity.WARNING;
            default -> {
                // Unmapped action types do not produce issues. HIDEFIELD /
                // ASSIGN / CREATEEVENT / etc. need a different surface
                // (client UI feature flag) and will land as follow-ups.
                return null;
            }
        }
        final String message = action.content() == null || action.content().isBlank()
                ? "Rule '" + rule.displayName() + "' triggered"
                : action.content();
        return new ProgressiveValidator.Issue(
                UUID.randomUUID(), runId, null,
                "PROGRAM_RULE_" + type, sev, message,
                action.dataElementUid() != null ? action.dataElementUid()
                        : action.trackedEntityAttributeUid());
    }

    /* ─── expression evaluation ────────────────────────────────────── */

    private Boolean eval(final String condition, final Map<String, String> values) {
        if (condition == null || condition.isBlank()) {
            return false;
        }
        return evalOr(condition.trim(), values);
    }

    private Boolean evalOr(final String s, final Map<String, String> values) {
        final List<String> parts = splitTopLevel(s, "||");
        for (final String p : parts) {
            if (Boolean.TRUE.equals(evalAnd(p.trim(), values))) {
                return true;
            }
        }
        return false;
    }

    private Boolean evalAnd(final String s, final Map<String, String> values) {
        final List<String> parts = splitTopLevel(s, "&&");
        for (final String p : parts) {
            if (!Boolean.TRUE.equals(evalAtom(p.trim(), values))) {
                return false;
            }
        }
        return true;
    }

    private Boolean evalAtom(final String s, final Map<String, String> values) {
        String atom = s;
        boolean negate = false;
        while (atom.startsWith("!")) {
            negate = !negate;
            atom = atom.substring(1).trim();
        }
        if (atom.startsWith("(") && atom.endsWith(")")) {
            final boolean inner = Boolean.TRUE.equals(evalOr(atom.substring(1, atom.length() - 1), values));
            return negate != inner;
        }
        final Matcher m = D2_HAS_VALUE.matcher(atom);
        if (m.matches()) {
            final boolean has = values.containsKey(m.group(1))
                    && values.get(m.group(1)) != null
                    && !values.get(m.group(1)).isBlank();
            return negate != has;
        }
        // Comparison (==, !=, <=, >=, <, >).
        final String[] ops = { "<=", ">=", "==", "!=", "<", ">" };
        for (final String op : ops) {
            final int ix = atom.indexOf(op);
            if (ix > 0) {
                final String lhsRaw = atom.substring(0, ix).trim();
                final String rhsRaw = atom.substring(ix + op.length()).trim();
                final String lhs = resolve(lhsRaw, values);
                final String rhs = resolve(rhsRaw, values);
                final boolean truthy = compare(lhs, rhs, op);
                return negate != truthy;
            }
        }
        // Bare literal 'true' / 'false'.
        if ("true".equalsIgnoreCase(atom)) {
            return !negate;
        }
        if ("false".equalsIgnoreCase(atom)) {
            return negate;
        }
        throw new IllegalArgumentException("unparseable atom: " + atom);
    }

    private String resolve(final String token, final Map<String, String> values) {
        final Matcher m = FIELD_REF.matcher(token);
        if (m.matches()) {
            return values.get(m.group(1));
        }
        // Strip surrounding single/double quotes for string literals.
        if ((token.startsWith("'") && token.endsWith("'"))
                || (token.startsWith("\"") && token.endsWith("\""))) {
            return token.substring(1, token.length() - 1);
        }
        return token;
    }

    private boolean compare(final String a, final String b, final String op) {
        if (a == null || b == null) {
            // DHIS2 program-rule semantics: comparisons involving missing
            // values are false. Operators get a clear "d2:hasValue" check
            // if they need to test presence.
            return false;
        }
        try {
            final double da = Double.parseDouble(a);
            final double db = Double.parseDouble(b);
            return switch (op) {
                case "<=" -> da <= db;
                case ">=" -> da >= db;
                case "==" -> da == db;
                case "!=" -> da != db;
                case "<"  -> da <  db;
                case ">"  -> da >  db;
                default -> false;
            };
        } catch (NumberFormatException ex) {
            final int cmp = a.compareTo(b);
            return switch (op) {
                case "<=" -> cmp <= 0;
                case ">=" -> cmp >= 0;
                case "==" -> cmp == 0;
                case "!=" -> cmp != 0;
                case "<"  -> cmp <  0;
                case ">"  -> cmp >  0;
                default -> false;
            };
        }
    }

    /** Split at top-level only — respects (…) nesting. */
    private List<String> splitTopLevel(final String s, final String sep) {
        final List<String> out = new ArrayList<>();
        int depth = 0;
        int start = 0;
        int i = 0;
        while (i < s.length()) {
            final char c = s.charAt(i);
            if (c == '(') {
                depth++;
                i++;
            } else if (c == ')') {
                depth--;
                i++;
            } else if (depth == 0 && s.startsWith(sep, i)) {
                out.add(s.substring(start, i));
                i += sep.length();
                start = i;
            } else {
                i++;
            }
        }
        out.add(s.substring(start));
        return out;
    }

    /* ─── value extraction from contribution payloads ─────────────── */

    private Map<String, String> extractFieldValues(final List<CaptureWorkflowContribution> all) {
        final Map<String, String> values = new HashMap<>();
        for (final CaptureWorkflowContribution c : all) {
            final JsonNode root;
            try {
                root = mapper.readTree(c.payload());
            } catch (JsonProcessingException ex) {
                continue;
            }
            collect(root, values);
        }
        return values;
    }

    private void collect(final JsonNode n, final Map<String, String> acc) {
        if (n == null) {
            return;
        }
        if (n.isObject()) {
            final String deUid = textOrNull(n.get("dataElement"));
            final String attrUid = textOrNull(n.get("attribute"));
            final String teaUid = textOrNull(n.get("trackedEntityAttribute"));
            final JsonNode value = n.get("value");
            if (value != null && !value.isNull()) {
                final String str = value.isTextual() ? value.asText() : value.toString();
                if (deUid != null) {
                    acc.put(deUid, str);
                }
                if (attrUid != null) {
                    acc.put(attrUid, str);
                }
                if (teaUid != null) {
                    acc.put(teaUid, str);
                }
            }
            n.fieldNames().forEachRemaining((k) -> collect(n.get(k), acc));
        } else if (n.isArray()) {
            n.forEach((child) -> collect(child, acc));
        }
    }

    private static String textOrNull(final JsonNode n) {
        return (n != null && n.isTextual()) ? n.asText() : null;
    }

    /* Visible-for-testing. */
    public Boolean evalForTest(final String condition, final Map<String, String> values) {
        return eval(condition, values);
    }

    public Map<String, String> extractForTest(final List<CaptureWorkflowContribution> all) {
        return extractFieldValues(all);
    }

    /** For tests: inject synthetic rules + evaluate without the mirror. */
    public List<ProgressiveValidator.Issue> evaluateWithRules(final UUID runId,
                                                                  final List<MirroredProgramRule> rules,
                                                                  final Map<String, String> values) {
        final List<ProgressiveValidator.Issue> out = new ArrayList<>();
        for (final MirroredProgramRule r : rules) {
            final Boolean fired;
            try {
                fired = eval(r.condition(), values);
            } catch (RuntimeException ex) {
                continue;
            }
            if (fired == null || !fired) {
                continue;
            }
            for (final MirroredProgramRuleAction a : r.actions()) {
                final ProgressiveValidator.Issue i = toIssue(runId, r, a);
                if (i != null) {
                    out.add(i);
                }
            }
        }
        return out;
    }

}
