package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class Phase036bRecordsTest {

    private final ObjectMapper m = new ObjectMapper();

    private ObjectNode payload() {
        return m.createObjectNode();
    }

    @Test
    void categoryOptionComboRecord() {
        final MirroredCategoryOptionCombo coc = new MirroredCategoryOptionCombo(
                "uid1", "default", "ccUid", payload());
        assertThat(coc.dhis2Uid()).isEqualTo("uid1");
        assertThat(coc.displayName()).isEqualTo("default");
        assertThat(coc.categoryComboUid()).isEqualTo("ccUid");
        assertThat(coc.payload()).isNotNull();
    }

    @Test
    void categoryOptionComboRejectsNulls() {
        assertThatThrownBy(() -> new MirroredCategoryOptionCombo(null, "d", "c", payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredCategoryOptionCombo("u", null, "c", payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredCategoryOptionCombo("u", "d", "c", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void programStageWithDataElements() {
        final MirroredProgramStage ps = new MirroredProgramStage("ps1", "prog", "visit",
                true,
                List.of(new MirroredProgramStage.ProgramStageDataElement("de1", true, 1),
                        new MirroredProgramStage.ProgramStageDataElement("de2", false, 2)),
                payload());
        assertThat(ps.dataElements()).hasSize(2);
        assertThat(ps.repeatable()).isTrue();
        assertThat(ps.dataElements().get(0).compulsory()).isTrue();
        assertThat(ps.dataElements().get(0).sortOrder()).isEqualTo(1);
    }

    @Test
    void programStageNullDataElementsAcceptedAsEmpty() {
        final MirroredProgramStage ps = new MirroredProgramStage("ps1", "prog", "visit", false,
                null, payload());
        assertThat(ps.dataElements()).isEmpty();
    }

    @Test
    void programStageRejectsNulls() {
        assertThatThrownBy(() -> new MirroredProgramStage(null, "p", "d", false, List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramStage("u", null, "d", false, List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramStage("u", "p", null, false, List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramStage("u", "p", "d", false, List.of(), null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void programStageDataElementRejectsNullUid() {
        assertThatThrownBy(() -> new MirroredProgramStage.ProgramStageDataElement(null, false, 1))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void trackedEntityAttribute() {
        final MirroredTrackedEntityAttribute tea = new MirroredTrackedEntityAttribute(
                "tea1", "name", "TEXT", true, payload());
        assertThat(tea.valueType()).isEqualTo("TEXT");
        assertThat(tea.uniqueAttribute()).isTrue();
    }

    @Test
    void trackedEntityAttributeRejectsNulls() {
        assertThatThrownBy(() -> new MirroredTrackedEntityAttribute(null, "n", "T", false, payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredTrackedEntityAttribute("u", null, "T", false, payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredTrackedEntityAttribute("u", "n", null, false, payload()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void programRuleRecord() {
        final MirroredProgramRule rule = new MirroredProgramRule("r1", "prog", "name", 10,
                "#{a.b} > 0", List.of(), payload());
        assertThat(rule.priority()).isEqualTo(10);
        assertThat(rule.condition()).isEqualTo("#{a.b} > 0");
        assertThat(rule.actions()).isEmpty();
    }

    @Test
    void programRuleRejectsNulls() {
        assertThatThrownBy(() -> new MirroredProgramRule(null, "p", "n", 1, "c", List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramRule("u", null, "n", 1, "c", List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramRule("u", "p", null, 1, "c", List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramRule("u", "p", "n", 1, null, List.of(), payload()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void programRuleNullActionsAcceptedAsEmpty() {
        final MirroredProgramRule r = new MirroredProgramRule("r", "p", "n", null, "c",
                null, payload());
        assertThat(r.actions()).isEmpty();
        assertThat(r.priority()).isNull();
    }

    @Test
    void programRuleActionDisplayName() {
        final MirroredProgramRuleAction a = new MirroredProgramRuleAction(
                "a1", "r1", "ASSIGN", "de1", null, "1+1", "content", payload());
        assertThat(a.displayName()).isEqualTo("ASSIGN");
    }

    @Test
    void programRuleActionRejectsNulls() {
        assertThatThrownBy(() -> new MirroredProgramRuleAction(null, "r", "A", "d", null, "e", "c", payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramRuleAction("a", null, "A", "d", null, "e", "c", payload()))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MirroredProgramRuleAction("a", "r", null, "d", null, "e", "c", payload()))
                .isInstanceOf(NullPointerException.class);
    }
}
