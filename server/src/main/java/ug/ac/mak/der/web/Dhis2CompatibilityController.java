package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.Dhis2CompatibilityGuard;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2Version;

/**
 * Phase 01 diagnostic endpoint. Returns the current state of the DHIS2
 * compatibility guard. Intended for operators and the Phase 01 live-probe
 * verification script, not for client workflows.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/dhis2", produces = MediaType.APPLICATION_JSON_VALUE)
public class Dhis2CompatibilityController {

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2CompatibilityController.class);

    private final Dhis2CompatibilityGuard guard;
    private final Dhis2ReferenceClient dhis2;

    /** Cached last ping result. Shared across threads via AtomicReference so a
     *  burst of UI polls doesn't fan out to Central — a single stored probe
     *  is reused for {@link #PING_TTL_MS} milliseconds. */
    private final AtomicReference<PingSnapshot> lastPing = new AtomicReference<>();
    private static final long PING_TTL_MS = 10_000L;

    public Dhis2CompatibilityController(final Dhis2CompatibilityGuard guard,
                                         final Dhis2ReferenceClient dhis2) {
        this.guard = guard;
        this.dhis2 = dhis2;
    }

    @GetMapping("/compatibility")
    public ResponseEntity<CompatibilityStatus> compatibility() {
        try {
            final Dhis2CompatibilityGuard.Result result = guard.check();
            return ResponseEntity.ok(CompatibilityStatus.of(result));
        } catch (Dhis2CompatibilityGuard.Dhis2VersionMismatchException ex) {
            LOG.warn("DHIS2 version mismatch surfaced on diagnostic endpoint: {}", ex.getMessage());
            final CompatibilityStatus body = new CompatibilityStatus(
                    "MISMATCH",
                    ex.observed(),
                    ex.pin(),
                    null,
                    null,
                    ex.getMessage());
            return ResponseEntity.status(409).body(body);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            LOG.warn("DHIS2 unreachable on diagnostic endpoint: {}", ex.getMessage());
            return ResponseEntity.status(503).body(new CompatibilityStatus(
                    "UNREACHABLE", null, null, null, null, ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            LOG.warn("DHIS2 responded with unexpected payload: {}", ex.getMessage());
            return ResponseEntity.status(502).body(new CompatibilityStatus(
                    "BAD_RESPONSE", null, null, null, null, ex.getMessage()));
        }
    }

    /** Lightweight DHIS2 reachability probe for the UI runtime indicator.
     *  Does a short-timeout GET /api/system/info and caches the result for
     *  {@link #PING_TTL_MS} ms. Returns 200 either way; the body carries
     *  the reachable flag so a client can distinguish "central down" from
     *  "DER down". */
    @GetMapping("/ping")
    public ResponseEntity<PingSnapshot> ping() {
        final PingSnapshot cached = lastPing.get();
        if (cached != null && (System.currentTimeMillis() - cached.probedAtMillis) < PING_TTL_MS) {
            return ResponseEntity.ok(cached);
        }
        final long t0 = System.nanoTime();
        boolean reachable = false;
        String message = null;
        String observedVersion = null;
        try {
            final Dhis2Version v = dhis2.fetchVersion();
            reachable = true;
            observedVersion = v == null ? null : v.version();
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            message = ex.getMessage();
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            // Central answered — treat as reachable even if the body shape
            // changed unexpectedly; the compat profile check will quarantine
            // separately.
            reachable = true;
            message = "Central reachable but response unexpected: " + ex.getMessage();
        } catch (Exception ex) {
            message = ex.getClass().getSimpleName() + ": " + ex.getMessage();
        }
        final long rttMs = (System.nanoTime() - t0) / 1_000_000L;
        final PingSnapshot snap = new PingSnapshot(reachable, observedVersion,
                rttMs, Instant.now().toString(), System.currentTimeMillis(), message);
        lastPing.set(snap);
        return ResponseEntity.ok(snap);
    }

    public record PingSnapshot(
            @JsonProperty("reachable") boolean reachable,
            @JsonProperty("observedVersion") String observedVersion,
            @JsonProperty("latencyMs") long latencyMs,
            @JsonProperty("probedAt") String probedAt,
            @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) long probedAtMillis,
            @JsonProperty("message") String message
    ) {}

    public record CompatibilityStatus(
            @JsonProperty("status") String status,
            @JsonProperty("observedVersion") String observedVersion,
            @JsonProperty("pinnedVersion") String pinnedVersion,
            @JsonProperty("revision") String revision,
            @JsonProperty("buildTime") String buildTime,
            @JsonProperty("message") String message
    ) {
        public static CompatibilityStatus of(final Dhis2CompatibilityGuard.Result result) {
            final Dhis2Version v = result.observed();
            return new CompatibilityStatus(
                    result.status().name(),
                    v == null ? null : v.version(),
                    result.pin(),
                    v == null ? null : v.revision(),
                    v == null ? null : v.buildTime(),
                    null
            );
        }
    }
}
