package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;

class ExtendedMirrorRepositoryTest {

    private final ObjectMapper m = new ObjectMapper();

    @Test
    void upsertCategoryOptionCombos() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        final int n = repo.upsertCategoryOptionCombos(List.of(new MirroredCategoryOptionCombo(
                "u", "name", "cc", m.createObjectNode())), 1L);
        assertThat(n).isEqualTo(1);
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void categoryOptionComboExists() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("u"))).thenReturn(1);
        assertThat(new ExtendedMirrorRepository(jdbc, m).categoryOptionComboExists("u")).isTrue();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("v"))).thenReturn(0);
        assertThat(new ExtendedMirrorRepository(jdbc, m).categoryOptionComboExists("v")).isFalse();
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("w"))).thenReturn(null);
        assertThat(new ExtendedMirrorRepository(jdbc, m).categoryOptionComboExists("w")).isFalse();
    }

    @Test
    void upsertProgramStagesWritesDataElementRows() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        repo.upsertProgramStages(List.of(new MirroredProgramStage("ps", "p", "d", true,
                List.of(new MirroredProgramStage.ProgramStageDataElement("de1", true, 1),
                        new MirroredProgramStage.ProgramStageDataElement("de2", false, 2)),
                m.createObjectNode())), 1L);
        // 1 stage upsert + 1 delete + 2 inserts = 4 updates
        verify(jdbc, org.mockito.Mockito.atLeast(4)).update(anyString(), any(Object[].class));
    }

    @Test
    void upsertProgramStagesHandlesNullDataElements() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        repo.upsertProgramStages(List.of(new MirroredProgramStage("ps", "p", "d", false,
                List.of(), m.createObjectNode())), 1L);
    }

    @Test
    void findProgramStageMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("x")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new ExtendedMirrorRepository(jdbc, m).findProgramStage("x")).isEmpty();
    }

    @Test
    void findProgramStageHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("ps1");
        when(rs.getString("program_uid")).thenReturn("prog");
        when(rs.getString("display_name")).thenReturn("visit");
        when(rs.getBoolean("repeatable")).thenReturn(true);
        when(rs.getString("payload")).thenReturn("{}");
        final ArgumentCaptor<RowMapper<MirroredProgramStage>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq("ps1")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new ExtendedMirrorRepository(jdbc, m).findProgramStage("ps1"))
                .get().extracting(MirroredProgramStage::displayName).isEqualTo("visit");
    }

    @Test
    void findProgramStageDataElements() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("ps1"))).thenReturn(List.of());
        assertThat(new ExtendedMirrorRepository(jdbc, m).findProgramStageDataElements("ps1"))
                .isEmpty();
    }

    @Test
    void upsertTrackedEntityAttributes() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        repo.upsertTrackedEntityAttributes(List.of(new MirroredTrackedEntityAttribute(
                "t", "name", "TEXT", true, m.createObjectNode())), 1L);
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void findTrackedEntityAttributeMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("t")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new ExtendedMirrorRepository(jdbc, m).findTrackedEntityAttribute("t")).isEmpty();
    }

    @Test
    void findTrackedEntityAttributeHit() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("t");
        when(rs.getString("display_name")).thenReturn("name");
        when(rs.getString("value_type")).thenReturn("TEXT");
        when(rs.getBoolean("unique_attribute")).thenReturn(true);
        when(rs.getString("payload")).thenReturn("{}");
        final ArgumentCaptor<RowMapper<MirroredTrackedEntityAttribute>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq("t")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new ExtendedMirrorRepository(jdbc, m).findTrackedEntityAttribute("t"))
                .isPresent();
    }

    @Test
    void upsertProgramRulesWritesActionRows() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        repo.upsertProgramRules(List.of(new MirroredProgramRule("r1", "p", "n", 10, "c",
                List.of(new MirroredProgramRuleAction("a1", "r1", "ASSIGN", "de", null, "e", "co",
                        m.createObjectNode())),
                m.createObjectNode())), 1L);
    }

    @Test
    void findRulesByProgramHydratesActions() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final MirroredProgramRule bareRule = new MirroredProgramRule("r1", "p", "n", 10, "c",
                List.of(), m.createObjectNode());
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p"))).thenReturn(
                new java.util.ArrayList<>(List.of(bareRule)));
        when(jdbc.query(anyString(), any(RowMapper.class), eq("r1"))).thenReturn(List.of(
                new MirroredProgramRuleAction("a1", "r1", "ASSIGN", "de", null, "e", "co",
                        m.createObjectNode())));
        final var rules = new ExtendedMirrorRepository(jdbc, m).findRulesByProgram("p");
        assertThat(rules).hasSize(1);
        assertThat(rules.get(0).actions()).hasSize(1);
    }

    @Test
    void writeJsonHandlesFailure() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") { });
        assertThatThrownBy(() -> new ExtendedMirrorRepository(jdbc, broken)
                .upsertCategoryOptionCombos(List.of(new MirroredCategoryOptionCombo(
                        "u", "n", null, m.createObjectNode())), 1L))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void readJsonHandlesNullString() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("ps");
        when(rs.getString("program_uid")).thenReturn("p");
        when(rs.getString("display_name")).thenReturn("n");
        when(rs.getBoolean("repeatable")).thenReturn(false);
        when(rs.getString("payload")).thenReturn(null);
        final ArgumentCaptor<RowMapper<MirroredProgramStage>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq("ps")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThat(new ExtendedMirrorRepository(jdbc, m).findProgramStage("ps")).isPresent();
    }

    @Test
    void readJsonHandlesBadJson() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.createObjectNode()).thenReturn(m.createObjectNode());
        when(broken.readTree(anyString()))
                .thenThrow(new com.fasterxml.jackson.core.JsonProcessingException("boom") { });
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("ps");
        when(rs.getString("program_uid")).thenReturn("p");
        when(rs.getString("display_name")).thenReturn("n");
        when(rs.getBoolean("repeatable")).thenReturn(false);
        when(rs.getString("payload")).thenReturn("{garbage}");
        final ArgumentCaptor<RowMapper<MirroredProgramStage>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.queryForObject(anyString(), cap.capture(), eq("ps")))
                .thenAnswer(inv -> cap.getValue().mapRow(rs, 1));
        assertThatThrownBy(() -> new ExtendedMirrorRepository(jdbc, broken)
                .findProgramStage("ps"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void findProgramStageDataElementsRowMapperCovered() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("data_element_uid")).thenReturn("de1");
        when(rs.getBoolean("compulsory")).thenReturn(true);
        when(rs.getObject("sort_order")).thenReturn(1);
        final ArgumentCaptor<RowMapper<MirroredProgramStage.ProgramStageDataElement>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.query(anyString(), cap.capture(), eq("ps1")))
                .thenAnswer(inv -> {
                    cap.getValue().mapRow(rs, 1);
                    return List.of();
                });
        new ExtendedMirrorRepository(jdbc, m).findProgramStageDataElements("ps1");
    }
}
