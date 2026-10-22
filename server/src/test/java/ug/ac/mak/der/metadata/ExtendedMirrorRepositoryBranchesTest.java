package ug.ac.mak.der.metadata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ExtendedMirrorRepositoryBranchesTest {

    private final ObjectMapper m = new ObjectMapper();

    @Test
    void writeJsonHandlesNullPayload() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ExtendedMirrorRepository repo = new ExtendedMirrorRepository(jdbc, m);
        repo.upsertCategoryOptionCombos(List.of(new MirroredCategoryOptionCombo(
                "u", "n", null, m.createObjectNode())), 1L);
    }

    @Test
    void readMapperExposesAllRowShape() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("r1");
        when(rs.getString("program_uid")).thenReturn("p");
        when(rs.getString("display_name")).thenReturn("rule");
        when(rs.getObject("priority")).thenReturn(10);
        when(rs.getString("condition")).thenReturn("true");
        when(rs.getString("payload")).thenReturn("{}");
        final MirroredProgramRule bare = new MirroredProgramRule("r1", "p", "rule", 10, "true",
                List.of(), m.createObjectNode());
        when(jdbc.query(anyString(), any(RowMapper.class), eq("p")))
                .thenReturn(new java.util.ArrayList<>(List.of(bare)));
        final ResultSet rs2 = mock(ResultSet.class);
        when(rs2.getString("dhis2_uid")).thenReturn("a1");
        when(rs2.getString("program_rule_uid")).thenReturn("r1");
        when(rs2.getString("action_type")).thenReturn("ASSIGN");
        when(rs2.getString("data_element_uid")).thenReturn("de");
        when(rs2.getString("tracked_entity_attribute_uid")).thenReturn(null);
        when(rs2.getString("data_expression")).thenReturn("1");
        when(rs2.getString("content")).thenReturn(null);
        when(rs2.getString("payload")).thenReturn("{}");
        final ArgumentCaptor<RowMapper<MirroredProgramRuleAction>> cap =
                ArgumentCaptor.forClass(RowMapper.class);
        when(jdbc.query(anyString(), cap.capture(), eq("r1")))
                .thenAnswer(inv -> List.of(cap.getValue().mapRow(rs2, 1)));
        final var rules = new ExtendedMirrorRepository(jdbc, m).findRulesByProgram("p");
        assertThat(rules.get(0).actions()).hasSize(1);
    }
}
