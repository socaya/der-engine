package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.journal.JournalWorker;
import ug.ac.mak.der.workflows.journal.JournalWorkerConfig;

/** Admin surface for the journal worker (ADR-0010). */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/worker", produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalWorkerController {

    private final JournalWorker worker;
    private final OperationJournalRepository journal;
    private final JournalWorkerConfig.JournalWorkerSettings settings;

    public JournalWorkerController(final JournalWorker worker,
                                     final OperationJournalRepository journal,
                                     final JournalWorkerConfig.JournalWorkerSettings settings) {
        this.worker = Objects.requireNonNull(worker, "worker");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.settings = Objects.requireNonNull(settings, "settings");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> health(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("enabled", worker.enabled());
        final Instant lastTick = worker.lastTick();
        body.put("lastTick", lastTick == null ? null : lastTick.toString());
        body.put("lastBatchSize", worker.lastBatchSize());
        final Map<String, Integer> backlog = new LinkedHashMap<>();
        for (final OperationJournalEntry.State state : OperationJournalEntry.State.values()) {
            backlog.put(state.name(), journal.countByState(state));
        }
        body.put("backlog", backlog);
        // SM-3c — surface live tunables so the admin UI can display
        // + edit them.
        final Map<String, Object> tune = new LinkedHashMap<>();
        tune.put("batchSize", settings.batchSize());
        tune.put("backoffBaseSeconds", settings.backoffBaseSeconds());
        tune.put("backoffCapSeconds", settings.backoffCapSeconds());
        body.put("tune", tune);
        return ResponseEntity.ok(body);
    }

    /** SM-3c — adjust the drain batch size and backoff caps live.
     *  Fields are optional; missing ones keep their current value.
     *  Changes are in-memory; restart reverts to env-var baselines. */
    @PostMapping(path = "/tune", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> tune(final Authentication authentication,
                                                      @RequestBody final TuneBody body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TUNE_EMPTY",
                    "message", "batchSize / backoffBaseSeconds / "
                        + "backoffCapSeconds required"));
        }
        if (body.batchSize() != null) {
            final int v = body.batchSize();
            if (v < 1 || v > 500) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "TUNE_BATCH_RANGE",
                        "message", "batchSize must be in [1, 500]"));
            }
            settings.batchSizeRef().set(v);
        }
        if (body.backoffBaseSeconds() != null) {
            final long v = body.backoffBaseSeconds();
            if (v < 1 || v > settings.backoffCapSeconds()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "TUNE_BACKOFF_BASE_RANGE",
                        "message", "backoffBaseSeconds must be in "
                            + "[1, backoffCapSeconds]"));
            }
            settings.backoffBaseSecondsRef().set(v);
        }
        if (body.backoffCapSeconds() != null) {
            final long v = body.backoffCapSeconds();
            if (v < settings.backoffBaseSeconds() || v > 86_400) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "TUNE_BACKOFF_CAP_RANGE",
                        "message", "backoffCapSeconds must be in "
                            + "[backoffBaseSeconds, 86400]"));
            }
            settings.backoffCapSecondsRef().set(v);
        }
        return ResponseEntity.ok(Map.of(
                "batchSize",          settings.batchSize(),
                "backoffBaseSeconds", settings.backoffBaseSeconds(),
                "backoffCapSeconds",  settings.backoffCapSeconds()));
    }

    public record TuneBody(
            @JsonProperty("batchSize") Integer batchSize,
            @JsonProperty("backoffBaseSeconds") Long backoffBaseSeconds,
            @JsonProperty("backoffCapSeconds") Long backoffCapSeconds) { }

    @PostMapping("/pause")
    public ResponseEntity<Object> pause(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        worker.pause();
        return ResponseEntity.ok(Map.of("enabled", worker.enabled()));
    }

    @PostMapping("/resume")
    public ResponseEntity<Object> resume(final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        worker.resume();
        return ResponseEntity.ok(Map.of("enabled", worker.enabled()));
    }
}
