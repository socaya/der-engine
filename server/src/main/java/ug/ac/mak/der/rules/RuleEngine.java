package ug.ac.mak.der.rules;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramRule;
import ug.ac.mak.der.metadata.MirroredProgramRuleAction;

/**
 * DER's edge program-rule engine. See ADR-0007 §Decision.
 *
 * <p>For each incoming event or tracker payload, the service calls
 * {@link #evaluate} once with the assembled {@link RuleContext} and the
 * program UID; the engine loads the program's rules from the mirror in
 * priority DESC order and executes server-impacting actions. ASSIGN outputs
 * are visible to subsequent rules (DHIS2 behaviour).</p>
 */
@Component
public class RuleEngine {

    private static final Logger LOG = LoggerFactory.getLogger(RuleEngine.class);

    static final String ACTION_ASSIGN = "ASSIGN";
    static final String ACTION_SHOWERROR = "SHOWERROR";
    static final String ACTION_SHOWWARNING = "SHOWWARNING";
    static final String ACTION_WARN_COMPLETE = "WARNINGONCOMPLETE";
    static final String ACTION_ERROR_COMPLETE = "ERRORONCOMPLETE";
    static final String ACTION_SET_MANDATORY = "SETMANDATORYFIELD";

    private final ExtendedMirrorRepository mirror;
    private final boolean enabled;
    private final boolean strict;

    public RuleEngine(final ExtendedMirrorRepository mirror,
                      @Value("${der.rules.enabled:true}") final boolean enabled,
                      @Value("${der.rules.strict:true}") final boolean strict) {
        this.mirror = Objects.requireNonNull(mirror, "mirror");
        this.enabled = enabled;
        this.strict = strict;
    }

    /**
     * Evaluate every rule attached to {@code programUid} against {@code ctx}.
     *
     * @param programUid  the DHIS2 program the write targets
     * @param ctx         live context (ASSIGN outputs are written to its
     *                    {@link RuleContext#assignedValues()} map)
     * @param completing  {@code true} if the event is being transitioned to
     *                    {@code COMPLETED} status in this write
     * @param submittedFields the data-element / attribute UIDs the client sent
     *                        (used by {@code SETMANDATORYFIELD})
     */
    public RuleEngineResult evaluate(final String programUid,
                                     final RuleContext ctx,
                                     final boolean completing,
                                     final List<String> submittedFields) {
        if (!enabled) {
            LOG.debug("rule engine disabled; skipping evaluation for program {}", programUid);
            return new RuleEngineResult(Map.of(), List.of(), List.of());
        }
        final List<MirroredProgramRule> rules = mirror.findRulesByProgram(programUid);
        final Map<String, Object> assigned = new LinkedHashMap<>();
        final List<RuleEngineResult.RuleMessage> errors = new ArrayList<>();
        final List<RuleEngineResult.RuleMessage> warnings = new ArrayList<>();
        final RuleExpressionEvaluator evaluator = new RuleExpressionEvaluator(ctx);
        for (final MirroredProgramRule rule : rules) {
            boolean fires;
            try {
                final RuleAst cond = new RuleParser(rule.condition()).parse();
                fires = truthy(evaluator.evaluate(cond));
            } catch (RuleParseException ex) {
                if (strict) {
                    throw ex;
                }
                LOG.warn("skipping rule {} ({}): condition failed to parse: {}",
                        rule.dhis2Uid(), rule.displayName(), ex.getMessage());
                continue;
            }
            if (!fires) {
                continue;
            }
            for (final MirroredProgramRuleAction action : rule.actions()) {
                applyAction(rule, action, evaluator, assigned, errors, warnings,
                        completing, submittedFields, ctx);
            }
        }
        return new RuleEngineResult(assigned, errors, warnings);
    }

    private void applyAction(final MirroredProgramRule rule,
                              final MirroredProgramRuleAction action,
                              final RuleExpressionEvaluator evaluator,
                              final Map<String, Object> assigned,
                              final List<RuleEngineResult.RuleMessage> errors,
                              final List<RuleEngineResult.RuleMessage> warnings,
                              final boolean completing,
                              final List<String> submittedFields,
                              final RuleContext ctx) {
        final String target = action.dataElementUid() != null
                ? action.dataElementUid() : action.trackedEntityAttributeUid();
        switch (action.actionType()) {
            case ACTION_ASSIGN -> {
                if (action.dataExpression() == null || target == null) {
                    return;
                }
                try {
                    final Object v = evaluator.evaluate(new RuleParser(action.dataExpression()).parse());
                    assigned.put(target, v);
                    ctx.assignedValues().put(target, v);
                } catch (RuleParseException ex) {
                    if (strict) {
                        throw ex;
                    }
                    LOG.warn("skipping ASSIGN in rule {}: {}", rule.dhis2Uid(), ex.getMessage());
                }
            }
            case ACTION_SHOWERROR -> errors.add(new RuleEngineResult.RuleMessage(
                    rule.dhis2Uid(), target, nonBlank(action.content(), rule.displayName())));
            case ACTION_SHOWWARNING -> warnings.add(new RuleEngineResult.RuleMessage(
                    rule.dhis2Uid(), target, nonBlank(action.content(), rule.displayName())));
            case ACTION_ERROR_COMPLETE -> {
                if (completing) {
                    errors.add(new RuleEngineResult.RuleMessage(
                            rule.dhis2Uid(), target, nonBlank(action.content(), rule.displayName())));
                }
            }
            case ACTION_WARN_COMPLETE -> {
                if (completing) {
                    warnings.add(new RuleEngineResult.RuleMessage(
                            rule.dhis2Uid(), target, nonBlank(action.content(), rule.displayName())));
                }
            }
            case ACTION_SET_MANDATORY -> {
                if (target != null && (submittedFields == null || !submittedFields.contains(target))) {
                    errors.add(new RuleEngineResult.RuleMessage(
                            rule.dhis2Uid(), target,
                            "required field not supplied for rule '" + rule.displayName() + "'"));
                }
            }
            default -> LOG.debug("action {} is UI-only; skipping (rule {})",
                    action.actionType(), rule.dhis2Uid());
        }
    }

    private static boolean truthy(final Object v) {
        if (v instanceof Boolean b) {
            return b;
        }
        if (v instanceof Number n) {
            return n.doubleValue() != 0;
        }
        if (v instanceof String s) {
            return !s.isEmpty();
        }
        return v != null;
    }

    private static String nonBlank(final String a, final String b) {
        return a != null && !a.isBlank() ? a : b;
    }
}
