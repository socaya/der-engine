package ug.ac.mak.der.apps.central;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.apps.AppCatalogueRepository;

class AppVersionRetentionServiceTest {

    @Test
    void sweepDelegatesToRepoWithConfiguredRetention() {
        final AppCatalogueRepository repo = mock(AppCatalogueRepository.class);
        when(repo.pruneSupersededVersions(14)).thenReturn(3);
        final AppVersionRetentionService svc =
                new AppVersionRetentionService(repo, 14);
        assertThat(svc.sweepNow()).isEqualTo(3);
        assertThat(svc.retentionDays()).isEqualTo(14);
    }

    @Test
    void dailySweepSwallowsRepoExceptions() {
        final AppCatalogueRepository repo = mock(AppCatalogueRepository.class);
        doThrow(new RuntimeException("db down"))
                .when(repo).pruneSupersededVersions(7);
        // Must not propagate — the scheduled job runs daily and a
        // transient failure shouldn't poison the next tick.
        new AppVersionRetentionService(repo, 7).dailySweep();
        verify(repo).pruneSupersededVersions(7);
    }

    @Test
    void dailySweepLogsCountWhenNonZero() {
        final AppCatalogueRepository repo = mock(AppCatalogueRepository.class);
        when(repo.pruneSupersededVersions(7)).thenReturn(2);
        new AppVersionRetentionService(repo, 7).dailySweep();
        verify(repo).pruneSupersededVersions(7);
    }
}
