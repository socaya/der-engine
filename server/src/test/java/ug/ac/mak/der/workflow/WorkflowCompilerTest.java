package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

/** V045 + V046 — proves the compiler merges field-level contributions
 *  across steps for aggregate, event-only and tracker workflows. */
class WorkflowCompilerTest {

    private static final Instant NOW = Instant.parse("2026-10-31T10:00:00Z");
    private final ObjectMapper mapper = new ObjectMapper();
    private final WorkflowCompiler compiler = new WorkflowCompiler(mapper);

    @Test
    void aggregateMergesDataValuesByDeCoc() {
        final UUID id = UUID.randomUUID();
        final UUID step1 = UUID.randomUUID();
        final UUID step2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC monthly",
            CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
            List.of(step(step1, id, 0, CaptureWorkflowStep.SectionKind.DATASET_SECTION, "sec-A"),
                    step(step2, id, 1, CaptureWorkflowStep.SectionKind.DATASET_SECTION, "sec-B")),
            List.of(), false, null);

        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(step1, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"10\"}]}"),
            contrib(step2, "{\"dataValues\":[{\"dataElement\":\"DE2\",\"categoryOptionCombo\":\"COC1\",\"value\":\"20\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("dataValues").size()).isEqualTo(2);
    }

    @Test
    void eventFieldLevelSplitMergesWithinEvent() {
        // Two steps contributing different fields of the SAME event.
        final UUID id = UUID.randomUUID();
        final UUID s1 = UUID.randomUUID();
        final UUID s2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "immunisation",
            CaptureWorkflow.BindingKind.PROGRAM, "imm-prog", true, 1, NOW, NOW, null,
            List.of(step(s1, id, 0, CaptureWorkflowStep.SectionKind.AD_HOC, null),
                    step(s2, id, 1, CaptureWorkflowStep.SectionKind.AD_HOC, null)),
            List.of(), false, null);

