package ug.ac.mak.der.workflow;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Progressive validator — spec §36. Runs after every contribution to a
 * workflow run and persists issues to {@code workflow_validation_issue}
 * so operators see them inline on the queue + run detail.
 *
 * The validator is idempotent: each pass deletes the run's existing
 * issue rows and re-inserts the current findings. Issues that have been
 * fixed by subsequent contributions disappear automatically.
 *
 * Rule set (v1):
 *
 * <ul>
 *   <li>{@code REQUIRED_FIELD_MISSING} — a step declares a field with
 *       {@link CaptureWorkflowField.Requirement#REQUIRED} but the
 *       contribution's payload does not carry that field reference.</li>
 *   <li>{@code DUPLICATE_CONTRIBUTION} — the same step has been
 *       contributed more than once. The coordinator upserts so only
 *       the latest wins; the issue flags that an earlier contribution
 *       was superseded.</li>
 *   <li>{@code EMPTY_PAYLOAD} — the contribution payload is a JSON
 *       object with no data value, event, or attribute keys.</li>
 * </ul>
 *
 * Future rules (program-rule evaluation, value-type coercion, period
 * compatibility) plug in as additional methods on this service.
 */
@Service
public class ProgressiveValidator {

    private static final Logger LOG = LoggerFactory.getLogger(ProgressiveValidator.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ProgramRuleEvaluator programRules;

    public ProgressiveValidator(final JdbcTemplate jdbc, final ObjectMapper mapper,
                                 final ProgramRuleEvaluator programRules) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.programRules = Objects.requireNonNull(programRules, "programRules");
    }

    /** Issue surface returned by {@link #findForRun(UUID)} + persisted
     *  in {@code workflow_validation_issue}. {@code suggestedValue}
     *  is populated for ASSIGN-style issues; {@code null} for the rest. */
    public record Issue(UUID issueId, UUID runId, UUID stepId,
                        String code, Severity severity, String message,
                        String fieldRef, String suggestedValue) {
        /** Overload used by the HIDEFIELD / SHOWERROR / etc. paths that
         *  don't produce a suggested value. */
        public Issue(final UUID issueId, final UUID runId, final UUID stepId,
                      final String code, final Severity severity,
                      final String message, final String fieldRef) {
            this(issueId, runId, stepId, code, severity, message, fieldRef, null);
        }
    }

    public enum Severity { ERROR, WARNING, INFO }

    /** Recompute + persist issues for a run. Call from the coordinator
     *  after each contribution. */
    @Transactional
    public List<Issue> validateRun(final CaptureWorkflow workflow,
                                     final UUID runId,
                                     final List<CaptureWorkflowContribution> contributions) {
        final List<Issue> issues = new ArrayList<>();

        // DUPLICATE_CONTRIBUTION — same stepId appearing more than once.
        final Map<UUID, Integer> perStep = new HashMap<>();
        for (final CaptureWorkflowContribution c : contributions) {
            perStep.merge(c.stepId(), 1, Integer::sum);
        }
        perStep.forEach((stepId, count) -> {
            if (count > 1) {
                final CaptureWorkflowStep step = findStep(workflow, stepId);
                issues.add(new Issue(
                        UUID.randomUUID(), runId, stepId,
                        "DUPLICATE_CONTRIBUTION", Severity.WARNING,
                        "Step '" + (step == null ? stepId : step.displayName())
                                + "' has been contributed " + count
                                + " times. The latest version wins; earlier ones are superseded.",
                        null));
            }
        });

        // Per-contribution rules.
        for (final CaptureWorkflowContribution c : contributions) {
            final CaptureWorkflowStep step = findStep(workflow, c.stepId());
            if (step == null) {
                continue;
            }
            final JsonNode payload = parse(c.payload());
            if (payload == null || payload.isEmpty()) {
                issues.add(new Issue(
                        UUID.randomUUID(), runId, c.stepId(),
                        "EMPTY_PAYLOAD", Severity.WARNING,
                        "Contribution for '" + step.displayName()
                                + "' has an empty payload.",
                        null));
                continue;
            }
            final Set<String> payloadFieldRefs = extractFieldRefs(payload);
            for (final CaptureWorkflowField f : step.fields()) {
                if (f.requirement() == CaptureWorkflowField.Requirement.REQUIRED
                        && !payloadFieldRefs.contains(f.fieldRef())) {
                    issues.add(new Issue(
                            UUID.randomUUID(), runId, c.stepId(),
                            "REQUIRED_FIELD_MISSING", Severity.ERROR,
                            "Required field '" + f.fieldRef()
                                    + "' is missing from contribution for '"
                                    + step.displayName() + "'.",
                            f.fieldRef()));
                }
            }
        }

        // §35 — program-rule evaluation lands its findings in the same
        // bucket so operators see one list.
        issues.addAll(programRules.evaluate(workflow, runId, contributions));

        rewritePersistedIssues(runId, issues);
        LOG.debug("validateRun {} → {} issue(s)", runId, issues.size());
        return issues;
    }

    public List<Issue> findForRun(final UUID runId) {
        return jdbc.query(
                "SELECT issue_id, run_id, step_id, code, severity, message, "
                        + "field_ref, suggested_value "
                        + "FROM der.workflow_validation_issue "
                        + "WHERE run_id = ? ORDER BY detected_at DESC",
                (rs, i) -> new Issue(
                        UUID.fromString(rs.getString("issue_id")),
                        UUID.fromString(rs.getString("run_id")),
                        rs.getString("step_id") == null ? null
                                : UUID.fromString(rs.getString("step_id")),
                        rs.getString("code"),
                        Severity.valueOf(rs.getString("severity")),
                        rs.getString("message"),
                        rs.getString("field_ref"),
                        rs.getString("suggested_value")),
                runId);
    }

    /** Count of ERROR-severity issues per run — used by queue rendering. */
    public Map<UUID, Integer> errorCountsForRuns(final Set<UUID> runIds) {
        if (runIds.isEmpty()) {
            return Collections.emptyMap();
        }
        final String placeholders = String.join(",", Collections.nCopies(runIds.size(), "?"));
        final List<UUID> list = new ArrayList<>(runIds);
        final Map<UUID, Integer> out = new HashMap<>();
        jdbc.query(
                "SELECT run_id, COUNT(*) AS n "
                        + "FROM der.workflow_validation_issue "
                        + "WHERE severity = 'ERROR' AND run_id IN (" + placeholders + ") "
                        + "GROUP BY run_id",
                (rs) -> {
                    out.put(UUID.fromString(rs.getString("run_id")), rs.getInt("n"));
                },
                list.toArray(Object[]::new));
        return out;
    }

    /* ─── helpers ──────────────────────────────────────────────────── */

    private void rewritePersistedIssues(final UUID runId, final List<Issue> issues) {
        jdbc.update("DELETE FROM der.workflow_validation_issue WHERE run_id = ?", runId);
        for (final Issue i : issues) {
            jdbc.update(
                    "INSERT INTO der.workflow_validation_issue "
                            + "(issue_id, run_id, step_id, code, severity, message, "
                            + " field_ref, suggested_value) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    i.issueId(), runId, i.stepId(),
                    i.code(), i.severity().name(), i.message(),
                    i.fieldRef(), i.suggestedValue());
        }
    }

    private CaptureWorkflowStep findStep(final CaptureWorkflow w, final UUID stepId) {
        for (final CaptureWorkflowStep s : w.steps()) {
            if (s.stepId().equals(stepId)) {
                return s;
            }
        }
        return null;
    }

    private JsonNode parse(final String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException ex) {
            LOG.warn("contribution payload is not valid JSON: {}", ex.getMessage());
            return null;
        }
    }

    /**
     * Walks a contribution payload and collects the set of field refs
     * (DHIS2 UIDs) that appear as "dataElement", "attribute", or
     * "trackedEntityAttribute" keys at any depth. Good enough to tell
     * whether a REQUIRED field has been populated.
     */
    private Set<String> extractFieldRefs(final JsonNode root) {
        final Set<String> out = new LinkedHashSet<>();
        collect(root, out);
        return out;
    }

    private void collect(final JsonNode n, final Set<String> acc) {
        if (n == null) {
            return;
        }
        if (n.isObject()) {
            final JsonNode de = n.get("dataElement");
            if (de != null && de.isTextual()) {
                acc.add(de.asText());
            }
            final JsonNode attr = n.get("attribute");
            if (attr != null && attr.isTextual()) {
                acc.add(attr.asText());
            }
            final JsonNode tea = n.get("trackedEntityAttribute");
            if (tea != null && tea.isTextual()) {
                acc.add(tea.asText());
            }
            n.fieldNames().forEachRemaining((k) -> collect(n.get(k), acc));
        } else if (n.isArray()) {
            n.forEach((child) -> collect(child, acc));
        }
    }

    /** Visible-for-testing — exposed so unit tests can reach the field
     *  extractor without going through the whole run pipeline. */
    public Set<String> extractFieldRefsForTest(final JsonNode root) {
        return extractFieldRefs(root);
    }
}
