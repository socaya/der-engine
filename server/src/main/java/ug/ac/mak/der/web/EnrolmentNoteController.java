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
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.EnrolmentNoteRepository;
import ug.ac.mak.der.workflows.tracker.EnrolmentNoteRepository.EnrolmentNote;

/**
 * Dashboard slice D — enrolment notes list + create. Notes are
 * append-only and scoped to an enrolment (not a TEI), mirroring
 * DHIS2's Note model. Read-only list via GET; POST appends a new
 * note. No update / delete endpoints — notes are an audit trail.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/tracker/enrolments/{enrollmentUid}/notes",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class EnrolmentNoteController {

    private final EnrolmentNoteRepository repo;
    private final OperationJournalRepository journal;
    private final ObjectMapper json;
    private final Clock clock;

    public EnrolmentNoteController(final EnrolmentNoteRepository repo,
                                     final OperationJournalRepository journal,
                                     final ObjectMapper json,
                                     final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.json = Objects.requireNonNull(json, "json");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            final Authentication authentication,
            @PathVariable("enrollmentUid") final String enrollmentUid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<EnrolmentNote> rows = repo.findByEnrollment(enrollmentUid);
        return ResponseEntity.ok(Map.of("notes",
                rows.stream().map(EnrolmentNoteController::toJson).toList()));
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            final Authentication authentication,
            @PathVariable("enrollmentUid") final String enrollmentUid,
            @RequestBody final CreateRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.noteUid() == null
                || body.noteText() == null
                || body.noteText().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "NOTE_INVALID",
                    "message", "noteUid + non-empty noteText required"));
        }
        final EnrolmentNote note;
        try {
            note = new EnrolmentNote(body.noteUid(), enrollmentUid,
                    body.noteText().trim(), null,
                    principal.userId(), Instant.now(clock), null);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "NOTE_INVALID", "message", ex.getMessage()));
        }
        repo.insert(note);
        // Enqueue a journal entry so the drain POSTs this note to
        // central as an enrollment update envelope. On ACCEPTED the
        // publisher stamps central_uid via noteRepo.markSynced.
        final ObjectNode payload = json.createObjectNode();
        payload.put("operation", "CREATE");
        payload.put("enrollmentUid", enrollmentUid);
        payload.put("noteUid", note.noteUid());
        payload.put("noteText", note.noteText());
        final Instant nowJournal = Instant.now(clock);
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.ENROLMENT_NOTE,
                note.noteUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, principal.userId(), nowJournal, nowJournal));
        return ResponseEntity.ok(toJson(note));
    }

    private static Map<String, Object> toJson(final EnrolmentNote n) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("noteUid", n.noteUid());
        out.put("enrollmentUid", n.enrollmentUid());
        out.put("noteText", n.noteText());
        out.put("createdBy", n.createdBy().toString());
        out.put("createdAt", n.createdAt().toString());
        return out;
    }

    public record CreateRequest(
            @JsonProperty("noteUid") String noteUid,
            @JsonProperty("noteText") String noteText) { }
}