        final String event1 = "{\"events\":[{\"programStage\":\"stage1\",\"occurredAt\":\"2026-10-30\",\"dataValues\":[{\"dataElement\":\"DE1\",\"value\":\"a\"}]}]}";
        final String event2 = "{\"events\":[{\"programStage\":\"stage1\",\"occurredAt\":\"2026-10-30\",\"dataValues\":[{\"dataElement\":\"DE2\",\"value\":\"b\"}]}]}";
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(s1, event1), contrib(s2, event2));

        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("events").size()).isEqualTo(1);
        final JsonNode merged = out.path("events").get(0);
        assertThat(merged.path("dataValues").size()).isEqualTo(2);
        // Later overwrite semantics for same cell:
        final String event3 = "{\"events\":[{\"programStage\":\"stage1\",\"occurredAt\":\"2026-10-30\",\"dataValues\":[{\"dataElement\":\"DE1\",\"value\":\"a-updated\"}]}]}";
        final JsonNode out2 = compiler.compile(w, List.of(
            contrib(s1, event1), contrib(s2, event3))).orElseThrow().payload();
        assertThat(out2.path("events").get(0).path("dataValues").size()).isEqualTo(1);
        assertThat(out2.path("events").get(0).path("dataValues").get(0).path("value").asText())
            .isEqualTo("a-updated");
    }

    @Test
    void teiTypeAttributesFoldedIntoTrackedEntityBlock() {
        // V048 — TEI_TYPE_ATTRIBUTES contributes name/DoB onto a dedicated
        // trackedEntity.attributes[] block, distinct from enrollment-level
        // attributes[] on the root.
        final UUID id = UUID.randomUUID();
        final UUID teiStep = UUID.randomUUID();
        final UUID enrollStep = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC tracker",
            CaptureWorkflow.BindingKind.PROGRAM, "anc-prog", true, 1, NOW, NOW, null,
            List.of(step(teiStep, id, 0,
                        CaptureWorkflowStep.SectionKind.TEI_TYPE_ATTRIBUTES, "teType-person"),
                    step(enrollStep, id, 1,
                        CaptureWorkflowStep.SectionKind.PROGRAM_SECTION, "sec-visit")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(teiStep, "{\"trackedEntityType\":\"PERSON\","
                + "\"attributes\":[{\"attribute\":\"NAME\",\"value\":\"Mary\"},"
                + "{\"attribute\":\"DOB\",\"value\":\"1990-01-01\"}]}"),
            contrib(enrollStep, "{\"attributes\":[{\"attribute\":\"VISIT_REASON\",\"value\":\"ANC1\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("trackedEntity").path("trackedEntityType").asText()).isEqualTo("PERSON");
        assertThat(out.path("trackedEntity").path("attributes").size()).isEqualTo(2);
        assertThat(out.path("attributes").size()).isEqualTo(1);
        assertThat(out.path("attributes").get(0).path("attribute").asText()).isEqualTo("VISIT_REASON");
    }

    @Test
    void programSectionAttributesMergeIntoAttributesArray() {
        // V047 — two PROGRAM_SECTION steps contribute different attribute
        // uids; compiler merges by `attribute` UID into attributes[].
        final UUID id = UUID.randomUUID();
        final UUID s1 = UUID.randomUUID();
        final UUID s2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC tracker",
            CaptureWorkflow.BindingKind.PROGRAM, "anc-prog", true, 1, NOW, NOW, null,
            List.of(step(s1, id, 0,
                        CaptureWorkflowStep.SectionKind.PROGRAM_SECTION, "sec-demographics"),
                    step(s2, id, 1,
                        CaptureWorkflowStep.SectionKind.PROGRAM_SECTION, "sec-contact")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(s1, "{\"attributes\":[{\"attribute\":\"A1\",\"value\":\"Mary\"}]}"),
            contrib(s2, "{\"attributes\":[{\"attribute\":\"A2\",\"value\":\"+256700000\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("attributes").size()).isEqualTo(2);
    }

    @Test
    void trackerEnrollmentFoldedIntoEnrollmentBlock() {
        final UUID id = UUID.randomUUID();
        final UUID enrollStep = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC tracker",
            CaptureWorkflow.BindingKind.PROGRAM, "anc-prog", true, 1, NOW, NOW, null,
            List.of(step(enrollStep, id, 0,
                    CaptureWorkflowStep.SectionKind.ENROLLMENT_FORM, null)),
            List.of(), false, null);

        final String payload = "{\"enrollmentDate\":\"2026-10-01\",\"orgUnit\":\"OU1\","
            + "\"status\":\"ACTIVE\",\"enrollmentAttributes\":[{\"attribute\":\"A1\",\"value\":\"Mary\"}]}";
        final JsonNode out = compiler.compile(w, List.of(contrib(enrollStep, payload)))
            .orElseThrow().payload();
        assertThat(out.path("enrollment").path("enrollmentDate").asText()).isEqualTo("2026-10-01");
        assertThat(out.path("enrollment").path("orgUnit").asText()).isEqualTo("OU1");
        assertThat(out.path("enrollment").path("attributes").size()).isEqualTo(1);
    }

    private static CaptureWorkflowStep step(final UUID stepId, final UUID wfId,
                                              final int ordinal,
                                              final CaptureWorkflowStep.SectionKind sk,
                                              final String ref) {
        return new CaptureWorkflowStep(stepId, wfId, ordinal, "s" + ordinal,
                CaptureWorkflowStep.OwnerRole.OPERATOR, null,
                CaptureWorkflowStep.StepKind.CAPTURE, List.of(), sk, ref);
    }

    private static CaptureWorkflowContribution contrib(final UUID stepId, final String json) {
        return new CaptureWorkflowContribution(
                UUID.randomUUID(), UUID.randomUUID(), stepId, json,
                null, null, NOW);
    }
}
