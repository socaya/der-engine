package ug.ac.mak.der.web;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Returns the full {@link OperationJournalEntry} (including its payload JSON)
 * for a given {@code operationId}. Drives the /sync/history + /sync/queues
 * drawer "Payload" tab in the admin UI.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/operations",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalOperationLookupController {

    private final OperationJournalRepository journal;

    public JournalOperationLookupController(final OperationJournalRepository journal) {
        this.journal = Objects.requireNonNull(journal, "journal");
    }

    @GetMapping("/{operationId}")
    public ResponseEntity<OperationJournalEntry> get(final Authentication authentication,
                                                      @PathVariable("operationId")
                                                      final UUID operationId) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return journal.findById(operationId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).build());
    }

    @GetMapping
    public ResponseEntity<List<OperationJournalEntry>> list(
            final Authentication authentication,
            @RequestParam(name = "limit", defaultValue = "100") final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(journal.findRecent(limit));
    }
}
