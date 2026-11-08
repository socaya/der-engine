package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class TrackedEntityRepositoryTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private static final Instant NOW = Instant.parse("2026-10-23T00:00:00Z");

    private TrackedEntityRepository.TrackedEntity sample() {
        return new TrackedEntityRepository.TrackedEntity(
                "T1", "PERSON", "ou1", Map.of("firstName", "Alice"),
                null, NOW, NOW, 1);
    }

    @Test
    void upsertEmitsOnConflict() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(1);
        final var repo = new TrackedEntityRepository(jdbc, mapper);
        assertThat(repo.upsert(sample()).teiUid()).isEqualTo("T1");
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchComposesFilters() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        final var repo = new TrackedEntityRepository(jdbc, mapper);
        assertThat(repo.search("PERSON", "ou1", Map.of("k", "v"), 10)).isEmpty();
        assertThat(repo.search(null, null, null, 10_000)).isEmpty();
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchWithProgramJoinsEdgeEnrollment() {
        // DHIS2 /api/tracker/trackedEntities?program=X parity — the
        // SQL must INNER JOIN edge_enrollment on the supplied
        // program UID so TEIs are isolated per program even when
        // multiple programs share the same tracked-entity type.
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        final var repo = new TrackedEntityRepository(jdbc, mapper);

        repo.search("PERSON", "ou1", null, 10, "PROG_A");

        final ArgumentCaptor<String> sqlCap = ArgumentCaptor.forClass(String.class);
        final ArgumentCaptor<Object[]> argsCap = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).query(sqlCap.capture(), any(RowMapper.class),
                argsCap.capture());
        final String sql = sqlCap.getValue();
        assertThat(sql).contains("INNER JOIN der.edge_enrollment");
        assertThat(sql).contains("e.program_uid = ?");
        assertThat(sql).contains("DISTINCT t.tei_uid");
        // Program UID is the leading arg because the join clause comes first.
        assertThat(argsCap.getValue()[0]).isEqualTo("PROG_A");
    }

    @SuppressWarnings("unchecked")
    @Test
    void searchWithoutProgramKeepsFlatQuery() {
        // No program filter → classic tracked_entity-only SQL, no join.
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of());
        final var repo = new TrackedEntityRepository(jdbc, mapper);

        repo.search("PERSON", "ou1", null, 10, null);

        final ArgumentCaptor<String> sqlCap = ArgumentCaptor.forClass(String.class);
        verify(jdbc).query(sqlCap.capture(), any(RowMapper.class),
                any(Object[].class));
        assertThat(sqlCap.getValue())
                .doesNotContain("edge_enrollment")
                .doesNotContain("DISTINCT");
    }
}
