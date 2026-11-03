package ug.ac.mak.der.web;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.journal.ConflictReviewService;

/** ADR-0009 admin surface for conflict review. */
@RestController
@RequestMapping(path = "/edge-api/v1/journal/conflicts", produces = MediaType.APPLICATION_JSON_VALUE)
public class ConflictReviewController {

    private final ConflictReviewService service;
    private final OperationJournalRepository journal;
    private final ObjectMapper mapper;

    public ConflictReviewController(final ConflictReviewService service,
                                       final OperationJournalRepository journal,
                                       final ObjectMapper mapper) {
        this.service = Objects.requireNonNull(service, "service");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    /**
     * Phase 13.4 — central-side payload for one conflict row. The
     * admin UI conflict-detail screen renders this side-by-side
     * with the local payload so the operator can compare before
     * resolving.
     *
     * <p>{@code lastResponse} is returned as a parsed JsonNode so
     * the admin UI's JsonViewer can render it directly; falls back
     * to {@code null} when central's response wasn't valid JSON or
     * the row has never been published.</p>
     */
    @GetMapping("/{id}/central-response")
    public ResponseEntity<java.util.Map<String, Object>> centralResponse(
            final Authentication authentication,
            @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final OperationJournalRepository.ConflictPayloadRow row =
                journal.findConflictPayload(id);
        if (row == null) {
            return ResponseEntity.notFound().build();
        }
        JsonNode parsed = null;
        if (row.lastResponseJson() != null && !row.lastResponseJson().isBlank()) {
            try {
                parsed = mapper.readTree(row.lastResponseJson());
            } catch (Exception ex) {
                /* Non-JSON last_response (shouldn't happen — the
                 * publisher always writes a JSON object — but defensive
                 * if a bad write ever slips through). Fall through to
                 * returning the raw string in lastResponseRaw. */
            }
        }
        final java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("operationId", id.toString());
        body.put("lastResponse", parsed);
        if (parsed == null) {
            body.put("lastResponseRaw", row.lastResponseJson());
        }
        body.put("lastError", row.lastError());
        return ResponseEntity.ok(body);
    }

    @GetMapping
    public ResponseEntity<List<OperationJournalEntry>> list(final Authentication authentication,
                                                             @RequestParam(name = "limit",
                                                                     defaultValue = "100")
                                                             final int limit) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(service.listConflicts(limit));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Object> resolve(final Authentication authentication,
                                            @PathVariable("id") final UUID id,
                                            @RequestBody final ResolveRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        if (body == null || body.outcome() == null) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error", "outcome required"));
        }
        final ConflictReviewService.Outcome outcome;
        try {
            outcome = ConflictReviewService.Outcome.valueOf(body.outcome());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(java.util.Map.of("error",
                    "outcome must be ACCEPTED or REJECTED"));
        }
        try {
            final Optional<OperationJournalEntry> out = service.resolve(id, outcome,
                    principal.userId(), body.rationale());
            if (out.isPresent()) {
                return ResponseEntity.ok(out.get());
            }
            return ResponseEntity.status(404).build();
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(409).body(java.util.Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/re-journal")
    public ResponseEntity<Object> reJournal(final Authentication authentication,
                                              @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).build();
        }
        final Optional<OperationJournalEntry> out = service.reJournal(id, principal.userId());
        if (out.isPresent()) {
            return ResponseEntity.ok(out.get());
        }
        return ResponseEntity.status(404).build();
    }

    public record ResolveRequest(
            @JsonProperty("outcome") String outcome,
            @JsonProperty("rationale") String rationale
    ) { }
}
