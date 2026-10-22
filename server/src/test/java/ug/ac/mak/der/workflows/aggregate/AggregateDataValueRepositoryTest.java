package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class AggregateDataValueRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

    private AggregateDataValue sample() {
        return new AggregateDataValue(
                UUID.randomUUID(), "de", "ou", "2026Q1", "coc", "aoc", "1", "note",
                UUID.randomUUID(), NOW, 1);
    }

    @Test
    void upsertUsesReturningClause() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final AggregateDataValue in = sample();
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any())).thenReturn(in);
        final AggregateDataValueRepository repo = new AggregateDataValueRepository(jdbc);
        final AggregateDataValue out = repo.upsert(in);
        assertThat(out).isEqualTo(in);
        final ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForObject(sql.capture(), any(RowMapper.class),
                any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        assertThat(sql.getValue()).contains("ON CONFLICT").contains("RETURNING");
    }

    @Test
    void findByIdEmptyOnMiss() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new AggregateDataValueRepository(jdbc).findById(UUID.randomUUID())).isEmpty();
    }

    @Test
    void findByIdHydratesRowFromResultSet() throws Exception {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        final ResultSet rs = mock(ResultSet.class);
        when(rs.getObject("value_id", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getString("data_element_uid")).thenReturn("de");
        when(rs.getString("org_unit_uid")).thenReturn("ou");
        when(rs.getString("period_iso")).thenReturn("2026Q1");
        when(rs.getString("category_option_combo_uid")).thenReturn("coc");
        when(rs.getString("attribute_option_combo_uid")).thenReturn("aoc");
        when(rs.getString("value_text")).thenReturn("1");
        when(rs.getString("comment")).thenReturn("note");
        when(rs.getObject("submitted_by", UUID.class)).thenReturn(UUID.randomUUID());
        when(rs.getTimestamp("submitted_at")).thenReturn(Timestamp.from(NOW));
        when(rs.getInt("value_version")).thenReturn(2);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), any(UUID.class)))
                .thenAnswer(inv -> ((RowMapper<?>) inv.getArgument(1)).mapRow(rs, 1));
        final var opt = new AggregateDataValueRepository(jdbc).findById(UUID.randomUUID());
        assertThat(opt).isPresent();
        assertThat(opt.get().valueVersion()).isEqualTo(2);
    }

    @Test
    void existsByIdReflectsCount() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(UUID.class)))
                .thenReturn(0, 2, null);
        final AggregateDataValueRepository repo = new AggregateDataValueRepository(jdbc);
        final UUID id = UUID.randomUUID();
        assertThat(repo.existsById(id)).isFalse();
        assertThat(repo.existsById(id)).isTrue();
        assertThat(repo.existsById(id)).isFalse();
    }

    @Test
    void findRecentByUserCapsLimit() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class), anyInt()))
                .thenReturn(List.of());
        new AggregateDataValueRepository(jdbc).findRecentByUser(UUID.randomUUID(), 10_000);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(UUID.class), cap.capture());
        assertThat(cap.getValue()).isEqualTo(100);
    }

    @Test
    void findRecentByUserFloorsAtOne() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(UUID.class), anyInt()))
                .thenReturn(List.of());
        new AggregateDataValueRepository(jdbc).findRecentByUser(UUID.randomUUID(), 0);
        final ArgumentCaptor<Integer> cap = ArgumentCaptor.forClass(Integer.class);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(UUID.class), cap.capture());
        assertThat(cap.getValue()).isEqualTo(1);
    }

    @Test
    void findByFilterWithOrgUnitAndPeriod() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AggregateDataValueRepository(jdbc).findByFilter("ou1", "2026Q1", 50);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void findByFilterWithoutFilters() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AggregateDataValueRepository(jdbc).findByFilter(null, null, 10_000);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }

    @Test
    void findByFilterWithBlankFilters() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        new AggregateDataValueRepository(jdbc).findByFilter("", "", 0);
        verify(jdbc).query(anyString(), any(RowMapper.class), any(Object[].class));
    }
}
