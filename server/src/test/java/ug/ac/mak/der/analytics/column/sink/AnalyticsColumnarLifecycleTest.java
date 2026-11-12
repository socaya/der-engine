package ug.ac.mak.der.analytics.column.sink;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import ug.ac.mak.der.analytics.column.manifest.Manifest;

class AnalyticsColumnarLifecycleTest {

    @Test
    void publishesOnlyAfterZeroDriftVerification() throws Exception {
        final AnalyticsColumnarSink sink = mock(AnalyticsColumnarSink.class);
        final AnalyticsColumnarVerifier verifier =
                mock(AnalyticsColumnarVerifier.class);
        final AnalyticsColumnarCompactor compactor =
                mock(AnalyticsColumnarCompactor.class);
        final Manifest manifest = new Manifest(7, Instant.now(), "meta",
                Map.of("event", 12L), "test", List.of());
        final var prepared = new AnalyticsColumnarSink.PreparedFlush(manifest,
                new AnalyticsColumnarSink.FlushResult(7, 0, 4, 0L,
                        1.0, "manifest"));
        when(sink.prepare()).thenReturn(prepared);
        when(verifier.verify(manifest)).thenReturn(
                new AnalyticsColumnarVerifier.VerifyReport(
                        7, 0, 4, 4, 0, List.of()));
        when(compactor.compact()).thenReturn(
                new AnalyticsColumnarCompactor.CompactionResult(1, 2, 50L));

        final var lifecycle = new AnalyticsColumnarLifecycle(
                new AnalyticsColumnarLifecycleProperties(true, 3),
                sink, verifier, compactor);
        final var status = lifecycle.runNow();

        assertThat(status.state()).isEqualTo("PUBLISHED");
        assertThat(status.rowsVerified()).isEqualTo(4);
        verify(sink).publish(prepared);
        verify(compactor).compact();
    }

    @Test
    void rejectsAndDiscardsDriftingShadowGeneration() throws Exception {
        final AnalyticsColumnarSink sink = mock(AnalyticsColumnarSink.class);
        final AnalyticsColumnarVerifier verifier =
                mock(AnalyticsColumnarVerifier.class);
        final AnalyticsColumnarCompactor compactor =
                mock(AnalyticsColumnarCompactor.class);
        final Manifest manifest = new Manifest(8, Instant.now(), "meta",
                Map.of(), "test", List.of());
        final var prepared = new AnalyticsColumnarSink.PreparedFlush(manifest,
                new AnalyticsColumnarSink.FlushResult(8, 0, 1, 0L,
                        1.0, "manifest"));
        when(sink.prepare()).thenReturn(prepared);
        when(verifier.verify(manifest)).thenReturn(
                new AnalyticsColumnarVerifier.VerifyReport(8, 0, 1, 0, 1,
                        List.of(new AnalyticsColumnarVerifier.Drift(
                                java.util.UUID.randomUUID(), "202611", "OU",
                                "", "value drift", "1", "2"))));

        final var lifecycle = new AnalyticsColumnarLifecycle(
                new AnalyticsColumnarLifecycleProperties(true, 3),
                sink, verifier, compactor);
        final var status = lifecycle.runNow();

        assertThat(status.state()).isEqualTo("DRIFT_REJECTED");
        verify(sink).discard(prepared);
        verify(sink, never()).publish(prepared);
        verify(compactor, never()).compact();
    }

    @Test
    void discardsShadowWhenVerificationFails() throws Exception {
        final AnalyticsColumnarSink sink = mock(AnalyticsColumnarSink.class);
        final AnalyticsColumnarVerifier verifier =
                mock(AnalyticsColumnarVerifier.class);
        final AnalyticsColumnarCompactor compactor =
                mock(AnalyticsColumnarCompactor.class);
        final Manifest manifest = new Manifest(9, Instant.now(), "meta",
                Map.of(), "test", List.of());
        final var prepared = new AnalyticsColumnarSink.PreparedFlush(manifest,
                new AnalyticsColumnarSink.FlushResult(9, 0, 1, 10L,
                        1.0, "manifest"));
        when(sink.prepare()).thenReturn(prepared);
        when(verifier.verify(manifest)).thenThrow(
                new IOException("segment unreadable"));

        final var lifecycle = new AnalyticsColumnarLifecycle(
                new AnalyticsColumnarLifecycleProperties(true, 3),
                sink, verifier, compactor);
        final var status = lifecycle.runNow();

        assertThat(status.state()).isEqualTo("FAILED");
        verify(sink).discard(prepared);
        verify(sink, never()).publish(prepared);
    }

    @Test
    void keepsPublishedGenerationWhenCompactionMustRetry() throws Exception {
        final AnalyticsColumnarSink sink = mock(AnalyticsColumnarSink.class);
        final AnalyticsColumnarVerifier verifier =
                mock(AnalyticsColumnarVerifier.class);
        final AnalyticsColumnarCompactor compactor =
                mock(AnalyticsColumnarCompactor.class);
        final Manifest manifest = new Manifest(10, Instant.now(), "meta",
                Map.of(), "test", List.of());
        final var prepared = new AnalyticsColumnarSink.PreparedFlush(manifest,
                new AnalyticsColumnarSink.FlushResult(10, 0, 1, 10L,
                        1.0, "manifest"));
        when(sink.prepare()).thenReturn(prepared);
        when(verifier.verify(manifest)).thenReturn(
                new AnalyticsColumnarVerifier.VerifyReport(
                        10, 0, 1, 1, 0, List.of()));
        when(compactor.compact()).thenThrow(new IOException("disk busy"));

        final var lifecycle = new AnalyticsColumnarLifecycle(
                new AnalyticsColumnarLifecycleProperties(true, 3),
                sink, verifier, compactor);
        final var status = lifecycle.runNow();

        assertThat(status.state()).isEqualTo(
                "PUBLISHED_COMPACTION_PENDING");
        verify(sink).publish(prepared);
        verify(sink, never()).discard(prepared);
    }
}
