package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * Backlog breakdown by entity type for the sync overview. Returns a
 * row per {@link OperationJournalEntry.EntityType} with counts in each
 * state. Every known type is always included (zeros for empty types)
 * so the UI table has a stable set of rows regardless of what has
 * actually been captured.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/stats",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class JournalStatsController {

    private final OperationJournalRepository journal;

    public JournalStatsController(final OperationJournalRepository journal) {
        this.journal = Objects.requireNonNull(journal, "journal");
    }

    @GetMapping("/by-type")
    public ResponseEntity<Map<String, Map<String, Integer>>> byType(
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Map<String, Map<String, Integer>> out = new LinkedHashMap<>();
        for (final OperationJournalEntry.EntityType et
                : OperationJournalEntry.EntityType.values()) {
            final Map<String, Integer> zeros = new LinkedHashMap<>();
            for (final OperationJournalEntry.State st
                    : OperationJournalEntry.State.values()) {
                zeros.put(st.name(), 0);
            }
            out.put(et.name(), zeros);
        }
        for (final OperationJournalRepository.EntityStateCount row
                : journal.countByEntityTypeAndState()) {
            final Map<String, Integer> perType = out.get(row.entityType());
            if (perType != null) {
                perType.put(row.state(), row.count());
            }
        }
        return ResponseEntity.ok(out);
    }
}
