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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class MetadataMirrorRepositoryTest {

    private final ObjectMapper json = new ObjectMapper();
    private final JsonNode empty = json.createObjectNode();

    private MetadataMirrorRepository repo(final JdbcTemplate jdbc) {
        return new MetadataMirrorRepository(jdbc, json);
    }

    // -------- organisation units --------

    @Test
    void upsertsEachOrganisationUnit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final int n = repo(jdbc).upsertOrganisationUnits(List.of(
                new MirroredOrganisationUnit("a", "A", "/root/a", 2, "root", empty),
                new MirroredOrganisationUnit("b", "B", null, null, null, empty)
        ), 42L);
        assertThat(n).isEqualTo(2);
        verify(jdbc).update(anyString(), eq("a"), eq("A"), eq("/root/a"), eq(2), eq("root"), anyString(), eq(42L));
        verify(jdbc).update(anyString(), eq("b"), eq("B"), eq((Object) null), eq((Object) null), eq((Object) null),
                anyString(), eq(42L));
    }

    @Test
    void findAllOrganisationUnitsOrdersByDisplayName() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        repo(jdbc).findAllOrganisationUnits();
        final ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class));
        assertThat(sql.getValue()).contains("ORDER BY display_name");
    }

    @Test
    void findOrganisationUnitEmptyOnMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("x")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(repo(jdbc).findOrganisationUnit("x")).isEmpty();
    }

    @Test
    void organisationUnitMapperReadsRow() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("a");
        when(rs.getString("display_name")).thenReturn("A");
        when(rs.getString("path")).thenReturn("/root/a");
        when(rs.getObject("level")).thenReturn(2);
        when(rs.getString("parent_uid")).thenReturn("root");
        when(rs.getString("payload")).thenReturn("{\"id\":\"a\"}");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("a")))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var ou = repo(jdbc).findOrganisationUnit("a").orElseThrow();
        assertThat(ou.dhis2Uid()).isEqualTo("a");
        assertThat(ou.level()).isEqualTo(2);
    }

    // -------- data elements / data sets / programs / tracked entity types (abbreviated branches) --------

    @Test
    void upsertsDataElements() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final int n = repo(jdbc).upsertDataElements(List.of(
                new MirroredDataElement("d1", "D1", "NUMBER", "AGGREGATE", empty)), 7L);
        assertThat(n).isEqualTo(1);
    }

    @Test
    void upsertsDataSets() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        assertThat(repo(jdbc).upsertDataSets(List.of(new MirroredDataSet("ds", "DS", "Monthly", empty)), 7L))
                .isEqualTo(1);
    }

    @Test
    void upsertsPrograms() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        assertThat(repo(jdbc).upsertPrograms(List.of(
                new MirroredProgram("p", "P", "WITH_REGISTRATION", "tet", empty)), 7L)).isEqualTo(1);
    }

    @Test
    void upsertsTrackedEntityTypes() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        assertThat(repo(jdbc).upsertTrackedEntityTypes(
                List.of(new MirroredTrackedEntityType("t", "T", empty)), 7L)).isEqualTo(1);
    }

    @Test
    void findAllOtherEntitiesPassThrough() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class))).thenReturn(List.of());
        assertThat(repo(jdbc).findAllDataElements()).isEmpty();
        assertThat(repo(jdbc).findAllDataSets()).isEmpty();
        assertThat(repo(jdbc).findAllPrograms()).isEmpty();
        assertThat(repo(jdbc).findAllTrackedEntityTypes()).isEmpty();
    }

    @Test
    void findByIdOtherEntitiesEmptyOnMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("x")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(repo(jdbc).findDataElement("x")).isEmpty();
        assertThat(repo(jdbc).findDataSet("x")).isEmpty();
        assertThat(repo(jdbc).findProgram("x")).isEmpty();
        assertThat(repo(jdbc).findTrackedEntityType("x")).isEmpty();
    }

    @Test
    void mappersPopulateForEveryEntity() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("x");
        when(rs.getString("display_name")).thenReturn("X");
        when(rs.getString("value_type")).thenReturn("NUMBER");
        when(rs.getString("domain_type")).thenReturn("AGGREGATE");
        when(rs.getString("period_type")).thenReturn("Monthly");
        when(rs.getString("program_type")).thenReturn("WITH_REGISTRATION");
        when(rs.getString("tracked_entity_type_uid")).thenReturn("tet");
        when(rs.getString("payload")).thenReturn("{\"id\":\"x\"}");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("x")))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        assertThat(repo(jdbc).findDataElement("x")).isPresent();
        assertThat(repo(jdbc).findDataSet("x")).isPresent();
        assertThat(repo(jdbc).findProgram("x")).isPresent();
        assertThat(repo(jdbc).findTrackedEntityType("x")).isPresent();
    }

    // -------- JSON serde error paths --------

    @Test
    void writeJsonFailureSurfaces() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") { });
        final var repo = new MetadataMirrorRepository(jdbc, broken);
        assertThatThrownBy(() -> repo.upsertDataElements(
                List.of(new MirroredDataElement("x", "X", "T", "AGGREGATE", empty)), 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("serialise");
    }

    @Test
    void readJsonFailureSurfaces() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.readTree(anyString())).thenThrow(new JsonProcessingException("bad") { });
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getString("dhis2_uid")).thenReturn("x");
        when(rs.getString("display_name")).thenReturn("X");
        when(rs.getString("payload")).thenReturn("junk");
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("x")))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var repo = new MetadataMirrorRepository(jdbc, broken);
        assertThatThrownBy(() -> repo.findTrackedEntityType("x"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("parse");
    }
}
