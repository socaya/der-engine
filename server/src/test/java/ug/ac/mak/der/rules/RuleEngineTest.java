package ug.ac.mak.der.rules;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import ug.ac.mak.der.metadata.ExtendedMirrorRepository;
import ug.ac.mak.der.metadata.MirroredProgramRule;
import ug.ac.mak.der.metadata.MirroredProgramRuleAction;

class RuleEngineTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private MirroredProgramRule rule(final String uid, final int priority, final String condition,
                                      final List<MirroredProgramRuleAction> actions) {
        return new MirroredProgramRule(uid, "prog", "rule-" + uid, priority, condition,
                actions, mapper.createObjectNode());
    }

    private MirroredProgramRuleAction action(final String type, final String deUid,
                                               final String expr, final String content) {
        return new MirroredProgramRuleAction("a-" + type, "r", type, deUid, null, expr, content,
                mapper.createObjectNode());
    }

    @Test
    void assignActionAppliesValue() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r1", 2, "true", List.of(action("ASSIGN", "deComputed", "1 + 1", null)))));
        final RuleContext ctx = RuleContext.builder().build();
        final RuleEngine engine = new RuleEngine(mirror, true, true);
        final RuleEngineResult result = engine.evaluate("prog", ctx, false, List.of());
        assertThat(result.assigned()).containsEntry("deComputed", 2.0);
        assertThat(result.rejected()).isFalse();
    }

    @Test
    void showerrorRejects() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("SHOWERROR", null, null, "bad!")))));
        final var result = new RuleEngine(mirror, true, true).evaluate("prog",
                RuleContext.builder().build(), false, List.of());
        assertThat(result.rejected()).isTrue();
        assertThat(result.errors().get(0).message()).isEqualTo("bad!");
    }

    @Test
    void warningOnCompleteOnlyFiresWhenCompleting() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("WARNINGONCOMPLETE", null, null, "nearly")))));
        final RuleEngine engine = new RuleEngine(mirror, true, true);
        assertThat(engine.evaluate("prog", RuleContext.builder().build(), false, List.of())
                .warnings()).isEmpty();
        assertThat(engine.evaluate("prog", RuleContext.builder().build(), true, List.of())
                .warnings()).hasSize(1);
    }

    @Test
    void errorOnCompleteOnlyFiresWhenCompleting() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("ERRORONCOMPLETE", null, null, "no")))));
        final RuleEngine engine = new RuleEngine(mirror, true, true);
        assertThat(engine.evaluate("prog", RuleContext.builder().build(), false, List.of())
                .rejected()).isFalse();
        assertThat(engine.evaluate("prog", RuleContext.builder().build(), true, List.of())
                .rejected()).isTrue();
    }

    @Test
    void setMandatoryFieldFailsWhenNotSubmitted() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("SETMANDATORYFIELD", "deReq", null, null)))));
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()).rejected()).isTrue();
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of("deReq"))
                .rejected()).isFalse();
    }

    @Test
    void uiOnlyActionIgnored() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("HIDEFIELD", "de", null, null)))));
        final var r = new RuleEngine(mirror, true, true).evaluate("prog",
                RuleContext.builder().build(), false, List.of());
        assertThat(r.rejected()).isFalse();
        assertThat(r.warnings()).isEmpty();
    }

    @Test
    void disabledEngineSkips() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        final var r = new RuleEngine(mirror, false, true).evaluate("prog",
                RuleContext.builder().build(), false, List.of());
        assertThat(r.rejected()).isFalse();
        assertThat(r.assigned()).isEmpty();
    }

    @Test
    void conditionFalseSkipsActions() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "false", List.of(action("SHOWERROR", null, null, "no")))));
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()).rejected())
                .isFalse();
    }

    @Test
    void strictModeRethrowsGrammarError() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "@@invalid@@", List.of())));
        assertThatThrownBy(() -> new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void lenientModeSkipsBadRule() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("rBad", 1, "@@invalid@@", List.of()),
                rule("rOk", 0, "true", List.of(action("SHOWWARNING", null, null, "ok")))));
        final var r = new RuleEngine(mirror, true, false)
                .evaluate("prog", RuleContext.builder().build(), false, List.of());
        assertThat(r.warnings()).hasSize(1);
    }

    @Test
    void lenientModeSkipsBadAssignExpression() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("ASSIGN", "de", "@@bad@@", null)))));
        final var r = new RuleEngine(mirror, true, false)
                .evaluate("prog", RuleContext.builder().build(), false, List.of());
        assertThat(r.assigned()).isEmpty();
    }

    @Test
    void strictModeRethrowsAssignGrammarError() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("ASSIGN", "de", "@@bad@@", null)))));
        assertThatThrownBy(() -> new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()))
                .isInstanceOf(RuleParseException.class);
    }

    @Test
    void showwarningFires() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("SHOWWARNING", null, null, "warn")))));
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()).warnings())
                .hasSize(1);
    }

    @Test
    void showerrorFallsBackToDisplayNameWhenContentBlank() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("SHOWERROR", null, null, "")))));
        final var r = new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of());
        assertThat(r.errors().get(0).message()).isEqualTo("rule-r");
    }

    @Test
    void assignIgnoredWhenNullTarget() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("ASSIGN", null, "1", null)))));
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()).assigned())
                .isEmpty();
    }

    @Test
    void assignIgnoredWhenNullExpression() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r", 1, "true", List.of(action("ASSIGN", "de", null, null)))));
        assertThat(new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of()).assigned())
                .isEmpty();
    }

    @Test
    void stringTruthyAndNumericCondition() {
        final ExtendedMirrorRepository mirror = mock(ExtendedMirrorRepository.class);
        when(mirror.findRulesByProgram("prog")).thenReturn(List.of(
                rule("r1", 2, "5", List.of(action("SHOWWARNING", null, null, "a"))),
                rule("r2", 1, "'hello'", List.of(action("SHOWWARNING", null, null, "b"))),
                rule("r3", 0, "''", List.of(action("SHOWWARNING", null, null, "c")))));
        final var r = new RuleEngine(mirror, true, true)
                .evaluate("prog", RuleContext.builder().build(), false, List.of());
        assertThat(r.warnings()).hasSize(2);
    }
}
