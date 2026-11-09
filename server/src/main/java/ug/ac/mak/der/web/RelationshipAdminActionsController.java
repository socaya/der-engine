package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.aggregate.OperationJournalRepository;
import ug.ac.mak.der.workflows.tracker.TrackerRelationship;
import ug.ac.mak.der.workflows.tracker.TrackerRelationshipRepository;

/** Admin triage actions for stuck relationship rows (spec
 *  §REL-S-015 / §REL-S-016, follow-up to the read-only diagnostics
 *  endpoint shipped in a391ea9c). Each action is POST-only,
 *  ADMIN-gated, idempotent, and returns the updated row so the
 *  admin UI can refresh its display without a second fetch.
 *
 *  Three actions:
 *   - retry   — enqueue a fresh journal CREATE entry so the drain
 *               re-attempts the central POST. Flips sync_status
 *               back to PENDING. Use when a FAILED row was caused
 *               by a transient error (metadata lookup failure,
 *               network blip) now resolved.
 *   - ack     — mark SYNCED without a central round-trip. Use
 *               when the operator has confirmed out-of-band that
 *               central actually has the row, or when the row is
 *               known-good DER-only and the admin wants it to stop
 *               showing up in the attention queue.
 *   - purge   — physically delete a soft-deleted tombstone whose
 *               central DELETE has already happened (or doesn't
 *               need to happen). Normally the drain does this
 *               after central acks; this is the escape hatch for
 *               stuck tombstones. */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/relationships",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class RelationshipAdminActionsController {

    private final TrackerRelationshipRepository repo;
    private final OperationJournalRepository journal;
    private final ObjectMapper jsonMapper;
    private final Clock clock;

    public RelationshipAdminActionsController(
            final TrackerRelationshipRepository repo,
            final OperationJournalRepository journal,
            final ObjectMapper jsonMapper,
            final Clock clock) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.journal = Objects.requireNonNull(journal, "journal");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @PostMapping("/{uid}/retry")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> retry(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<TrackerRelationship> row = repo.findById(uid);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final TrackerRelationship r = row.get();
        if (r.deletedAt() != null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ROW_DELETED",
                    "message", "Row is soft-deleted; use /purge "
                        + "or restore it elsewhere first."));
        }
        // Flip to PENDING + enqueue a fresh CREATE journal entry.
        // Drain will pick it up on the next pass.
        final Instant now = Instant.now(clock);
        repo.markSyncStatus(uid,
                TrackerRelationship.SyncStatus.PENDING, now);
        enqueueRetryJournal(r, principal.userId(), now);
        return ResponseEntity.ok(Map.of(
                "action", "retry",
                "relationshipUid", uid,
                "syncStatus", "PENDING"));
    }

    @PostMapping("/{uid}/ack")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> ack(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<TrackerRelationship> row = repo.findById(uid);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final Instant now = Instant.now(clock);
        repo.markSyncStatus(uid,
                TrackerRelationship.SyncStatus.SYNCED, now);
        return ResponseEntity.ok(Map.of(
                "action", "ack",
                "relationshipUid", uid,
                "syncStatus", "SYNCED"));
    }

    @PostMapping("/{uid}/purge")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> purge(
            final Authentication authentication,
            @PathVariable("uid") final String uid) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<TrackerRelationship> row = repo.findById(uid);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        if (row.get().deletedAt() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "ROW_NOT_DELETED",
                    "message", "Purge is only for soft-deleted "
                        + "tombstones. Use /unlink first."));
        }
        final int purged = repo.purge(uid);
        return ResponseEntity.ok(Map.of(
                "action", "purge",
                "relationshipUid", uid,
                "purgedRowCount", purged));
    }

    @PostMapping("/bulk/retry")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkRetry(
            final Authentication authentication,
            @RequestBody final BulkRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        return bulkApply(body, uid -> retryOne(uid, principal.userId()));
    }

    @PostMapping("/bulk/ack")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkAck(
            final Authentication authentication,
            @RequestBody final BulkRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return bulkApply(body, this::ackOne);
    }

    @PostMapping("/bulk/purge")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> bulkPurge(
            final Authentication authentication,
            @RequestBody final BulkRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return bulkApply(body, this::purgeOne);
    }

    /** Per-row result from a bulk apply — the client renders each
     *  entry so an operator can see which rows failed and why
     *  (ROW_DELETED on retry, ROW_NOT_DELETED on purge, etc.)
     *  without a second fetch. */
    private record RowResult(String uid, boolean ok, String error) { }

    @FunctionalInterface
    private interface RowAction {
        RowResult apply(String uid);
    }

    private ResponseEntity<Map<String, Object>> bulkApply(
            final BulkRequest body, final RowAction action) {
        if (body == null || body.uids() == null
                || body.uids().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "EMPTY_UIDS",
                    "message", "uids array must not be empty"));
        }
        if (body.uids().size() > 200) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "TOO_MANY_UIDS",
                    "message", "bulk actions capped at 200 uids "
                        + "per request"));
        }
        final List<Map<String, Object>> results = new ArrayList<>();
        int ok = 0;
        int failed = 0;
        for (final String uid : body.uids()) {
            final RowResult r = action.apply(uid);
            final Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("relationshipUid", uid);
            entry.put("ok", r.ok());
            if (r.error() != null) {
                entry.put("error", r.error());
            }
            results.add(entry);
            if (r.ok()) {
                ok++;
            } else {
                failed++;
            }
        }
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", body.uids().size());
        out.put("succeeded", ok);
        out.put("failed", failed);
        out.put("results", results);
        return ResponseEntity.ok(out);
    }

    private RowResult retryOne(final String uid, final UUID submittedBy) {
        final Optional<TrackerRelationship> row = repo.findById(uid);
        if (row.isEmpty()) {
            return new RowResult(uid, false, "NOT_FOUND");
        }
        if (row.get().deletedAt() != null) {
            return new RowResult(uid, false, "ROW_DELETED");
        }
        final Instant now = Instant.now(clock);
        repo.markSyncStatus(uid,
                TrackerRelationship.SyncStatus.PENDING, now);
        enqueueRetryJournal(row.get(), submittedBy, now);
        return new RowResult(uid, true, null);
    }

    private RowResult ackOne(final String uid) {
        if (repo.findById(uid).isEmpty()) {
            return new RowResult(uid, false, "NOT_FOUND");
        }
        repo.markSyncStatus(uid,
                TrackerRelationship.SyncStatus.SYNCED,
                Instant.now(clock));
        return new RowResult(uid, true, null);
    }

    private RowResult purgeOne(final String uid) {
        final Optional<TrackerRelationship> row = repo.findById(uid);
        if (row.isEmpty()) {
            return new RowResult(uid, false, "NOT_FOUND");
        }
        if (row.get().deletedAt() == null) {
            return new RowResult(uid, false, "ROW_NOT_DELETED");
        }
        repo.purge(uid);
        return new RowResult(uid, true, null);
    }

    public record BulkRequest(
            @JsonProperty("uids") List<String> uids) { }

    /** Duplicates the private enqueueJournal in
     *  TrackerRelationshipController to avoid cross-controller
     *  coupling for a two-field difference. Keep in sync with
     *  that version. */
    private void enqueueRetryJournal(final TrackerRelationship r,
                                       final UUID submittedBy,
                                       final Instant now) {
        final ObjectNode payload = jsonMapper.createObjectNode();
        payload.put("operation", "CREATE");
        payload.put("relationshipUid", r.relationshipUid());
        payload.put("relationshipType", r.relationshipType());
        payload.put("fromEntityType", r.fromEntityType().name());
        payload.put("fromEntityUid", r.fromEntityUid());
        payload.put("toEntityType", r.toEntityType().name());
        payload.put("toEntityUid", r.toEntityUid());
        payload.put("bidirectional", r.bidirectional());
        journal.insert(new OperationJournalEntry(
                UUID.randomUUID(),
                OperationJournalEntry.EntityType.RELATIONSHIP,
                r.relationshipUid(),
                payload,
                OperationJournalEntry.State.PENDING,
                0, null, submittedBy, now, now));
    }
}
