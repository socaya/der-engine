package ug.ac.mak.der.scheduler;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.quartz.JobExecutionException;

import ug.ac.mak.der.workflows.backup.BackupWorker;
import ug.ac.mak.der.workflows.backup.RestoreWorker;

class BackupDrainJobTest {

    private BackupDrainJob job(final BackupWorker backup, final RestoreWorker restore,
                                 final ScheduledJobRepository runs) throws Exception {
        final BackupDrainJob j = new BackupDrainJob();
        set(j, "backup", backup);
        set(j, "restore", restore);
        set(j, "runs", runs);
        set(j, "mapper", new ObjectMapper());
        return j;
    }

    private void set(final Object target, final String name, final Object value) throws Exception {
        final Field f = BackupDrainJob.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    @Test
    void successfulDrainMarksSuccess() throws Exception {
        final BackupWorker backup = mock(BackupWorker.class);
        final RestoreWorker restore = mock(RestoreWorker.class);
        final ScheduledJobRepository runs = mock(ScheduledJobRepository.class);
        when(backup.drain()).thenReturn(2);
        when(restore.drain()).thenReturn(1);
        when(runs.insertStart(eq(BackupDrainJob.JOB_NAME), eq("SCHEDULED"))).thenReturn(42L);

        job(backup, restore, runs).execute(null);
        verify(runs).markSuccess(eq(42L), anyLong(), contains("backupsProcessed"));
    }

    @Test
    void failureReportsFailure() throws Exception {
        final BackupWorker backup = mock(BackupWorker.class);
        final RestoreWorker restore = mock(RestoreWorker.class);
        final ScheduledJobRepository runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(any(), any())).thenReturn(5L);
        when(backup.drain()).thenThrow(new RuntimeException("boom"));
        final BackupDrainJob j = job(backup, restore, runs);
        assertThatThrownBy(() -> j.execute(null)).isInstanceOf(JobExecutionException.class);
        verify(runs).markFailure(eq(5L), anyLong(), contains("boom"));
    }

    @Test
    void nullWorkersCountAsZero() throws Exception {
        final BackupDrainJob j = new BackupDrainJob();
        // All @Autowired(required=false) remain null — exercise null-safe branches.
        j.execute(null);
    }
}
