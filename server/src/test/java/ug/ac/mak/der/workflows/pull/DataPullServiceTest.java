package ug.ac.mak.der.workflows.pull;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.network.CentralReachabilityGate;
import ug.ac.mak.der.workflows.tracker.TrackerGraphReconciler;

class DataPullServiceTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneId.of("UTC"));

    private CentralReachabilityGate reachable() {
        return new CentralReachabilityGate(clock);
    }

    private TrackerGraphReconciler reconcilerStub() {
        final var rec = mock(TrackerGraphReconciler.class);
        when(rec.reconcile())
                .thenReturn(new TrackerGraphReconciler.ReconcileReport(0, 0));
        return rec;
    }

    private CentralReachabilityGate offline() {
        final var g = new CentralReachabilityGate(clock);
        g.observe(false);
        g.observe(false);
        return g;
    }

    @Test
    void offlineReachabilityShortCircuitsAndMarksNoCursor() {
        final DataPullCursorRepository cursors = mock(DataPullCursorRepository.class);
        final var svc = new DataPullService(cursors, offline(), clock, mock(AggregatePuller.class), mock(EventPuller.class), mock(TrackerPuller.class), reconcilerStub(), mock(ug.ac.mak.der.observability.DerMetrics.class));
        final var out = svc.pullAll("ou1");
        assertThat(out.note()).isEqualTo("skipped: central unreachable");
        assertThat(out.aggregatePulled()).isZero();
        /* The gate pause must NOT advance the cursor — any watermark
         * movement here would silently drop central changes that
         * accumulated during the outage. */
        verifyNoInteractions(cursors);
    }

    @Test
    void successfulPullAdvancesCursorForEveryEntityType() {
        final DataPullCursorRepository cursors = mock(DataPullCursorRepository.class);
        final AggregatePuller agg = mock(AggregatePuller.class);
        final EventPuller evt = mock(EventPuller.class);
        final TrackerPuller trk = mock(TrackerPuller.class);
        final var empty = new DataPullService.PullerResult(0, 0, NOW, null);
        when(agg.pull(anyString(), any())).thenReturn(empty);
        when(evt.pull(anyString(), any())).thenReturn(empty);
        when(trk.pull(anyString(), any())).thenReturn(empty);
        final var svc = new DataPullService(cursors, reachable(), clock, agg, evt, trk,
                reconcilerStub(), mock(ug.ac.mak.der.observability.DerMetrics.class));
        svc.pullAll("ou1");
        /* Service must advance each cursor with a timestamp so the
         * next tick's watermark reflects "pulled through now, no
         * new rows". */
        for (final var et : DataPullCursor.EntityType.values()) {
            verify(cursors).markSuccess(eq(et), eq("ou1"), any(Instant.class), any());
        }
    }

    @Test
    void pullerExceptionMarksFailureNotSuccess() {
        final DataPullCursorRepository cursors = mock(DataPullCursorRepository.class);
        final var svc = new DataPullService(cursors, reachable(), clock, mock(AggregatePuller.class), mock(EventPuller.class), mock(TrackerPuller.class), reconcilerStub(), mock(ug.ac.mak.der.observability.DerMetrics.class)) {
            @Override
            DataPullService.PullerResult pullOne(final DataPullCursor.EntityType entityType,
                                                    final String orgUnitUid) {
                if (entityType == DataPullCursor.EntityType.EVENT) {
                    throw new RuntimeException("central responded 502");
                }
                return new DataPullService.PullerResult(0, 0, NOW, null);
            }
        };
        svc.pullAll("ou1");
        verify(cursors).markFailure(eq(DataPullCursor.EntityType.EVENT), eq("ou1"),
                eq("central responded 502"));
        // The other entity types still succeed independently
        verify(cursors).markSuccess(eq(DataPullCursor.EntityType.AGGREGATE), anyString(),
                any(), any());
        verify(cursors).markSuccess(eq(DataPullCursor.EntityType.TRACKER), anyString(),
                any(), any());
    }

    @Test
    void outcomeAggregatesPerEntityCounters() {
        final DataPullCursorRepository cursors = mock(DataPullCursorRepository.class);
        when(cursors.findAll()).thenReturn(java.util.List.of());
        final var svc = new DataPullService(cursors, reachable(), clock, mock(AggregatePuller.class), mock(EventPuller.class), mock(TrackerPuller.class), reconcilerStub(), mock(ug.ac.mak.der.observability.DerMetrics.class)) {
            @Override
            DataPullService.PullerResult pullOne(final DataPullCursor.EntityType entityType,
                                                    final String orgUnitUid) {
                return switch (entityType) {
                    case AGGREGATE -> new DataPullService.PullerResult(5, 1, NOW, "a");
                    case EVENT     -> new DataPullService.PullerResult(3, 0, NOW, "b");
                    case TRACKER   -> new DataPullService.PullerResult(2, 2, NOW, "c");
                };
            }
        };
        final var out = svc.pullAll("ou1");
        assertThat(out.aggregatePulled()).isEqualTo(5);
        assertThat(out.eventsPulled()).isEqualTo(3);
        assertThat(out.trackerPulled()).isEqualTo(2);
        assertThat(out.conflictsRaised()).isEqualTo(3);
        assertThat(out.note()).isNull();
    }
}
