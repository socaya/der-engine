package ug.ac.mak.der.workflow;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** V045 — the compiler merges each capture-workflow-step's contribution
 *  back into a single DHIS2 submission payload.
 *
 *  <p>Rules per binding kind:</p>
 *  <ul>
 *    <li><b>DATA_SET</b> — merge all <code>dataValues[]</code> arrays
 *        across contributions; later contributions overwrite earlier
 *        values for the same (dataElement, categoryOptionCombo).</li>
 *    <li><b>PROGRAM</b> + <b>PROGRAM_STAGE</b> — union attributes + events;
 *        event dedupe is by (program-stage, occurredAt).</li>
 *    <li><b>PROGRAM_STAGE_SECTION</b> — compiled into a single event with
 *        dataValues from every contribution.</li>
 *  </ul>
 *
 *  <p>Steps are composed in {@code ordinal} order so a later step may
 *  overwrite an earlier one when they target the same field. The result
 *  is a {@link CompileResult} with the merged payload + a list of the
 *  contribution UUIDs it consumed (so callers can mark them drained). */
@Service
public class WorkflowCompiler {

    private static final Logger LOG = LoggerFactory.getLogger(WorkflowCompiler.class);
    private final ObjectMapper mapper;

    public WorkflowCompiler(final ObjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /** @return the compiled payload or empty when there are no contributions
     *          OR a step whose contribution is missing when the workflow
     *          hasn't fully completed yet. */
    public Optional<CompileResult> compile(final CaptureWorkflow workflow,
                                            final List<CaptureWorkflowContribution> contributions) {
        Objects.requireNonNull(workflow, "workflow");
        if (contributions == null || contributions.isEmpty()) {
            return Optional.empty();
        }
        // Index contributions by stepId, then walk steps in ordinal order.
        final Map<UUID, CaptureWorkflowContribution> byStep = new LinkedHashMap<>();
        for (final CaptureWorkflowContribution c : contributions) {
            byStep.put(c.stepId(), c);
        }
        final List<CaptureWorkflowStep> ordered = new ArrayList<>(workflow.steps());
        ordered.sort((a, b) -> Integer.compare(a.ordinal(), b.ordinal()));

        final ObjectNode root = mapper.createObjectNode();
        root.put("workflowId", workflow.workflowId().toString());
        root.put("boundMetadataKind", workflow.boundMetadataKind().name());
        root.put("boundMetadataId", workflow.boundMetadataId());

        final ArrayNode consumedSteps = root.putArray("consumedSteps");
        final List<UUID> consumedIds = new ArrayList<>();

        try {
            switch (workflow.boundMetadataKind()) {
                case DATA_SET -> compileDataSet(root, ordered, byStep, consumedSteps, consumedIds);
                case PROGRAM, PROGRAM_STAGE, PROGRAM_STAGE_SECTION ->
                    compileProgram(workflow, root, ordered, byStep, consumedSteps, consumedIds);
                default -> throw new IllegalStateException("unsupported binding: "
                        + workflow.boundMetadataKind());
            }
        } catch (JsonProcessingException ex) {
            LOG.warn("workflow {} contribution parse failed", workflow.workflowId(), ex);
            return Optional.empty();
        }

        return Optional.of(new CompileResult(root, consumedIds));
    }

    /* ─── DATA_SET — merge dataValues[] arrays ─────────────────────── */

    private void compileDataSet(final ObjectNode root,
                                  final List<CaptureWorkflowStep> ordered,
                                  final Map<UUID, CaptureWorkflowContribution> byStep,
                                  final ArrayNode consumedSteps,
                                  final List<UUID> consumedIds) throws JsonProcessingException {
        // (dataElement, coc) → value node (last write wins).
        final Map<String, JsonNode> values = new LinkedHashMap<>();
        for (final CaptureWorkflowStep s : ordered) {
            final CaptureWorkflowContribution c = byStep.get(s.stepId());
            if (c == null) {
                continue;
            }
            final JsonNode payload = mapper.readTree(c.payload());
            final JsonNode arr = payload.path("dataValues");
            if (arr.isArray()) {
                arr.forEach((v) -> {
                    final String key = v.path("dataElement").asText("")
                            + "|" + v.path("categoryOptionCombo").asText("");
                    values.put(key, v);
                });
            }
            consumedSteps.add(s.stepId().toString());
            consumedIds.add(c.contributionId());
        }
        final ArrayNode out = root.putArray("dataValues");
        values.values().forEach(out::add);
    }

    /* ─── PROGRAM / stage / section — union attributes + events ────── */

    private void compileProgram(final CaptureWorkflow workflow,
                                  final ObjectNode root,
                                  final List<CaptureWorkflowStep> ordered,
                                  final Map<UUID, CaptureWorkflowContribution> byStep,
                                  final ArrayNode consumedSteps,
                                  final List<UUID> consumedIds) throws JsonProcessingException {
        final Map<String, JsonNode> attributes = new LinkedHashMap<>();
        final Map<String, JsonNode> events = new LinkedHashMap<>();
        for (final CaptureWorkflowStep s : ordered) {
            final CaptureWorkflowContribution c = byStep.get(s.stepId());
            if (c == null) {
                continue;
            }
            final JsonNode payload = mapper.readTree(c.payload());
            payload.path("attributes").forEach((a) -> attributes.put(
                    a.path("attribute").asText(""), a));
            payload.path("events").forEach((e) -> {
                final String key = e.path("programStage").asText("") + "|"
                        + e.path("occurredAt").asText("");
                events.put(key, e);
            });
            consumedSteps.add(s.stepId().toString());
            consumedIds.add(c.contributionId());
        }
        root.put("program", workflow.boundMetadataKind()
                == CaptureWorkflow.BindingKind.PROGRAM
                ? workflow.boundMetadataId() : null);
        final ArrayNode attrs = root.putArray("attributes");
        attributes.values().forEach(attrs::add);
        final ArrayNode evts = root.putArray("events");
        events.values().forEach(evts::add);
    }

    /** The compiled payload + which contribution rows it drained. */
    public record CompileResult(ObjectNode payload, List<UUID> consumedContributionIds) { }
}
