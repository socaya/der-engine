package ug.ac.mak.der.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.Test;

class RateLimiterTest {

    @Test
    void permitsWithinLimitAndRejectsAfter() {
        final RateLimiter limiter = new RateLimiter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC), Duration.ofMinutes(1));
        for (int i = 0; i < 3; i++) {
            assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "1.1.1.1", 3)).isTrue();
        }
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "1.1.1.1", 3)).isFalse();
    }

    @Test
    void slidesWindowAsTimeAdvances() {
        final AtomicLong millis = new AtomicLong(0);
        final Clock movable = new Clock() {
            @Override public long millis() { return millis.get(); }
            @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
            @Override public Clock withZone(final java.time.ZoneId zone) { return this; }
            @Override public Instant instant() { return Instant.ofEpochMilli(millis.get()); }
        };
        final RateLimiter limiter = new RateLimiter(movable, Duration.ofSeconds(10));
        for (int i = 0; i < 5; i++) {
            assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_USER, "alice", 5)).isTrue();
        }
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_USER, "alice", 5)).isFalse();
        // Advance past the window; old entries evicted.
        millis.set(20_000);
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_USER, "alice", 5)).isTrue();
    }

    @Test
    void permitsAlwaysWhenLimitIsZeroOrNegative() {
        final RateLimiter limiter = new RateLimiter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "ip", 0)).isTrue();
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "ip", -1)).isTrue();
    }

    @Test
    void permitsWhenKeyIsNull() {
        final RateLimiter limiter = new RateLimiter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, null, 1)).isTrue();
    }

    @Test
    void resetClearsBucket() {
        final RateLimiter limiter = new RateLimiter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "k", 1);
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "k", 1)).isFalse();
        limiter.reset(RateLimiter.Scope.SIGN_IN_IP, "k");
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_IP, "k", 1)).isTrue();
    }

    @Test
    void resetOfUnknownScopeIsNoOp() {
        final RateLimiter limiter = new RateLimiter(Clock.fixed(Instant.EPOCH, ZoneOffset.UTC));
        // No prior use of SIGN_IN_USER; reset must not NPE.
        limiter.reset(RateLimiter.Scope.SIGN_IN_USER, "x");
        assertThat(limiter.tryAcquire(RateLimiter.Scope.SIGN_IN_USER, "x", 1)).isTrue();
    }
}
