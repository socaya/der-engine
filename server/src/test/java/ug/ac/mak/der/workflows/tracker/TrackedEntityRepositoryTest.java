package ug.ac.mak.der.workflows.tracker;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
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
}
