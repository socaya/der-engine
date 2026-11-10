package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.DatasetCompletionRepository;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;

/**
 * FR-06-06: Dataset completeness surface. Maps to DHIS2's
 * {@code CompleteDataSetRegistration} resource — DER accepts
 * complete/undo-complete markers scoped to (dataSet, orgUnit, period,
 * attributeOptionCombo).
 */
@RestController
@RequestMapping(path = "/edge-api/v1/aggregate/completion",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class DatasetCompletionController {

    private final DatasetCompletionRepository repo;
    private final OperationJournalRepository journal;
    private final ObjectMapper jsonMapper;
    private final Clock clock;

    public DatasetCompletionController(final DatasetCompletionRepository repo,
                                         final OperationJournalRepository journal,
                                         final ObjectMapper jsonMapper,
                                         final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> mark(final Authentication authentication,
                                                      @RequestBody final CompletionRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.dataSet() == null || body.dataSet().isBlank()
                || body.orgUnit() == null || body.orgUnit().isBlank()
                || body.period() == null || body.period().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "COMPLETION_INVALID",
                    "message", "dataSet, orgUnit, period required"));
        }
        final Instant now = Instant.now(clock);
        final DatasetCompletionRepository.Record rec = repo.upsert(
                body.dataSet(), body.orgUnit(), body.period(), body.attributeOptionCombo(),
                body.completed() == null || body.completed(),
                principal.userId(), now);
        // SM-1a — enqueue a journal entry so the next drain posts
        // the completion marker to central
        // (/api/completeDataSetRegistrations). Without this the
        // completion lived on the edge only and central forms stayed
        // OPEN indefinitely. entity_ref packs the natural key so
        // replay/retry don't duplicate.
        final String entityRef = rec.dataSet() + "|" + rec.period()
                + "|" + rec.orgUnit()
                + "|" + (rec.aoc() == null ? "" : rec.aoc());
        final Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("dataSet",   rec.dataSet());
        payload.put("period",    rec.period());
        payload.put("orgUnit",   rec.orgUnit());
        if (rec.aoc() != null) {
            payload.put("attributeOptionCombo", rec.aoc());
        }
        payload.put("completed", rec.completed());
        payload.put("storedBy",  principal.getName());
        payload.put("date",      rec.completedAt().toString());
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.AGGREGATE_DATASET_COMPLETION,
                entityRef,
                jsonMapper.valueToTree(payload),
                OperationJournalEntry.State.PENDING,
                0, null, principal.userId(), now, now, null, null));
        return ResponseEntity.ok(toJson(rec));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> get(
            @RequestParam("dataSet") final String dataSet,
            @RequestParam("orgUnit") final String orgUnit,
            @RequestParam("period") final String period,
            @RequestParam(name = "attributeOptionCombo", required = false) final String aoc) {
        return repo.find(dataSet, orgUnit, period, aoc)
                .<ResponseEntity<Map<String, Object>>>map(r -> ResponseEntity.ok(toJson(r)))
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "dataSet", dataSet, "orgUnit", orgUnit, "period", period,
                        "completed", false)));
    }

    @GetMapping("/by-org-unit")
    public ResponseEntity<Map<String, Object>> listByOrgUnit(
            @RequestParam("orgUnit") final String orgUnit) {
        final List<Map<String, Object>> rows = repo.listByOrgUnit(orgUnit).stream()
                .map(DatasetCompletionController::toJson).toList();
        return ResponseEntity.ok(Map.of("completions", rows));
    }

    private static Map<String, Object> toJson(final DatasetCompletionRepository.Record r) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("dataSet", r.dataSet());
        m.put("orgUnit", r.orgUnit());
        m.put("period", r.period());
        m.put("attributeOptionCombo", r.aoc());
        m.put("completed", r.completed());
        m.put("completedBy", r.completedBy() == null ? null : r.completedBy().toString());
        m.put("completedAt", r.completedAt().toString());
        return m;
    }

    public record CompletionRequest(
            @JsonProperty("dataSet") String dataSet,
            @JsonProperty("orgUnit") String orgUnit,
            @JsonProperty("period") String period,
            @JsonProperty("attributeOptionCombo") String attributeOptionCombo,
            @JsonProperty("completed") Boolean completed) { }
}
