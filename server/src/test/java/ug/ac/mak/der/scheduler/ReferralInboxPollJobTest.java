package ug.ac.mak.der.scheduler;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

import ug.ac.mak.der.workflows.referral.ReferralInboxScanner;

class ReferralInboxPollJobTest {

    private static ReferralInboxPollJob job(final ReferralInboxScanner scanner,
                                               final ScheduledJobRepository runs,
                                               final ObjectMapper mapper) throws Exception {
        final ReferralInboxPollJob j = new ReferralInboxPollJob();
        setField(j, "scanner", scanner);
        setField(j, "runs", runs);
        setField(j, "mapper", mapper);
        return j;
    }

    private static void setField(final Object target, final String name, final Object value)
            throws Exception {
        final java.lang.reflect.Field f = target.getClass().getDeclaredField(name);
        f.setAccessible(true);
        f.set(target, value);
    }

    @Test
    void successReportsSuccess() throws Exception {
        final ReferralInboxScanner scanner = mock(ReferralInboxScanner.class);
        when(scanner.scanOnce()).thenReturn(new ReferralInboxScanner.ScanResult(
                ReferralInboxScanner.ScanResult.Outcome.OK, 3, 2));
        final ScheduledJobRepository runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(anyString(), anyString())).thenReturn(42L);
        job(scanner, runs, new ObjectMapper()).execute(mock(JobExecutionContext.class));
        verify(runs).markSuccess(eq(42L), anyLong(), contains("\"outcome\":\"OK\""));
    }

    @Test
    void nullsHandledGracefully() throws Exception {
        job(null, null, null).execute(mock(JobExecutionContext.class));
    }

    @Test
    void scannerFailurePropagates() throws Exception {
        final ReferralInboxScanner scanner = mock(ReferralInboxScanner.class);
        when(scanner.scanOnce()).thenThrow(new RuntimeException("boom"));
        final ScheduledJobRepository runs = mock(ScheduledJobRepository.class);
        when(runs.insertStart(anyString(), anyString())).thenReturn(42L);
        final ReferralInboxPollJob j = job(scanner, runs, new ObjectMapper());
        assertThatThrownBy(() -> j.execute(mock(JobExecutionContext.class)))
                .isInstanceOf(JobExecutionException.class);
        verify(runs).markFailure(eq(42L), anyLong(), anyString());
    }

    @Test
    void brokenMapperFallsBackToEmptyObject() throws Exception {
        final ReferralInboxScanner scanner = mock(ReferralInboxScanner.class);
        when(scanner.scanOnce()).thenReturn(new ReferralInboxScanner.ScanResult(
                ReferralInboxScanner.ScanResult.Outcome.OK, 1, 1));
        final ScheduledJobRepository runs = mock(ScheduledJobRepository.class);
        final ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new JsonProcessingException("x") { });
        job(scanner, runs, broken).execute(mock(JobExecutionContext.class));
        verify(runs).markSuccess(org.mockito.ArgumentMatchers.any(), anyLong(), eq("{}"));
    }
}
