package ug.ac.mak.der.analytics.benchmark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class AnalyticsBenchmarkFixtureGeneratorTest {

    private JdbcTemplate jdbc;
    private AnalyticsBenchmarkFixtureGenerator gen;
    private final UUID createdBy = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        when(jdbc.batchUpdate(anyString(), anyList()))
                .thenReturn(new int[0]);
        gen = new AnalyticsBenchmarkFixtureGenerator(jdbc);
    }

    @Test
    void seedWithoutOrgUnitRejects() {
        assertThatThrownBy(() -> gen.seed(
                new AnalyticsBenchmarkFixtureGenerator.SeedRequest(
                        null, 1, 1, 1L), createdBy))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void seedPastCeilingRejects() {
        assertThatThrownBy(() -> gen.seed(
                new AnalyticsBenchmarkFixtureGenerator.SeedRequest(
                        "OU-A", 10_000, 500, 1L), createdBy))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ceiling");
    }

    @Test
    void seedWritesBatchesForTeiEnrollmentAndEvent() {
        final var result = gen.seed(
                new AnalyticsBenchmarkFixtureGenerator.SeedRequest(
                        "OU-A", 2, 3, 1L), createdBy);

        assertThat(result.teisCreated()).isEqualTo(2);
        assertThat(result.enrollmentsCreated()).isEqualTo(2);
        assertThat(result.eventsCreated()).isEqualTo(6);
        verify(jdbc).batchUpdate(
                org.mockito.ArgumentMatchers.contains(
                        "INSERT INTO der.tracked_entity"),
                anyList());
        verify(jdbc).batchUpdate(
                org.mockito.ArgumentMatchers.contains(
                        "INSERT INTO der.edge_enrollment"),
                anyList());
        verify(jdbc).batchUpdate(
                org.mockito.ArgumentMatchers.contains(
                        "INSERT INTO der.edge_tracker_event"),
                anyList());
    }

    @Test
    void cleanupDeletesByProgramUidAndTetUid() {
        when(jdbc.update(anyString(), any(Object.class)))
                .thenReturn(5);

        final var r = gen.cleanup();

        assertThat(r.eventsDeleted()).isEqualTo(5);
        assertThat(r.enrollmentsDeleted()).isEqualTo(5);
        assertThat(r.teisDeleted()).isEqualTo(5);
    }

    @Test
    void deterministicUidIsStableAndDhis2Shaped() {
        final String a = AnalyticsBenchmarkFixtureGenerator
                .deterministicUid("BENC", 1);
        final String b = AnalyticsBenchmarkFixtureGenerator
                .deterministicUid("BENC", 1);
        final String c = AnalyticsBenchmarkFixtureGenerator
                .deterministicUid("BENC", 2);
        assertThat(a).hasSize(11).matches("[A-Za-z][A-Za-z0-9]{10}");
        assertThat(a).isEqualTo(b).isNotEqualTo(c);
    }

    @Test
    void benchmarkProgramUidMatchesDhis2Shape() {
        assertThat(AnalyticsBenchmarkFixtureGenerator.BENCHMARK_PROGRAM_UID)
                .hasSize(11).matches("[A-Za-z][A-Za-z0-9]{10}");
        assertThat(AnalyticsBenchmarkFixtureGenerator.BENCHMARK_STAGE_UID)
                .hasSize(11).matches("[A-Za-z][A-Za-z0-9]{10}");
        assertThat(AnalyticsBenchmarkFixtureGenerator.BENCHMARK_TET_UID)
                .hasSize(11).matches("[A-Za-z][A-Za-z0-9]{10}");
    }
}
