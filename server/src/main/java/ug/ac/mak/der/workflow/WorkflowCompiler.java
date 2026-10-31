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
        // (dataElement, coc, aoc) → value node (last write wins). AOC
        // is part of the key so AOC-split steps land in distinct rows
        // instead of overwriting each other.
        final Map<String, JsonNode> values = new LinkedHashMap<>();
        for (final CaptureWorkflowStep s : ordered) {
            final CaptureWorkflowContribution c = byStep.get(s.stepId());
            if (c == null) {
                continue;
            }
            final JsonNode payload = mapper.readTree(c.payload());
            final JsonNode arr = payload.path("dataValues");
            // V049 — ATTRIBUTE_OPTION_COMBO stamps attributeOptionCombo.
            // V050 — ORG_UNIT_SCOPE stamps orgUnit (sub-OU under edge).
            // Both are cross-cutting; sectionRef is the respective UID.
            final String aocStamp = s.sectionKind()
                    == CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO
                    ? s.sectionRef() : null;
            final String ouStamp = s.sectionKind()
                    == CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE
                    ? s.sectionRef() : null;
            if (arr.isArray()) {
                arr.forEach((v) -> {
                    final ObjectNode value = (ObjectNode) v;
                    if (aocStamp != null && !aocStamp.isBlank()
                            && !value.has("attributeOptionCombo")) {
                        value.put("attributeOptionCombo", aocStamp);
                    }
                    if (ouStamp != null && !ouStamp.isBlank()
                            && !value.has("orgUnit")) {
                        value.put("orgUnit", ouStamp);
                    }
                    final String key = value.path("dataElement").asText("")
                            + "|" + value.path("categoryOptionCombo").asText("")
                            + "|" + value.path("attributeOptionCombo").asText("")
                            + "|" + value.path("orgUnit").asText("");
                    values.put(key, value);
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
        // V046 — ENROLLMENT_FORM contributions land in a dedicated section.
        final ObjectNode enrollment = mapper.createObjectNode();
        boolean enrollmentPresent = false;
        // V048 — TEI_TYPE_ATTRIBUTES contributions land on trackedEntity.
        final ObjectNode trackedEntity = mapper.createObjectNode();
        final Map<String, JsonNode> teiAttrs = new LinkedHashMap<>();
        boolean teiPresent = false;
        // V051 — RELATIONSHIP contributions land on relationships[].
        // Key = (from.trackedEntity | from.enrollment | from.event)
        //     + "|" + (to…) + "|" + relationshipType — so a mother↔child
        // pair appearing from multiple steps dedupes correctly.
        final Map<String, JsonNode> relationships = new LinkedHashMap<>();

        for (final CaptureWorkflowStep s : ordered) {
            final CaptureWorkflowContribution c = byStep.get(s.stepId());
            if (c == null) {
                continue;
            }
            final JsonNode payload = mapper.readTree(c.payload());

            if (s.sectionKind() == CaptureWorkflowStep.SectionKind.ENROLLMENT_FORM) {
                enrollmentPresent |= mergeEnrollment(enrollment, payload);
            }
            // V049 — AOC step can target the enrollment layer too.
            // V050 — ORG_UNIT_SCOPE step similarly stamps enrollment.orgUnit.
            if (s.sectionRef() != null && !s.sectionRef().isBlank()
                    && (!payload.path("enrollmentDate").isMissingNode()
                        || !payload.path("enrollment").isMissingNode())) {
                if (s.sectionKind() == CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO) {
                    enrollment.put("attributeOptionCombo", s.sectionRef());
                    enrollmentPresent = true;
                } else if (s.sectionKind() == CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE) {
                    enrollment.put("orgUnit", s.sectionRef());
                    enrollmentPresent = true;
                }
            }
            if (s.sectionKind() == CaptureWorkflowStep.SectionKind.TEI_TYPE_ATTRIBUTES) {
                teiPresent |= mergeTei(trackedEntity, teiAttrs, payload);
                // TEI_TYPE_ATTRIBUTES does NOT also contribute to the
                // enrollment-level attributes[] bucket. Skip to next step.
                consumedSteps.add(s.stepId().toString());
                consumedIds.add(c.contributionId());
                continue;
            }
            // V051 — RELATIONSHIP contributions go only to relationships[].
            if (s.sectionKind() == CaptureWorkflowStep.SectionKind.RELATIONSHIP) {
                mergeRelationships(relationships, payload, s.sectionRef());
                consumedSteps.add(s.stepId().toString());
                consumedIds.add(c.contributionId());
                continue;
            }

            // V049 — ATTRIBUTE_OPTION_COMBO stamps event AOC.
            // V050 — ORG_UNIT_SCOPE stamps event orgUnit.
            // V052 — EVENT_INSTANCE stamps event UID.
            final String aocStamp = s.sectionKind()
                    == CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO
                    ? s.sectionRef() : null;
            final String ouStamp = s.sectionKind()
                    == CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE
                    ? s.sectionRef() : null;
            final String eventUidStamp = s.sectionKind()
                    == CaptureWorkflowStep.SectionKind.EVENT_INSTANCE
                    ? s.sectionRef() : null;

            payload.path("attributes").forEach((a) -> attributes.put(
                    a.path("attribute").asText(""), a));
            payload.path("events").forEach((e) -> {
                final ObjectNode event = (ObjectNode) e.deepCopy();
                if (aocStamp != null && !aocStamp.isBlank()
                        && !event.has("attributeOptionCombo")) {
                    event.put("attributeOptionCombo", aocStamp);
                }
                if (ouStamp != null && !ouStamp.isBlank()
                        && !event.has("orgUnit")) {
                    event.put("orgUnit", ouStamp);
                }
                if (eventUidStamp != null && !eventUidStamp.isBlank()
                        && (!event.has("event")
                            || "".equals(event.path("event").asText("")))) {
                    event.put("event", eventUidStamp);
                }
                // V052 — if an explicit event UID is present, it IS the
                // primary dedupe key so two steps splitting fields of
                // the same event merge into one row. Fallback to
                // (programStage, occurredAt, AOC, OU) when no UID.
                final String uid = event.path("event").asText("");
                final String key = !uid.isBlank()
                        ? "event:" + uid
                        : event.path("programStage").asText("") + "|"
                            + event.path("occurredAt").asText("") + "|"
                            + event.path("attributeOptionCombo").asText("") + "|"
                            + event.path("orgUnit").asText("");
                final JsonNode existing = events.get(key);
                if (existing == null) {
                    events.put(key, event);
                } else {
                    // Field-level split across steps on the same event:
                    // merge dataValues[] by (dataElement, categoryOptionCombo)
                    // instead of replacing the whole event.
                    events.put(key, mergeEventFields((ObjectNode) existing, event));
                }
            });
            consumedSteps.add(s.stepId().toString());
            consumedIds.add(c.contributionId());
        }
        root.put("program", workflow.boundMetadataKind()
                == CaptureWorkflow.BindingKind.PROGRAM
                ? workflow.boundMetadataId() : null);
        if (enrollmentPresent) {
            root.set("enrollment", enrollment);
        }
        if (teiPresent) {
            final ArrayNode teiArr = trackedEntity.putArray("attributes");
            teiAttrs.values().forEach(teiArr::add);
            root.set("trackedEntity", trackedEntity);
        }
        if (!relationships.isEmpty()) {
            final ArrayNode rels = root.putArray("relationships");
            relationships.values().forEach(rels::add);
        }
        final ArrayNode attrs = root.putArray("attributes");
        attributes.values().forEach(attrs::add);
        final ArrayNode evts = root.putArray("events");
        events.values().forEach(evts::add);
    }

    /** V051 — fold RELATIONSHIP step payload's relationships[] into a
     *  dedupe map. relationshipType defaults from the step's sectionRef
     *  when the payload itself doesn't set it. Dedupe key is
     *  (from endpoint, to endpoint, relationshipType). */
    private void mergeRelationships(final Map<String, JsonNode> relationships,
                                      final JsonNode payload,
                                      final String defaultRelType) {
        final JsonNode arr = payload.path("relationships");
        if (!arr.isArray()) {
            return;
        }
        arr.forEach((r) -> {
            final ObjectNode rel = (ObjectNode) r.deepCopy();
            if ((rel.path("relationshipType").isMissingNode()
                    || rel.path("relationshipType").isNull()
                    || "".equals(rel.path("relationshipType").asText()))
                    && defaultRelType != null && !defaultRelType.isBlank()) {
                rel.put("relationshipType", defaultRelType);
            }
            final String fromKey = endpointKey(rel.path("from"));
            final String toKey   = endpointKey(rel.path("to"));
            final String key = fromKey + "|" + toKey + "|"
                    + rel.path("relationshipType").asText("");
            relationships.put(key, rel);
        });
    }

    /** Flatten a relationship endpoint {trackedEntity|enrollment|event}
     *  into a single key fragment, preferring trackedEntity when
     *  present. */
    private static String endpointKey(final JsonNode endpoint) {
        if (endpoint.isMissingNode() || endpoint.isNull()) {
            return "";
        }
        for (final String f : new String[] {"trackedEntity", "enrollment", "event"}) {
            final JsonNode n = endpoint.path(f);
            if (!n.isMissingNode() && !n.isNull() && !"".equals(n.asText(""))) {
                return f + ":" + n.asText();
            }
        }
        return "";
    }

    /** Merge dataValues[] from a later contribution into an existing
     *  event, keyed by (dataElement, categoryOptionCombo). Later steps
     *  overwrite earlier cells. Non-dataValue top-level fields on the
     *  later contribution overwrite the existing event. */
    private ObjectNode mergeEventFields(final ObjectNode existing,
                                          final JsonNode incoming) {
        incoming.fields().forEachRemaining((entry) -> {
            if (!"dataValues".equals(entry.getKey())) {
                existing.set(entry.getKey(), entry.getValue());
            }
        });
        final Map<String, JsonNode> cells = new LinkedHashMap<>();
        final JsonNode existingValues = existing.path("dataValues");
        if (existingValues.isArray()) {
            existingValues.forEach((v) -> cells.put(cellKey(v), v));
        }
        final JsonNode incomingValues = incoming.path("dataValues");
        if (incomingValues.isArray()) {
            incomingValues.forEach((v) -> cells.put(cellKey(v), v));
        }
        final ArrayNode out = existing.putArray("dataValues");
        cells.values().forEach(out::add);
        return existing;
    }

    private static String cellKey(final JsonNode v) {
        return v.path("dataElement").asText("") + "|"
                + v.path("categoryOptionCombo").asText("");
    }

    /** V048 — fold TEI_TYPE_ATTRIBUTES into the trackedEntity block.
     *  Later steps overwrite earlier values. The payload may carry
     *  trackedEntity-level metadata too (trackedEntity UID,
     *  trackedEntityType UID, orgUnit, geometry) which lives at the
     *  trackedEntity root alongside the merged attributes array. */
    private boolean mergeTei(final ObjectNode trackedEntity,
                               final Map<String, JsonNode> teiAttrs,
                               final JsonNode payload) {
        boolean touched = false;
        for (final String f : new String[] {
                "trackedEntity", "trackedEntityType", "orgUnit",
                "geometry", "inactive", "potentialDuplicate"}) {
            final JsonNode node = payload.path(f);
            if (!node.isMissingNode() && !node.isNull()) {
                trackedEntity.set(f, node);
                touched = true;
            }
        }
        final JsonNode attrs = payload.path("attributes");
        if (attrs.isArray()) {
            attrs.forEach((a) -> teiAttrs.put(
                    a.path("attribute").asText(""), a));
            if (attrs.size() > 0) {
                touched = true;
            }
        }
        return touched;
    }

    /** Fold ENROLLMENT_FORM contribution fields into the compiled
     *  enrollment node. Later steps overwrite earlier values. */
    private boolean mergeEnrollment(final ObjectNode enrollment,
                                       final JsonNode payload) {
        boolean touched = false;
        for (final String f : new String[] {
                "enrollment", "enrollmentDate", "incidentDate",
                "orgUnit", "status", "trackedEntity", "geometry",
                "program", "deleted"}) {
            final JsonNode node = payload.path(f);
            if (!node.isMissingNode() && !node.isNull()) {
                enrollment.set(f, node);
                touched = true;
            }
        }
        // Enrollment-attached attributes merge into the dedicated
        // `enrollmentAttributes` array; non-enrollment attributes stay in
        // the workflow-level `attributes` array for backward compat.
        final JsonNode ea = payload.path("enrollmentAttributes");
        if (ea.isArray() && !ea.isEmpty()) {
            enrollment.set("attributes", ea);
            touched = true;
        }
        return touched;
    }

    /** The compiled payload + which contribution rows it drained. */
    public record CompileResult(ObjectNode payload, List<UUID> consumedContributionIds) { }
}
