package ug.ac.mak.der.dhis2emulator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class TrackerJobRetentionServiceTest {

    @Test
    void sweepDelegatesToRepoWithConfiguredRetention() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        when(repo.pruneOlderThan(14)).thenReturn(3);
        final TrackerJobRetentionService svc =
                new TrackerJobRetentionService(repo, 14);
        assertThat(svc.sweepNow()).isEqualTo(3);
        assertThat(svc.retentionDays()).isEqualTo(14);
    }

    @Test
    void dailySweepSwallowsRepoExceptions() {
        final TrackerJobRepository repo = mock(TrackerJobRepository.class);
        doThrow(new RuntimeException("db down"))
                .when(repo).pruneOlderThan(7);
        // Must not propagate — the scheduled job runs daily and a
        // transient failure shouldn't poison the next tick.
        new TrackerJobRetentionService(repo, 7).dailySweep();
        verify(repo).pruneOlderThan(7);
    }

    @Test
    void repoPruneOlderThanDeletesTerminalRowsOnly() {
        // Exercises the SQL shape — parameterised days value is
        // passed as a string for the interval cast.
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("7"))).thenReturn(5);
        final com.fasterxml.jackson.databind.ObjectMapper om =
                new com.fasterxml.jackson.databind.ObjectMapper();
        final TrackerJobRepository repo = new TrackerJobRepository(jdbc, om);
        assertThat(repo.pruneOlderThan(7)).isEqualTo(5);
        verify(jdbc).update(org.mockito.ArgumentMatchers
                .contains("status IN ('COMPLETED', 'FAILED')"), eq("7"));
    }

    @Test
    void repoPruneOlderThanClampsRetentionTo1Minimum() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("1"))).thenReturn(2);
        final TrackerJobRepository repo = new TrackerJobRepository(jdbc,
                new com.fasterxml.jackson.databind.ObjectMapper());
        assertThat(repo.pruneOlderThan(0)).isEqualTo(2);
        verify(jdbc).update(anyString(), eq("1"));
    }
}
