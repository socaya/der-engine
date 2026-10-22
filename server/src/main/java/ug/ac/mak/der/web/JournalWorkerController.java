package ug.ac.mak.der.web;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.journal.JournalWorker;

/** Admin surface for the journal worker (ADR-0010). */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/worker", produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalWorkerController {

    private final JournalWorker worker;
    private final OperationJournalRepository journal;

    public JournalWorkerController(final JournalWorker worker,
                                     final OperationJournalRepository journal) {
        this.worker = Objects.requireNonNull(worker, "worker");
        this.journal = Objects.requireNonNull(journal, "journal");
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
        return ResponseEntity.ok(body);
    }

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
