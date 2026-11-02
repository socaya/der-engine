package ug.ac.mak.der.scheduler;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.quartz.JobExecutionContext;
import org.quartz.JobDataMap;

import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.workflows.pull.DataPullService;

class DataPullJobTest {

    private DataPullJob build(final DataPullService pulls,
                                final OrgUnitBindingService binding,
                                final ScheduledJobRepository runs) {
        final DataPullJob job = new DataPullJob();
        inject(job, "pulls", pulls);
        inject(job, "binding", binding);
        inject(job, "runs", runs);
        inject(job, "mapper", new ObjectMapper());
        return job;
    }

    private JobExecutionContext ctx() {
        final JobExecutionContext c = mock(JobExecutionContext.class);
        when(c.getMergedJobDataMap()).thenReturn(new JobDataMap());
        return c;
    }

    @Test
    void skipsWhenNoOrgUnitBound() throws Exception {
        final var pulls = mock(DataPullService.class);
        final var binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(null);
        final var runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(anyString(), anyString())).thenReturn(1L);

        build(pulls, binding, runs).execute(ctx());

        verify(pulls, never()).pullAll(anyString());
        verify(runs).markSuccess(eq(1L), anyLong(), contains("no org-unit binding"));
    }

    @Test
    void runsPullAgainstBoundOrgUnit() throws Exception {
        final var pulls = mock(DataPullService.class);
        final var binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(new EdgeOrgUnitBinding(
                "ouX", "Facility X", "/root/ouX", null, null));
        when(pulls.pullAll("ouX"))
                .thenReturn(new DataPullService.PullOutcome("ouX", 2, 3, 4, 1, null));
        final var runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(anyString(), anyString())).thenReturn(2L);

        build(pulls, binding, runs).execute(ctx());

        verify(pulls).pullAll("ouX");
        verify(runs).markSuccess(eq(2L), anyLong(), contains("aggregatePulled"));
    }

    @Test
    void pullerExceptionIsRethrownAndRecordedAsFailure() {
        final var pulls = mock(DataPullService.class);
        final var binding = mock(OrgUnitBindingService.class);
        when(binding.current()).thenReturn(new EdgeOrgUnitBinding(
                "ouX", "Facility X", "/root/ouX", null, null));
        when(pulls.pullAll(anyString()))
                .thenThrow(new RuntimeException("central responded 502"));
        final var runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(anyString(), anyString())).thenReturn(3L);

        try {
            build(pulls, binding, runs).execute(ctx());
            throw new AssertionError("expected JobExecutionException");
        } catch (org.quartz.JobExecutionException expected) {
            // ok
        }
        verify(runs).markFailure(eq(3L), anyLong(), contains("502"));
    }

    private static void inject(final Object target, final String field, final Object value) {
        try {
            final var f = target.getClass().getDeclaredField(field);
            f.setAccessible(true);
            f.set(target, value);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }
}
