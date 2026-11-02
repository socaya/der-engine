package ug.ac.mak.der.network;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class CentralReachabilityGateTest {

    private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");
    private final Clock fixed = Clock.fixed(NOW, ZoneId.of("UTC"));

    @Test
    void initialStateIsReachable() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        assertThat(g.state()).isEqualTo(CentralReachabilityGate.State.REACHABLE);
        assertThat(g.shouldDrain()).isTrue();
    }

    @Test
    void oneFailureDropsToDegraded() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        g.observe(false);
        assertThat(g.state()).isEqualTo(CentralReachabilityGate.State.DEGRADED);
        // DEGRADED still drains optimistically — only OFFLINE pauses.
        assertThat(g.shouldDrain()).isTrue();
    }

    @Test
    void twoConsecutiveFailuresTripOffline() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        g.observe(false);
        g.observe(false);
        assertThat(g.state()).isEqualTo(CentralReachabilityGate.State.OFFLINE);
        assertThat(g.shouldDrain()).isFalse();
    }

    @Test
    void oneSuccessFromOfflineReturnsToDegraded() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        g.observe(false);
        g.observe(false);
        g.observe(true);
        assertThat(g.state()).isEqualTo(CentralReachabilityGate.State.DEGRADED);
        // Draining resumes immediately once we see a single successful
        // probe — the "warm-up" fully is complete after the next good
        // observation.
        assertThat(g.shouldDrain()).isTrue();
    }

    @Test
    void secondSuccessFromDegradedPromotesToReachable() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        g.observe(false);
        g.observe(true);
        assertThat(g.state()).isEqualTo(CentralReachabilityGate.State.REACHABLE);
    }

    @Test
    void successFromReachableIsIdempotent() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        final var before = g.current();
        g.observe(true);
        final var after = g.current();
        assertThat(after.state()).isEqualTo(CentralReachabilityGate.State.REACHABLE);
        // consecutive-success counter still ticks for the status chip
        assertThat(after.consecutiveSuccess()).isEqualTo(1);
        assertThat(after.since()).isEqualTo(before.since());
    }

    @Test
    void transitionTimestampUpdatesOnlyOnChange() {
        final CentralReachabilityGate g = new CentralReachabilityGate(fixed);
        final Instant t0 = g.current().since();
        g.observe(true);
        g.observe(true);
        assertThat(g.current().since()).isEqualTo(t0); // no state change
        g.observe(false); // REACHABLE -> DEGRADED
        assertThat(g.current().since()).isEqualTo(NOW);
    }
}
