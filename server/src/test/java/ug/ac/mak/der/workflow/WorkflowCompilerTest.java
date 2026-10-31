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
    void aggregateAttributeOptionComboStampedOnDataValues() {
        // V049 — ATTRIBUTE_OPTION_COMBO step stamps its sectionRef AOC
        // onto every dataValue, so one dataset can carry parallel funder
        // populations without them colliding on (DE, CoC).
        final UUID id = UUID.randomUUID();
        final UUID gavi = UUID.randomUUID();
        final UUID wb = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC monthly — split funders",
            CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
            List.of(step(gavi, id, 0,
                    CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO, "aoc-GAVI"),
                    step(wb, id, 1,
                    CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO, "aoc-WB")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(gavi, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"10\"}]}"),
            contrib(wb,   "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"20\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        // Two rows (same DE+CoC but different AOC), each stamped.
        assertThat(out.path("dataValues").size()).isEqualTo(2);
        boolean sawGavi = false; boolean sawWb = false;
        for (final JsonNode v : out.path("dataValues")) {
            if ("aoc-GAVI".equals(v.path("attributeOptionCombo").asText())) sawGavi = true;
            if ("aoc-WB".equals(v.path("attributeOptionCombo").asText())) sawWb = true;
        }
        assertThat(sawGavi).isTrue();
        assertThat(sawWb).isTrue();
    }

    @Test
    void eventAttributeOptionComboStampedOnEvents() {
        // V049 — same pattern for program events.
        final UUID id = UUID.randomUUID();
        final UUID gavi = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "events — split funders",
            CaptureWorkflow.BindingKind.PROGRAM, "prog1", true, 1, NOW, NOW, null,
            List.of(step(gavi, id, 0,
                    CaptureWorkflowStep.SectionKind.ATTRIBUTE_OPTION_COMBO, "aoc-GAVI")),
            List.of(), false, null);
        final JsonNode out = compiler.compile(w, List.of(contrib(gavi,
            "{\"events\":[{\"programStage\":\"stage1\",\"occurredAt\":\"2026-10-30\",\"dataValues\":[]}]}")))
            .orElseThrow().payload();
        assertThat(out.path("events").get(0).path("attributeOptionCombo").asText())
            .isEqualTo("aoc-GAVI");
    }

    @Test
    void aggregatePeriodScopeStampsPeriodAndKeepsSlicesDistinct() {
        // V054 — two PERIOD_SCOPE steps on the same (DE, CoC) but
        // different periods stay as 2 distinct dataValues on the
        // compiled output, each stamped with its period.
        final UUID id = UUID.randomUUID();
        final UUID q1 = UUID.randomUUID();
        final UUID q2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "Backfill 2026 — Q1 + Q2",
            CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
            List.of(step(q1, id, 0,
                    CaptureWorkflowStep.SectionKind.PERIOD_SCOPE, "2026Q1"),
                    step(q2, id, 1,
                    CaptureWorkflowStep.SectionKind.PERIOD_SCOPE, "2026Q2")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(q1, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"10\"}]}"),
            contrib(q2, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"13\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("dataValues").size()).isEqualTo(2);
        boolean sawQ1 = false; boolean sawQ2 = false;
        for (final JsonNode v : out.path("dataValues")) {
            if ("2026Q1".equals(v.path("period").asText())) sawQ1 = true;
            if ("2026Q2".equals(v.path("period").asText())) sawQ2 = true;
        }
        assertThat(sawQ1).isTrue();
        assertThat(sawQ2).isTrue();
    }

    @Test
    void aggregateDatasetElementStampsDataElement() {
        // V053 — DATASET_ELEMENT step owns one DE; its sectionRef is
        // stamped as the dataElement on each dataValue the step
        // contributes, so the payload can omit the DE on each row.
        final UUID id = UUID.randomUUID();
        final UUID step = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC — DE-only step",
            CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
            List.of(step(step, id, 0,
                    CaptureWorkflowStep.SectionKind.DATASET_ELEMENT, "DE_ANC_VISITS")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(step, "{\"dataValues\":["
                + "{\"categoryOptionCombo\":\"COC_MALE\",\"value\":\"5\"},"
                + "{\"categoryOptionCombo\":\"COC_FEMALE\",\"value\":\"7\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("dataValues").size()).isEqualTo(2);
        for (final JsonNode v : out.path("dataValues")) {
            assertThat(v.path("dataElement").asText()).isEqualTo("DE_ANC_VISITS");
        }
    }

    @Test
    void aggregateOrgUnitScopeStampedOnDataValues() {
        // V050 — ORG_UNIT_SCOPE stamps orgUnit on dataValues so a
        // district edge can collect per-facility slices and emit them
        // as distinct rows on one dataset submission.
        final UUID id = UUID.randomUUID();
        final UUID ouA = UUID.randomUUID();
        final UUID ouB = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "District ANC",
            CaptureWorkflow.BindingKind.DATA_SET, "ds1", true, 1, NOW, NOW, null,
            List.of(step(ouA, id, 0,
                    CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE, "ou-facility-A"),
                    step(ouB, id, 1,
                    CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE, "ou-facility-B")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(ouA, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"10\"}]}"),
            contrib(ouB, "{\"dataValues\":[{\"dataElement\":\"DE1\",\"categoryOptionCombo\":\"COC1\",\"value\":\"7\"}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("dataValues").size()).isEqualTo(2);
        boolean sawA = false; boolean sawB = false;
        for (final JsonNode v : out.path("dataValues")) {
            if ("ou-facility-A".equals(v.path("orgUnit").asText())) sawA = true;
            if ("ou-facility-B".equals(v.path("orgUnit").asText())) sawB = true;
        }
        assertThat(sawA).isTrue();
        assertThat(sawB).isTrue();
    }

    @Test
    void eventOrgUnitScopeStampedOnEvents() {
        final UUID id = UUID.randomUUID();
        final UUID ouA = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "events — OU split",
            CaptureWorkflow.BindingKind.PROGRAM, "prog1", true, 1, NOW, NOW, null,
            List.of(step(ouA, id, 0,
                    CaptureWorkflowStep.SectionKind.ORG_UNIT_SCOPE, "ou-ward-A")),
            List.of(), false, null);
        final JsonNode out = compiler.compile(w, List.of(contrib(ouA,
            "{\"events\":[{\"programStage\":\"stage1\",\"occurredAt\":\"2026-10-30\",\"dataValues\":[]}]}")))
            .orElseThrow().payload();
        assertThat(out.path("events").get(0).path("orgUnit").asText())
            .isEqualTo("ou-ward-A");
    }

    @Test
    void eventInstanceStampsUidAndMergesByUid() {
        // V052 — two EVENT_INSTANCE steps split field capture across the
        // SAME event (ANC1). Both stamp event=ANC1-UID; compiler
        // deduplicates by event UID and merges dataValues.
        final UUID id = UUID.randomUUID();
        final UUID s1 = UUID.randomUUID();
        final UUID s2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC visit — split capture",
            CaptureWorkflow.BindingKind.PROGRAM_STAGE, "ANC_VISIT", true, 1, NOW, NOW, null,
            List.of(step(s1, id, 0,
                        CaptureWorkflowStep.SectionKind.EVENT_INSTANCE, "ANC1-UID"),
                    step(s2, id, 1,
                        CaptureWorkflowStep.SectionKind.EVENT_INSTANCE, "ANC1-UID")),
            List.of(), false, null);
        // Both payloads omit the event UID — compiler will stamp it.
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(s1, "{\"events\":[{\"programStage\":\"ANC_VISIT\",\"occurredAt\":\"2026-01-15\","
                + "\"dataValues\":[{\"dataElement\":\"BP\",\"value\":\"120/80\"}]}]}"),
            contrib(s2, "{\"events\":[{\"programStage\":\"ANC_VISIT\",\"occurredAt\":\"2026-01-15\","
                + "\"dataValues\":[{\"dataElement\":\"TEMP\",\"value\":\"36.5\"}]}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("events").size()).isEqualTo(1);
        assertThat(out.path("events").get(0).path("event").asText()).isEqualTo("ANC1-UID");
        assertThat(out.path("events").get(0).path("dataValues").size()).isEqualTo(2);
    }

    @Test
    void twoEventInstancesStayDistinct() {
        // V052 — two EVENT_INSTANCE steps targeting DIFFERENT event
        // UIDs produce 2 distinct events on compiled output.
        final UUID id = UUID.randomUUID();
        final UUID s1 = UUID.randomUUID();
        final UUID s2 = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "ANC series",
            CaptureWorkflow.BindingKind.PROGRAM_STAGE, "ANC_VISIT", true, 1, NOW, NOW, null,
            List.of(step(s1, id, 0,
                        CaptureWorkflowStep.SectionKind.EVENT_INSTANCE, "ANC1-UID"),
                    step(s2, id, 1,
                        CaptureWorkflowStep.SectionKind.EVENT_INSTANCE, "ANC2-UID")),
            List.of(), false, null);
        final List<CaptureWorkflowContribution> cs = List.of(
            contrib(s1, "{\"events\":[{\"programStage\":\"ANC_VISIT\",\"occurredAt\":\"2026-01-15\",\"dataValues\":[]}]}"),
            contrib(s2, "{\"events\":[{\"programStage\":\"ANC_VISIT\",\"occurredAt\":\"2026-02-15\",\"dataValues\":[]}]}"));
        final JsonNode out = compiler.compile(w, cs).orElseThrow().payload();
        assertThat(out.path("events").size()).isEqualTo(2);
    }

    @Test
    void relationshipsFoldedIntoDedicatedBlock() {
        // V051 — RELATIONSHIP step contributes relationships[] which the
        // compiler folds into a dedicated top-level relationships[]
        // block. relationshipType defaults from the step's sectionRef
        // when the payload doesn't set it.
        final UUID id = UUID.randomUUID();
        final UUID step = UUID.randomUUID();
        final CaptureWorkflow w = new CaptureWorkflow(id, "Index-contact tracker",
            CaptureWorkflow.BindingKind.PROGRAM, "ic-prog", true, 1, NOW, NOW, null,
            List.of(step(step, id, 0,
                    CaptureWorkflowStep.SectionKind.RELATIONSHIP, "RT-INDEX-CONTACT")),
            List.of(), false, null);
        final String payload = "{\"relationships\":["
            + "{\"from\":{\"trackedEntity\":\"TE-INDEX-1\"},"
            + " \"to\":{\"trackedEntity\":\"TE-CONTACT-1\"}},"
            + "{\"from\":{\"trackedEntity\":\"TE-INDEX-1\"},"
            + " \"to\":{\"trackedEntity\":\"TE-CONTACT-2\"},"
            + " \"relationshipType\":\"RT-OTHER\"}"
            + "]}";
        final JsonNode out = compiler.compile(w, List.of(contrib(step, payload)))
            .orElseThrow().payload();
        assertThat(out.path("relationships").size()).isEqualTo(2);
        // Default relationshipType from sectionRef stamped on 1st
        assertThat(out.path("relationships").get(0).path("relationshipType").asText())
            .isEqualTo("RT-INDEX-CONTACT");
        // Explicit relationshipType preserved on 2nd
        assertThat(out.path("relationships").get(1).path("relationshipType").asText())
            .isEqualTo("RT-OTHER");
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
