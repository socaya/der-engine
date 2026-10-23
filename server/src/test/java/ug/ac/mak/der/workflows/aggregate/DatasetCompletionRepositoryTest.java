package ug.ac.mak.der.workflows.aggregate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class DatasetCompletionRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    @Test
    void upsertHitsOnConflictClause() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any(Timestamp.class)))
                .thenReturn(1);
        final var r = new DatasetCompletionRepository(jdbc).upsert(
                "ds1", "ou1", "202604", null, true, UUID.randomUUID(), NOW);
        assertThat(r.completed()).isTrue();
        assertThat(r.aoc()).isEqualTo(DatasetCompletionRepository.DEFAULT_AOC);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("ON CONFLICT"),
                any(), any(), any(), any(), any(), any(), any(Timestamp.class));
    }

    @Test
    void findMissReturnsEmpty() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), any(RowMapper.class), eq("ds"), eq("ou"), eq("p"), eq("a")))
                .thenThrow(new EmptyResultDataAccessException(1));
        assertThat(new DatasetCompletionRepository(jdbc).find("ds", "ou", "p", "a")).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    void listByOrgUnitDelegates() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), eq("ou"))).thenReturn(List.of());
        assertThat(new DatasetCompletionRepository(jdbc).listByOrgUnit("ou")).isEmpty();
        assertThat(new DatasetCompletionRepository(jdbc).listByOrgUnit(null)).isEmpty();
    }
}
