package ug.ac.mak.der.sync.policy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.stereotype.Service;

import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * Hot path for sync-policy lookups. Read-through cache with a 30-second
 * TTL so the per-row drain cost is still a HashMap probe even though
 * policy is now DB-backed.
 *
 * <p>Effective mode resolution for any entity type:</p>
 * <ol>
 *   <li>Explicit row for that entity type → use it.</li>
 *   <li>Explicit GLOBAL row → use it.</li>
 *   <li>Neither row (fresh install, before any UI edit) →
 *       {@code SCHEDULED} fallback matching the historical
 *       cron-only behaviour.</li>
 * </ol>
 */
@Service
public class SyncPolicyService {

    public static final String GLOBAL_SCOPE = "GLOBAL";
    public static final String FALLBACK_CRON = "0 * * * * ?";
    private static final Duration CACHE_TTL = Duration.ofSeconds(30);

    private final SyncPolicyRepository repo;
    private final Clock clock;
    private final AtomicReference<Snapshot> cache =
            new AtomicReference<>(null);

    public SyncPolicyService(final SyncPolicyRepository repo,
                               final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    /** All policies keyed by scope. Hits the DB at most once per TTL. */
    public Map<String, SyncPolicy> all() {
        return snapshot().byScope;
    }

    /** Effective (post-inheritance) mode for a given entity type.
     *  Never returns {@code null} — falls back to {@code SCHEDULED}
     *  with the default cron so a fresh install behaves identically
     *  to the pre-SM-2 engine. */
    public ResolvedPolicy effectiveFor(
            final OperationJournalEntry.EntityType type) {
        Objects.requireNonNull(type, "type");
        return effectiveForScope(type.name());
    }

    /** UI-10 — resolve the effective policy for an arbitrary scope
     *  string. Accepts both entity-type scopes (write-side; backed
     *  by OperationJournalEntry.EntityType enum values) and the
     *  scheduled-job scopes added in V109 (metadata sync, data pull,
     *  compat refresh, drift snapshot, referrals, backup drain,
     *  analytics refresh). Falls through to GLOBAL and then to the
     *  SCHEDULED default. */
    public ResolvedPolicy effectiveForScope(final String scope) {
        Objects.requireNonNull(scope, "scope");
        final Map<String, SyncPolicy> byScope = snapshot().byScope;
        final SyncPolicy perScope = byScope.get(scope);
        if (perScope != null) {
            return new ResolvedPolicy(perScope.mode(),
                    perScope.scheduleCron(), perScope.pausedReason(),
                    scope, perScope);
        }
        final SyncPolicy global = byScope.get(GLOBAL_SCOPE);
        if (global != null) {
            return new ResolvedPolicy(global.mode(), global.scheduleCron(),
                    global.pausedReason(), GLOBAL_SCOPE, global);
        }
        return new ResolvedPolicy(SyncPolicyMode.SCHEDULED,
                FALLBACK_CRON, null, GLOBAL_SCOPE, null);
    }

    public Optional<SyncPolicy> get(final String scope) {
        Objects.requireNonNull(scope, "scope");
        return Optional.ofNullable(snapshot().byScope.get(scope));
    }

    public SyncPolicy upsert(final String scope, final SyncPolicyMode mode,
                               final String cron, final String reason,
                               final UUID actor) {
        final SyncPolicy row = new SyncPolicy(scope, mode,
                normalise(cron), normalise(reason), actor,
                Instant.now(clock));
        final SyncPolicy stored = repo.upsert(row);
        invalidate();
        return stored;
    }

    public int reset(final String scope) {
        if (GLOBAL_SCOPE.equals(scope)) {
            throw new IllegalArgumentException(
                    "GLOBAL policy cannot be deleted");
        }
        final int n = repo.deleteByScope(scope);
        if (n > 0) {
            invalidate();
        }
        return n;
    }

    public void invalidate() {
        cache.set(null);
    }

    /** Immutable resolution result — includes which scope decided
     *  and the backing row (nullable only for the ultimate fallback
     *  where no rows exist at all). */
    public record ResolvedPolicy(
            SyncPolicyMode mode,
            String scheduleCron,
            String pausedReason,
            String decidedBy,
            SyncPolicy backing) {

        public boolean isPaused() {
            return mode == SyncPolicyMode.PAUSED;
        }

        public boolean isInstant() {
            return mode == SyncPolicyMode.INSTANT;
        }
    }

    private Snapshot snapshot() {
        final Snapshot cur = cache.get();
        final Instant now = Instant.now(clock);
        if (cur != null && !cur.expiresAt.isBefore(now)) {
            return cur;
        }
        final List<SyncPolicy> rows = repo.findAll();
        final Map<String, SyncPolicy> byScope = new HashMap<>();
        for (SyncPolicy p : rows) {
            byScope.put(p.scope(), p);
        }
        final Snapshot fresh = new Snapshot(
                Collections.unmodifiableMap(byScope),
                now.plus(CACHE_TTL));
        cache.set(fresh);
        return fresh;
    }

    private static String normalise(final String s) {
        if (s == null) {
            return null;
        }
        final String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private record Snapshot(Map<String, SyncPolicy> byScope,
                              Instant expiresAt) { }
}
