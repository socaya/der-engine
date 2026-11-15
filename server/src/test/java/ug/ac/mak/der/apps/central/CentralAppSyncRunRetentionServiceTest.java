package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class CentralAppSyncRunRetentionServiceTest {

    @Test
    void sweepDelegatesToRepoWithConfiguredRetention() {
        final CentralAppSyncRunRepository repo = mock(CentralAppSyncRunRepository.class);
        when(repo.pruneOlderThan(90)).thenReturn(4);
        final CentralAppSyncRunRetentionService svc =
                new CentralAppSyncRunRetentionService(repo, 90);
        assertThat(svc.sweepNow()).isEqualTo(4);
        assertThat(svc.retentionDays()).isEqualTo(90);
    }

    @Test
    void dailySweepSwallowsRepoExceptions() {
        final CentralAppSyncRunRepository repo = mock(CentralAppSyncRunRepository.class);
        doThrow(new RuntimeException("db down"))
                .when(repo).pruneOlderThan(90);
        new CentralAppSyncRunRetentionService(repo, 90).dailySweep();
        verify(repo).pruneOlderThan(90);
    }

    @Test
    void repoPruneOlderThanPreservesRunningRows() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("90"))).thenReturn(7);
        final CentralAppSyncRunRepository repo =
                new CentralAppSyncRunRepository(jdbc, new ObjectMapper());
        assertThat(repo.pruneOlderThan(90)).isEqualTo(7);
        // Running rows stay visible — don't prune them even if old.
        verify(jdbc).update(contains("outcome <> 'RUNNING'"), eq("90"));
    }

    @Test
    void repoPruneClampsRetentionTo1Minimum() {
        final JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.update(anyString(), eq("1"))).thenReturn(2);
        final CentralAppSyncRunRepository repo =
                new CentralAppSyncRunRepository(jdbc, new ObjectMapper());
        assertThat(repo.pruneOlderThan(-5)).isEqualTo(2);
        verify(jdbc).update(anyString(), eq("1"));
    }
}
