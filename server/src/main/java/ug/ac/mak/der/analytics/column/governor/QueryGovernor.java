package ug.ac.mak.der.analytics.column.governor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

/**
 * SRS §6 + §11.4 query governor. Issues {@link QueryToken}s to
 * begin a query, tracks in-flight queries, and lets admins cancel
 * by id. Enforces a configured max-concurrent ceiling so a surge
 * of parallel queries can't unbound memory or CPU.
 *
 * <p>Gate 5.1 is the infrastructure only — the columnar engine
 * will adopt {@code throwIfAborted} at operator boundaries in a
 * follow-up slice. The governor's admin surface already lets
 * operators observe + cancel today.</p>
 */
@Service
public class QueryGovernor {

    private final GovernorProperties properties;
    private final ConcurrentHashMap<UUID, QueryToken> running =
            new ConcurrentHashMap<>();

    public QueryGovernor(final GovernorProperties properties) {
        this.properties = Objects.requireNonNull(properties, "properties");
    }

    /** Begin a new query. Raises if the governor is already at
     *  its max-concurrent ceiling. The caller must call
     *  {@link #complete} on success or {@link #fail} on exception
     *  so the running-slot is freed. */
    public QueryToken begin(final String principal) {
        if (running.size() >= properties.maxConcurrent()) {
            throw new IllegalStateException(
                    "query governor saturated: "
                  + running.size() + " of "
                  + properties.maxConcurrent() + " slots in use");
        }
        final QueryToken token = new QueryToken(UUID.randomUUID(),
                Instant.now(),
                properties.maxDurationMillis(),
                properties.maxBytesPerQuery(),
                principal);
        running.put(token.queryId(), token);
        return token;
    }

    public void complete(final QueryToken token) {
        Objects.requireNonNull(token, "token");
        token.complete();
        running.remove(token.queryId());
    }

    public void fail(final QueryToken token) {
        Objects.requireNonNull(token, "token");
        token.fail();
        running.remove(token.queryId());
    }

    /** Admin cancel. Returns true when the query was in-flight;
     *  false when it had already finished / been cleaned up. */
    public boolean cancel(final UUID queryId) {
        final QueryToken token = running.get(queryId);
        if (token == null) {
            return false;
        }
        token.cancel();
        return true;
    }

    public Optional<QueryToken> find(final UUID queryId) {
        return Optional.ofNullable(running.get(queryId));
    }

    public List<QueryToken> list() {
        return new ArrayList<>(running.values());
    }

    public int inFlightCount() {
        return running.size();
    }

    public int maxConcurrent() {
        return properties.maxConcurrent();
    }
}
