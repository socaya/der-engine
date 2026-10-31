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
 *   <li>{@code SETMANDATORYFIELD} — once the rule's condition fires,
 *       the targeted field must be present in the merged payload or we
 *       emit a {@code PROGRAM_RULE_SETMANDATORYFIELD} ERROR. Bridges
 *       §35 into §36.</li>
 *   <li>Other action types ({@code HIDEFIELD}, {@code ASSIGN},
 *       {@code CREATEEVENT}, {@code HIDESECTION}, …) are not yet
 *       enforced at the server; they will land as a follow-up once a
 *       client-side surface exists to hide/assign fields.</li>
 * </ul>
 */
@Service
public class ProgramRuleEvaluator {

    private static final Logger LOG = LoggerFactory.getLogger(ProgramRuleEvaluator.class);

    /** {@code #{UID}} or {@code A{UID}} — resolved against payload fields. */
    private static final Pattern FIELD_REF =
            Pattern.compile("[#A]\\{([A-Za-z0-9_]+)\\}");
    /** {@code V{context_var}} — runtime context (today, current_date, …). */
    private static final Pattern CONTEXT_VAR =
            Pattern.compile("V\\{([A-Za-z0-9_]+)\\}");
    /** {@code d2:hasValue(#{UID})}. */
    private static final Pattern D2_HAS_VALUE =
            Pattern.compile("d2:hasValue\\(\\s*[#A]\\{([A-Za-z0-9_]+)\\}\\s*\\)");
    /** Generic {@code d2:fnName(args)} for the function library. */
    private static final Pattern D2_FN =
            Pattern.compile("d2:([a-zA-Z]+)\\((.*)\\)");

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
                final ProgressiveValidator.Issue issue = toIssue(runId, r, a, values);
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
                                                  final MirroredProgramRuleAction action,
                                                  final Map<String, String> values) {
        final String type = action.actionType();
        return switch (type) {
            case "SHOWERROR", "SHOWERRORONCOMPLETE" ->
                textIssue(runId, rule, action, ProgressiveValidator.Severity.ERROR);
            case "SHOWWARNING", "WARNINGONCOMPLETE" ->
                textIssue(runId, rule, action, ProgressiveValidator.Severity.WARNING);
            case "SETMANDATORYFIELD" ->
                mandatoryIssue(runId, rule, action, values);
            // HIDEFIELD / ASSIGN / CREATEEVENT / HIDESECTION / etc. need a
            // client-side surface and will land as follow-ups.
            default -> null;
        };
    }

    private ProgressiveValidator.Issue textIssue(final UUID runId,
                                                    final MirroredProgramRule rule,
                                                    final MirroredProgramRuleAction action,
                                                    final ProgressiveValidator.Severity sev) {
        final String message = action.content() == null || action.content().isBlank()
                ? "Rule '" + rule.displayName() + "' triggered"
                : action.content();
        return new ProgressiveValidator.Issue(
                UUID.randomUUID(), runId, null,
                "PROGRAM_RULE_" + action.actionType(), sev, message,
                action.dataElementUid() != null ? action.dataElementUid()
                        : action.trackedEntityAttributeUid());
    }

    /**
     * SETMANDATORYFIELD bridges §35 → §36: once the rule's condition
     * fires, the targeted field must be present in the merged payload
     * or we emit a {@code PROGRAM_RULE_SETMANDATORYFIELD} ERROR issue
     * that gates completion. If the field is already present → no issue.
     */
    private ProgressiveValidator.Issue mandatoryIssue(final UUID runId,
                                                        final MirroredProgramRule rule,
                                                        final MirroredProgramRuleAction action,
                                                        final Map<String, String> values) {
        final String targetUid = action.dataElementUid() != null
                ? action.dataElementUid()
                : action.trackedEntityAttributeUid();
        if (targetUid == null) {
            return null;
        }
        final String current = values.get(targetUid);
        if (current != null && !current.isBlank()) {
            return null; // already captured — nothing to flag
        }
        final String message = "Field '" + targetUid
                + "' is mandatory under rule '" + rule.displayName()
                + "' — please provide a value.";
        return new ProgressiveValidator.Issue(
                UUID.randomUUID(), runId, null,
                "PROGRAM_RULE_SETMANDATORYFIELD",
                ProgressiveValidator.Severity.ERROR,
                message, targetUid);
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
        final Matcher ctx = CONTEXT_VAR.matcher(token);
        if (ctx.matches()) {
            return resolveContext(ctx.group(1));
        }
        final Matcher fn = D2_FN.matcher(token);
        if (fn.matches()) {
            return callD2(fn.group(1), fn.group(2), values);
        }
        // Strip surrounding single/double quotes for string literals.
        if ((token.startsWith("'") && token.endsWith("'"))
                || (token.startsWith("\"") && token.endsWith("\""))) {
            return token.substring(1, token.length() - 1);
        }
        return token;
    }

    /** Context variables — {@code V{current_date}} is today in {@code
     *  yyyy-MM-dd}. The others we don't know in the DER merge model
     *  (no event date / enrollment date per contribution) → null. */
    private String resolveContext(final String name) {
        return switch (name) {
            case "current_date", "today" ->
                java.time.LocalDate.now().toString();
            default -> null;
        };
    }

    /** {@code d2:*} function library. Returns the function's string
     *  value, or null if the function/args don't resolve. */
    private String callD2(final String fn, final String argStr,
                            final Map<String, String> values) {
        final List<String> args = splitArgs(argStr).stream()
                .map((a) -> resolve(a.trim(), values))
                .toList();
        try {
            return switch (fn) {
                case "daysBetween"  -> dateDiff(args, java.time.temporal.ChronoUnit.DAYS);
                case "weeksBetween" -> dateDiff(args, java.time.temporal.ChronoUnit.WEEKS);
                case "monthsBetween" -> dateDiff(args, java.time.temporal.ChronoUnit.MONTHS);
                case "yearsBetween" -> dateDiff(args, java.time.temporal.ChronoUnit.YEARS);
                case "length"       -> String.valueOf(args.get(0) == null ? 0 : args.get(0).length());
                case "left"         -> substring(args, true);
                case "right"        -> substring(args, false);
                case "floor"        -> fmt(Math.floor(num(args.get(0))));
                case "ceil"         -> fmt(Math.ceil(num(args.get(0))));
                case "round"        -> fmt((double) Math.round(num(args.get(0))));
                case "modulus"      -> fmt(num(args.get(0)) % num(args.get(1)));
                case "zing"         -> fmt(Math.max(0, num(args.get(0))));
                case "oizp"         -> num(args.get(0)) > 0 ? "1" : "0";
                case "count"        -> values.containsKey(stripBraces(argStr.trim())) ? "1" : "0";
                case "zpvc"         -> fmt(args.stream().filter(a -> a != null && !a.isBlank())
                                              .count());
                case "concatenate"  -> String.join("", args.stream()
                                              .map(a -> a == null ? "" : a).toList());
                case "lastEventDate" -> null; // not meaningful in DER merge model
                default -> null;
            };
        } catch (RuntimeException ex) {
            LOG.debug("d2:{}({}) failed: {}", fn, argStr, ex.getMessage());
            return null;
        }
    }

    private List<String> splitArgs(final String s) {
        final List<String> out = new ArrayList<>();
        int depth = 0;
        int start = 0;
        boolean inStr = false;
        char strCh = 0;
        for (int i = 0; i < s.length(); i++) {
            final char c = s.charAt(i);
            if (inStr) {
                if (c == strCh) {
                    inStr = false;
                }
                continue;
            }
            if (c == '\'' || c == '"') {
                inStr = true;
                strCh = c;
            } else if (c == '(') {
                depth++;
            } else if (c == ')') {
                depth--;
            } else if (c == ',' && depth == 0) {
                out.add(s.substring(start, i));
                start = i + 1;
            }
        }
        out.add(s.substring(start));
        return out;
    }

    private String dateDiff(final List<String> args, final java.time.temporal.ChronoUnit unit) {
        if (args.size() < 2 || args.get(0) == null || args.get(1) == null) {
            return null;
        }
        final java.time.LocalDate a = parseDate(args.get(0));
        final java.time.LocalDate b = parseDate(args.get(1));
        if (a == null || b == null) {
            return null;
        }
        return String.valueOf(unit.between(a, b));
    }

    private java.time.LocalDate parseDate(final String s) {
        try {
            // DHIS2 program-rule date values are usually yyyy-MM-dd;
            // tolerate full ISO instants by stripping to the first 10 chars.
            final String base = s.length() >= 10 ? s.substring(0, 10) : s;
            return java.time.LocalDate.parse(base);
        } catch (java.time.format.DateTimeParseException ex) {
            return null;
        }
    }

    private String substring(final List<String> args, final boolean fromLeft) {
        if (args.size() < 2 || args.get(0) == null) {
            return null;
        }
        final int n = (int) num(args.get(1));
        final String src = args.get(0);
        final int len = Math.min(n, src.length());
        return fromLeft ? src.substring(0, len) : src.substring(src.length() - len);
    }

    private double num(final String s) {
        return s == null || s.isBlank() ? 0.0 : Double.parseDouble(s);
    }

    private String fmt(final double d) {
        if (d == Math.floor(d) && !Double.isInfinite(d)) {
            return String.valueOf((long) d);
        }
        return String.valueOf(d);
    }

    private String stripBraces(final String s) {
        final Matcher m = FIELD_REF.matcher(s);
        return m.matches() ? m.group(1) : s;
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
                final ProgressiveValidator.Issue i = toIssue(runId, r, a, values);
                if (i != null) {
                    out.add(i);
                }
            }
        }
        return out;
    }

}
