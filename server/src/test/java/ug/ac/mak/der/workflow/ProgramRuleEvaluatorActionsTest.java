package ug.ac.mak.der.workflow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramRule;
import ug.ac.mak.der.metadata.MirroredProgramRuleAction;

/**
 * Phase 10.2 coverage for the two ADR-0007 action handlers upgraded
 * in this slice: CREATEEVENT + HIDESECTION. The full {@code evaluate}
 * pipeline requires a mirror + pinning + jdbc + workflow fixtures;
 * these tests exercise the two helpers directly through reflection
 * so the semantic change is isolated from unrelated moving parts.
 */
class ProgramRuleEvaluatorActionsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ProgramRuleEvaluator build() {
        return new ProgramRuleEvaluator(mock(ExtendedMirrorRepository.class),
                mapper, mock(JdbcTemplate.class), mock(WorkflowPinningService.class));
    }

    private MirroredProgramRule rule() {
        return new MirroredProgramRule("ruleUid", "progUid",
                "Example rule", 0, "true",
                java.util.List.of(),
                mapper.createObjectNode());
    }

    private MirroredProgramRuleAction action(final String type, final JsonNode payload) {
        return new MirroredProgramRuleAction("actUid", "ruleUid", type,
                null, null, null, "action content", payload);
    }

    private ProgressiveValidator.Issue invokeHideSection(final ProgramRuleEvaluator ev,
                                                          final MirroredProgramRule r,
                                                          final MirroredProgramRuleAction a) throws Exception {
        final Method m = ProgramRuleEvaluator.class.getDeclaredMethod(
                "hideSectionIssue", UUID.class, MirroredProgramRule.class,
                MirroredProgramRuleAction.class);
        m.setAccessible(true);
        return (ProgressiveValidator.Issue) m.invoke(ev, UUID.randomUUID(), r, a);
    }

    private ProgressiveValidator.Issue invokeCreateEvent(final ProgramRuleEvaluator ev,
                                                          final MirroredProgramRule r,
                                                          final MirroredProgramRuleAction a) throws Exception {
        final Method m = ProgramRuleEvaluator.class.getDeclaredMethod(
                "createEventIssue", UUID.class, MirroredProgramRule.class,
                MirroredProgramRuleAction.class);
        m.setAccessible(true);
        return (ProgressiveValidator.Issue) m.invoke(ev, UUID.randomUUID(), r, a);
    }

    @Test
    void hideSectionReadsBareStringPayloadRef() throws Exception {
        final JsonNode payload = mapper.readTree(
                "{\"programStageSection\":\"SECbare12345\"}");
        final var issue = invokeHideSection(build(), rule(), action("HIDESECTION", payload));
        assertThat(issue).isNotNull();
        assertThat(issue.code()).isEqualTo("PROGRAM_RULE_HIDESECTION");
        assertThat(issue.fieldRef()).isEqualTo("SECbare12345");
    }

    @Test
    void hideSectionReadsNestedObjectPayloadRef() throws Exception {
        final JsonNode payload = mapper.readTree(
                "{\"programStageSection\":{\"id\":\"SECnest12345\"}}");
        final var issue = invokeHideSection(build(), rule(), action("HIDESECTION", payload));
        assertThat(issue).isNotNull();
        assertThat(issue.fieldRef()).isEqualTo("SECnest12345");
    }

    @Test
    void hideSectionWithoutRefFallsBackToSingleFieldSemantics() throws Exception {
        /* Defensive fallback — if central ships a HIDESECTION rule
         * without a programStageSection reference, we route it
         * through the HIDEFIELD helper so the operator still gets
         * SOMETHING instead of a silent drop. */
        final JsonNode payload = mapper.createObjectNode();
        final MirroredProgramRuleAction a = new MirroredProgramRuleAction(
                "actUid", "ruleUid", "HIDESECTION",
                "DEfallback12", null, null, "action content", payload);
        final var issue = invokeHideSection(build(), rule(), a);
        /* The fallback hideIssue returns a PROGRAM_RULE_HIDESECTION
         * typed issue keyed on the DE/TEA. */
        assertThat(issue).isNotNull();
        assertThat(issue.fieldRef()).isEqualTo("DEfallback12");
    }

    @Test
    void createEventReadsBareStringPayloadRef() throws Exception {
        final JsonNode payload = mapper.readTree(
                "{\"programStage\":\"STGbare12345\"}");
        final var issue = invokeCreateEvent(build(), rule(), action("CREATEEVENT", payload));
        assertThat(issue).isNotNull();
        assertThat(issue.code()).isEqualTo("PROGRAM_RULE_CREATEEVENT");
        assertThat(issue.fieldRef()).isEqualTo("STGbare12345");
        assertThat(issue.message()).contains("STGbare12345");
    }

    @Test
    void createEventReadsNestedObjectPayloadRef() throws Exception {
        final JsonNode payload = mapper.readTree(
                "{\"programStage\":{\"id\":\"STGnest12345\"}}");
        final var issue = invokeCreateEvent(build(), rule(), action("CREATEEVENT", payload));
        assertThat(issue).isNotNull();
        assertThat(issue.fieldRef()).isEqualTo("STGnest12345");
    }

    private ProgressiveValidator.Issue invokeDisplay(final ProgramRuleEvaluator ev,
                                                       final MirroredProgramRule r,
                                                       final MirroredProgramRuleAction a) throws Exception {
        final Method m = ProgramRuleEvaluator.class.getDeclaredMethod(
                "displayIssue", UUID.class, MirroredProgramRule.class,
                MirroredProgramRuleAction.class);
        m.setAccessible(true);
        return (ProgressiveValidator.Issue) m.invoke(ev, UUID.randomUUID(), r, a);
    }

    @Test
    void displayTextEmitsInfoIssueWithContent() throws Exception {
        final JsonNode payload = mapper.createObjectNode();
        final var a = new MirroredProgramRuleAction("actUid", "ruleUid",
                "DISPLAYTEXT", null, null, null,
                "Report cases weekly even if zero", payload);
        final var issue = invokeDisplay(build(), rule(), a);
        assertThat(issue).isNotNull();
        assertThat(issue.code()).isEqualTo("PROGRAM_RULE_DISPLAYTEXT");
        assertThat(issue.severity()).isEqualTo(ProgressiveValidator.Severity.INFO);
        assertThat(issue.message()).contains("Report cases weekly");
    }

    @Test
    void displayKeyValuePairEmitsInfoIssue() throws Exception {
        final JsonNode payload = mapper.createObjectNode();
        final var a = new MirroredProgramRuleAction("actUid", "ruleUid",
                "DISPLAYKEYVALUEPAIR", "DE_target_12", null, null,
                "Last immunisation date", payload);
        final var issue = invokeDisplay(build(), rule(), a);
        assertThat(issue).isNotNull();
        assertThat(issue.code()).isEqualTo("PROGRAM_RULE_DISPLAYKEYVALUEPAIR");
        assertThat(issue.fieldRef()).isEqualTo("DE_target_12");
    }

    @Test
    void createEventWithoutRefLeavesSuggestedFieldNullButKeepsMessage() throws Exception {
        /* Central-side rule without a programStage ref — rare but
         * seen in older DHIS2 instances. Issue still emitted so the
         * operator knows the rule fired; suggestedField is null so
         * the client knows the stage is unresolved. */
        final JsonNode payload = mapper.createObjectNode();
        final var issue = invokeCreateEvent(build(), rule(), action("CREATEEVENT", payload));
        assertThat(issue).isNotNull();
        assertThat(issue.fieldRef()).isNull();
        assertThat(issue.message()).contains("follow-up event");
    }
}
