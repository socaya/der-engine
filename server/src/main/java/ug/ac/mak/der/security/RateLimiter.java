package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * In-memory sliding-window rate limiter keyed by {@link Scope}+{@link String}.
 *
 * <p>Phase 02's deployment target is a single edge node per site; a hash map
 * with per-key double-ended queues is sufficient. Phase 06 can swap this for
 * a shared cache if horizontal scaling becomes relevant.</p>
 *
 * <p>The limiter is thread-safe through a single intrinsic lock. Timestamps
 * use {@link Clock} so tests inject a controllable one.</p>
 */
public final class RateLimiter {

    private final Clock clock;
    private final Duration window;
    private final Map<Scope, Map<String, Deque<Long>>> buckets = new HashMap<>();

    public RateLimiter(final Clock clock) {
        this(clock, Duration.ofMinutes(1));
    }

    RateLimiter(final Clock clock, final Duration window) {
        this.clock = Objects.requireNonNull(clock, "clock");
        this.window = Objects.requireNonNull(window, "window");
    }

    /** Returns {@code true} iff the attempt was permitted. */
    public synchronized boolean tryAcquire(final Scope scope, final String key, final int perWindow) {
        if (perWindow <= 0 || key == null) {
            return true;
        }
        final long now = clock.millis();
        final long cutoff = now - window.toMillis();
        final Deque<Long> history = buckets.computeIfAbsent(scope, s -> new HashMap<>()).computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!history.isEmpty() && history.peekFirst() < cutoff) {
            history.pollFirst();
        }
        if (history.size() >= perWindow) {
            return false;
        }
        history.addLast(now);
        return true;
    }

    public synchronized void reset(final Scope scope, final String key) {
        final Map<String, Deque<Long>> inner = buckets.get(scope);
        if (inner != null) {
            inner.remove(key);
        }
    }

    public enum Scope {
        SIGN_IN_IP,
        SIGN_IN_USER
    }
}
