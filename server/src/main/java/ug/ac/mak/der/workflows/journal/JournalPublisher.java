package ug.ac.mak.der.workflows.journal;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Objects;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;
import ug.ac.mak.der.workflows.tracker.EnrolmentNoteRepository;
import ug.ac.mak.der.workflows.tracker.TrackerRelationshipRepository;

/**
 * Publishes a journal entry's payload to central. Capability-aware routing per
 * ADR-0010. Returns a classified {@link PublishResult}.
 */
@Service
public class JournalPublisher {

    private static final Logger LOG = LoggerFactory.getLogger(JournalPublisher.class);

    /** §2.3.96 R-D/tracker-async — poll /api/tracker/jobs/{id} every
     *  500 ms up to 60 attempts (= ~30 s). Beyond that the publisher
     *  classifies the entry as RETRYABLE so the sync worker's own
     *  exponential backoff takes over for the next drain tick. */
    private static final int TRACKER_POLL_MAX_ATTEMPTS = 60;
    private static final long TRACKER_POLL_INTERVAL_MS = 500L;

    private final HttpClient http;
    private final Dhis2Properties props;
    private final Dhis2CompatibilityEngine engine;
    private final ReferralPayloadEncoder referralEncoder;
    private final ObjectMapper jsonMapper;
    /** Nullable — tests may construct the publisher without the
     *  relationship repo. When null, RELATIONSHIP publish calls
     *  skip the local repo side-effects (markSynced / purge) but
     *  still make the central round-trip so the journal entry
     *  terminates correctly. */
    private final TrackerRelationshipRepository relationshipRepo;
    /** Nullable, same pattern as relationshipRepo — ENROLMENT_NOTE
     *  publish calls fall back to no-op markSynced when absent. */
    private final EnrolmentNoteRepository noteRepo;

    @Autowired
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder,
                             final ObjectMapper jsonMapper,
                             final TrackerRelationshipRepository relationshipRepo,
                             final EnrolmentNoteRepository noteRepo) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.engine = Objects.requireNonNull(engine, "engine");
        this.referralEncoder = Objects.requireNonNull(referralEncoder, "referralEncoder");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.relationshipRepo = relationshipRepo;
        this.noteRepo = noteRepo;
    }

    /** Back-compat ctor without the note repo — relationship tests
     *  that predate slice-notes can keep constructing without
     *  touching their mocks. */
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder,
                             final ObjectMapper jsonMapper,
                             final TrackerRelationshipRepository relationshipRepo) {
        this(http, props, engine, referralEncoder, jsonMapper, relationshipRepo, null);
    }

    /** Back-compat ctor for pre-slice-3 callers (tests). Omitting
     *  the relationship repo disables the post-publish repo
     *  side-effects. */
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder,
                             final ObjectMapper jsonMapper) {
        this(http, props, engine, referralEncoder, jsonMapper, null, null);
    }

    /** Back-compat ctor for pre-R-D/tracker-async callers (tests). */
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder) {
        this(http, props, engine, referralEncoder, new ObjectMapper(), null, null);
    }

    public PublishResult publish(final OperationJournalEntry entry) {
        if (props.central().baseUrl() == null || props.central().baseUrl().isBlank()) {
            return new PublishResult(-1, "central not configured", TerminalState.RETRYABLE);
        }
        /* Relationships slice 3 — RELATIONSHIP entries follow a
         * different shape than aggregate/tracker: POST
         * /api/relationships for CREATE and DELETE
         * /api/relationships/{uid} for DELETE. Handled inline so
         * the targetPath + body-shape pipeline above doesn't need
         * to grow method-override awareness. */
        if (entry.entityType() == OperationJournalEntry.EntityType.RELATIONSHIP) {
            return publishRelationship(entry);
        }
        if (entry.entityType() == OperationJournalEntry.EntityType.ENROLMENT_NOTE) {
            return publishEnrolmentNote(entry);
        }
        final String path;
        try {
            path = targetPath(entry);
        } catch (Dhis2CompatibilityUnavailableException ex) {
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        }
        // Tracker tombstones (PROGRAM_STAGE_EVENT + operation=DELETE
        // in payload) use the same endpoint but need importStrategy=
        // DELETE on the query string — same shape DHIS2 2.44 uses for
        // relationship deletes. Any other PROGRAM_STAGE_EVENT entry
        // follows the default CREATE_AND_UPDATE strategy.
        final String effectivePath =
                isTrackerDeleteTombstone(entry) && path.startsWith("/api/tracker")
                        ? path + (path.contains("?") ? "&" : "?")
                            + "importStrategy=DELETE"
                        : path;
        try {
            final URI uri = URI.create(props.central().baseUrl() + effectivePath);
            final String body = referralEncoder.body(entry);
            final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(Math.max(1_000, props.central().connectTimeoutMillis())))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
            if (props.central().username() != null && !props.central().username().isBlank()) {
                final String token = props.central().username() + ":"
                        + (props.central().password() == null ? "" : props.central().password());
                req.header("Authorization", "Basic "
                        + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8)));
            }
            final HttpResponse<String> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            final int status = resp.statusCode();
            // §2.3.96 R-D/tracker-async — Central may queue tracker
            // imports; the initial POST returns 2xx with the job id
            // embedded in {"response":{"id":"..."}}. We follow the
            // two-phase flow before classifying the terminal state.
            if (status / 100 == 2 && isTrackerEntity(entry) && uri.getPath().contains("/api/tracker")) {
                final PublishResult pollResult = pollTrackerJob(resp.body());
                if (pollResult != null) {
                    return pollResult;
                }
                // No job id → treat as inline summary and classify
                // normally. 2.44 falls back to this when the batch is
                // small enough to run synchronously.
            }
            final String respBody = resp.body() == null ? "" : resp.body();
            // §2.3.124 Aggregate post-check — central may respond 200 OK
            // but importCount.imported + importCount.updated == 0 when it
            // silently discards an invalid envelope. Treat zero-import as
            // REJECTED so the operator sees it in the attention queue
            // instead of a false success.
            if (status / 100 == 2 && entry.entityType()
                    == OperationJournalEntry.EntityType.AGGREGATE_DATA_VALUE) {
                final TerminalState aggCheck = classifyAggregateImport(respBody);
                if (aggCheck != null) {
                    return new PublishResult(status, respBody, aggCheck);
                }
            }
            return new PublishResult(status, respBody, ResponseClassifier.classify(status));
        } catch (IOException ex) {
            LOG.warn("publish I/O failure: {}", ex.getMessage());
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new PublishResult(-1, "interrupted", TerminalState.RETRYABLE);
        }
    }

    /** True for the three DHIS2 tracker entity types that follow the
     *  async-import flow on /api/tracker. */
    private static boolean isTrackerEntity(final OperationJournalEntry entry) {
        return switch (entry.entityType()) {
            case TRACKED_ENTITY, ENROLLMENT, PROGRAM_STAGE_EVENT -> true;
            default -> false;
        };
    }

    /** True for tracker-entity tombstones — journal entries whose
     *  payload carries {@code "operation":"DELETE"}, enqueued by
     *  the corresponding controller's delete handler. Routes the
     *  drain through /api/tracker?importStrategy=DELETE so central
     *  removes the row instead of upserting it. Covers
     *  PROGRAM_STAGE_EVENT, ENROLLMENT and TRACKED_ENTITY — any
     *  tracker row deleted at the edge uses the same shape. */
    private static boolean isTrackerDeleteTombstone(
            final OperationJournalEntry entry) {
        switch (entry.entityType()) {
            case PROGRAM_STAGE_EVENT:
            case ENROLLMENT:
            case TRACKED_ENTITY:
                break;
            default:
                return false;
        }
        final JsonNode op = entry.payload() == null
                ? null : entry.payload().get("operation");
        return op != null && !op.isNull()
                && "DELETE".equalsIgnoreCase(op.asText(""));
    }

    /**
     * §2.3.96 R-D/tracker-async — DHIS2 2.44 flow:
     *
     * <ol>
     *   <li>Parse {@code jobId} out of the initial {@code POST} body
     *       (shape: {@code {"response":{"id":"<uid>"}}}). Return null
     *       when there's no job id — caller falls back to inline
     *       classification.</li>
     *   <li>Poll {@code GET /api/tracker/jobs/{id}} every 500 ms (up
     *       to 60 attempts) until the newest log entry has
     *       {@code completed:true}.</li>
     *   <li>Fetch the final summary via
     *       {@code GET /api/tracker/jobs/{id}/report} and feed the
     *       {@code status} field through
     *       {@link ResponseClassifier#classify(int)} — treating OK as
     *       200 and ERROR as 409 so conflicts route into the
     *       attention queue just like inline aggregate failures do.</li>
     * </ol>
     *
     * @return a terminal {@link PublishResult} when the poll
     *     resolves, {@code null} when the body carries no job id,
     *     or a {@code RETRYABLE} result on timeout / I-O error so
     *     the sync worker retries on the next drain.
     */
    private PublishResult pollTrackerJob(final String initialBody) {
        if (initialBody == null || initialBody.isBlank()) {
            return null;
        }
        final String jobId;
        try {
            final JsonNode root = jsonMapper.readTree(initialBody);
            final JsonNode response = root.get("response");
            if (response == null || !response.isObject()) {
                return null;
            }
            final JsonNode idNode = response.get("id");
            if (idNode == null || !idNode.isTextual()) {
                return null;
            }
            jobId = idNode.asText();
        } catch (IOException ex) {
            LOG.debug("tracker publish: initial body is not JSON ({}); "
                + "treating as inline summary", ex.getMessage());
            return null;
        }
        final String jobsBase = props.central().baseUrl() + "/api/tracker/jobs/" + jobId;
        for (int attempt = 0; attempt < TRACKER_POLL_MAX_ATTEMPTS; attempt++) {
            try {
                Thread.sleep(TRACKER_POLL_INTERVAL_MS);
                final HttpResponse<String> poll = http.send(
                        buildAuthenticatedGet(URI.create(jobsBase)),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (poll.statusCode() / 100 != 2) {
                    LOG.debug("tracker job {} poll returned HTTP {}", jobId,
                            poll.statusCode());
                    continue;
                }
                final JsonNode logs = jsonMapper.readTree(poll.body());
                if (!logs.isArray() || logs.size() == 0) {
                    continue;
                }
                // The newest entry sits at index 0 ("Import complete …").
                final JsonNode newest = logs.get(0);
                final JsonNode completed = newest.get("completed");
                if (completed == null || !completed.isBoolean() || !completed.asBoolean()) {
                    continue;
                }
                // Job is done — grab the real import summary.
                final HttpResponse<String> report = http.send(
                        buildAuthenticatedGet(URI.create(jobsBase + "/report")),
                        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                final String reportBody = report.body() == null ? "" : report.body();
                if (report.statusCode() / 100 != 2) {
                    return new PublishResult(report.statusCode(), reportBody,
                            ResponseClassifier.classify(report.statusCode()));
                }
                return classifyTrackerReport(reportBody);
            } catch (IOException ex) {
                LOG.warn("tracker job {} poll I/O error: {}", jobId, ex.getMessage());
                return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return new PublishResult(-1, "interrupted while polling", TerminalState.RETRYABLE);
            }
        }
        LOG.warn("tracker job {} did not complete within {} attempts",
                jobId, TRACKER_POLL_MAX_ATTEMPTS);
        return new PublishResult(-1, "tracker job poll timeout",
                TerminalState.RETRYABLE);
    }

    private HttpRequest buildAuthenticatedGet(final URI uri) {
        final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(
                    Math.max(1_000, props.central().connectTimeoutMillis())))
                .header("Accept", "application/json")
                .GET();
        if (props.central().username() != null
                && !props.central().username().isBlank()) {
            final String token = props.central().username() + ":"
                + (props.central().password() == null ? "" : props.central().password());
            req.header("Authorization", "Basic " + Base64.getEncoder()
                    .encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }
        return req.build();
    }

    /**
     * §2.3.124 — classify an aggregate dataValueSets import summary.
     *
     * <p>DHIS2's {@code /api/dataValueSets} endpoint always returns
     * 200 OK as long as the request body parsed, even if it contained
     * no {@code dataValues[]} array or every row was dropped silently.
     * The only authoritative signal is {@code response.importCount}.
     * When imported + updated == 0 and no conflicts were reported, the
     * POST was a no-op — route it to the attention queue instead of
     * marking SUCCESS.</p>
     *
     * @return {@link TerminalState#REJECTED} when the import did
     *     nothing, {@code null} when the body carries real import work
     *     (so the caller falls back to the HTTP-status classifier).
     */
    private TerminalState classifyAggregateImport(final String body) {
        if (body == null || body.isBlank()) {
            return TerminalState.REJECTED;
        }
        try {
            final JsonNode root = jsonMapper.readTree(body);
            final JsonNode response = root.path("response");
            final JsonNode counts = response.isObject()
                    ? response.path("importCount")
                    : root.path("importCount");
            if (!counts.isObject()) {
                return null;
            }
            final int imported = counts.path("imported").asInt(0);
            final int updated = counts.path("updated").asInt(0);
            final int ignored = counts.path("ignored").asInt(0);
            if (imported == 0 && updated == 0 && ignored == 0) {
                LOG.warn("aggregate publish: central returned importCount all-zeros — "
                        + "treating as REJECTED. body={}", body);
                return TerminalState.REJECTED;
            }
            return null;
        } catch (IOException ex) {
            LOG.warn("aggregate publish: could not parse importCount ({}); "
                    + "falling back to status classifier", ex.getMessage());
            return null;
        }
    }

    /** Classify {@code .../jobs/{id}/report}: {@code status} is one
     *  of OK / WARNING / ERROR. */
    private PublishResult classifyTrackerReport(final String body) {
        try {
            final JsonNode root = jsonMapper.readTree(body);
            final JsonNode status = root.get("status");
            if (status == null || !status.isTextual()) {
                return new PublishResult(200, body, TerminalState.ACCEPTED);
            }
            final String s = status.asText();
            return switch (s) {
                case "OK", "WARNING" -> new PublishResult(200, body, TerminalState.ACCEPTED);
                case "ERROR" -> new PublishResult(409, body, TerminalState.CONFLICT);
                default -> new PublishResult(200, body, TerminalState.ACCEPTED);
            };
        } catch (IOException ex) {
            LOG.warn("tracker report body is not JSON: {}", ex.getMessage());
            return new PublishResult(200, body, TerminalState.ACCEPTED);
        }
    }

    /** Relationships slice 3 drain handler. Reads the enqueued
     *  RELATIONSHIP payload (operation=CREATE|DELETE + uid + both
     *  sides), hits central via POST /api/relationships or DELETE
     *  /api/relationships/{uid}, and — on success — updates the
     *  local relationship repo (markSynced for CREATE, purge for
     *  DELETE). Classification pipes through ResponseClassifier
     *  the same way other entity types do. */
    private PublishResult publishRelationship(final OperationJournalEntry entry) {
        final JsonNode payload = entry.payload();
        if (!(payload instanceof ObjectNode obj)) {
            return new PublishResult(-1,
                    "relationship payload missing or not an object",
                    TerminalState.REJECTED);
        }
        final String operation = textOrNull(obj, "operation");
        final String uid = textOrNull(obj, "relationshipUid");
        if (uid == null || uid.isBlank()) {
            return new PublishResult(-1,
                    "relationship payload missing relationshipUid",
                    TerminalState.REJECTED);
        }
        // REL-S-011: skip DER-only relationship classes — they
        // never leave the edge. The repo row's rel_class is the
        // authoritative signal (not the journal payload) so this
        // honours any post-enqueue class changes the operator or
        // admin may apply.
        if (relationshipRepo != null) {
            final var row = relationshipRepo.findById(uid);
            if (row.isPresent() && !row.get().relClass().syncsToCentral()) {
                LOG.info("skipping {} relationship {} (class={})",
                        row.get().relClass(), uid, row.get().relClass());
                // Mark SYNCED so the badge doesn't show "pending"
                // forever for a link that will never be drained.
                relationshipRepo.markSyncStatus(uid,
                        ug.ac.mak.der.workflows.tracker
                            .TrackerRelationship.SyncStatus.SYNCED,
                        java.time.Instant.now());
                return new PublishResult(204,
                        "edge-only (" + row.get().relClass() + ")",
                        TerminalState.ACCEPTED);
            }
        }
        final boolean isDelete = "DELETE".equalsIgnoreCase(operation);
        /* DHIS2 2.44 serves all tracker writes through POST
         * /api/tracker with an importStrategy query parameter:
         * CREATE_AND_UPDATE (default) for creates, DELETE for
         * deletes. The envelope shape is the same either way —
         * {"relationships": [{...}]} — but a DELETE body only
         * needs the UID. Earlier /api/relationships + DELETE
         * /api/tracker/relationships/{uid} paths were removed in
         * the 2.3x → 2.4x migration. */
        final String path = isDelete
                ? "/api/tracker?importStrategy=DELETE"
                : "/api/tracker";
        try {
            final URI uri = URI.create(props.central().baseUrl() + path);
            final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(Math.max(1_000,
                            props.central().connectTimeoutMillis())))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            isDelete
                                ? buildRelationshipDeleteBody(uid)
                                : buildRelationshipCreateBody(obj),
                            StandardCharsets.UTF_8));
            if (props.central().username() != null
                    && !props.central().username().isBlank()) {
                final String token = props.central().username() + ":"
                        + (props.central().password() == null ? ""
                        : props.central().password());
                req.header("Authorization", "Basic "
                        + Base64.getEncoder().encodeToString(
                                token.getBytes(StandardCharsets.UTF_8)));
            }
            final HttpResponse<String> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            final int status = resp.statusCode();
            final String respBody = resp.body() == null ? "" : resp.body();
            /* REL-S-009: per-object Tracker import report parsing.
             * A 200 OK response can still carry a per-object
             * ignored/error row inside bundleReport — status-only
             * classification would wrongly flag that as SYNCED.
             * classifyTrackerImportResponse inspects stats.ignored
             * + objectReports[].errorReports[] to catch per-row
             * failures before we flip sync_status. */
            final TerminalState terminal =
                    classifyTrackerImportResponse(status, respBody, uid);
            /* Local side-effects only on ACCEPTED. RETRYABLE +
             * REJECTED + CONFLICT leave the row in its current
             * state so the next drain retries (RETRYABLE) or the
             * operator sees it in the attention queue (REJECTED /
             * CONFLICT). */
            if (relationshipRepo != null) {
                /* Stamp sync_status to reflect the drain outcome so
                 * the Capture UI shows the right badge immediately
                 * after the next poll — no more inference from
                 * central_uid alone. ACCEPTED → SYNCED (via
                 * markSynced), REJECTED → FAILED, CONFLICT →
                 * CONFLICT, RETRYABLE stays PENDING. */
                final java.time.Instant now = java.time.Instant.now();
                if (terminal == TerminalState.ACCEPTED) {
                    if (isDelete) {
                        relationshipRepo.purge(uid);
                    } else {
                        relationshipRepo.markSynced(uid, uid, now);
                    }
                } else if (terminal == TerminalState.REJECTED) {
                    relationshipRepo.markSyncStatus(uid,
                            ug.ac.mak.der.workflows.tracker
                                .TrackerRelationship.SyncStatus.FAILED, now);
                } else if (terminal == TerminalState.CONFLICT) {
                    relationshipRepo.markSyncStatus(uid,
                            ug.ac.mak.der.workflows.tracker
                                .TrackerRelationship.SyncStatus.CONFLICT, now);
                }
                // RETRYABLE: no status change, next drain pass retries.
            }
            return new PublishResult(status, respBody, terminal);
        } catch (IOException ex) {
            LOG.warn("relationship publish I/O failure: {}", ex.getMessage());
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new PublishResult(-1, "interrupted", TerminalState.RETRYABLE);
        }
    }

    /** DHIS2 2.44 wire-shape for POST /api/tracker — relationships
     *  live inside a top-level {@code relationships: [...]} array,
     *  each element having relationship / relationshipType /
     *  bidirectional + from/to sides. TEI sides wrap as
     *  {trackedEntity:{trackedEntity:"<uid>"}}; ENROLLMENT and
     *  EVENT sides use analogous {enrollment:{enrollment:"<uid>"}}
     *  / {event:{event:"<uid>"}} nesting. */
    private String buildRelationshipCreateBody(final ObjectNode payload) {
        final ObjectNode rel = jsonMapper.createObjectNode();
        rel.put("relationship", payload.path("relationshipUid").asText(""));
        rel.put("relationshipType",
                payload.path("relationshipType").asText(""));
        rel.put("bidirectional",
                payload.path("bidirectional").asBoolean(false));
        rel.set("from", relationshipSide(
                payload.path("fromEntityType").asText(""),
                payload.path("fromEntityUid").asText("")));
        rel.set("to", relationshipSide(
                payload.path("toEntityType").asText(""),
                payload.path("toEntityUid").asText("")));
        final ObjectNode envelope = jsonMapper.createObjectNode();
        envelope.putArray("relationships").add(rel);
        return envelope.toString();
    }

    /** DHIS2 2.44 DELETE envelope — same {@code /api/tracker}
     *  endpoint as CREATE but importStrategy=DELETE in the query
     *  string. Body only needs the relationship UID. */
    private String buildRelationshipDeleteBody(final String uid) {
        final ObjectNode rel = jsonMapper.createObjectNode();
        rel.put("relationship", uid);
        final ObjectNode envelope = jsonMapper.createObjectNode();
        envelope.putArray("relationships").add(rel);
        return envelope.toString();
    }

    private ObjectNode relationshipSide(final String kind, final String uid) {
        final ObjectNode side = jsonMapper.createObjectNode();
        final ObjectNode inner = jsonMapper.createObjectNode();
        inner.put(sideFieldName(kind), uid);
        side.set(sideFieldName(kind), inner);
        return side;
    }

    /** Enrolment-note drain handler. Reads the enqueued payload
     *  (operation=CREATE, enrollmentUid, noteUid, noteText), posts
     *  a tracker-envelope update to central that attaches the note
     *  to its parent enrolment, and on ACCEPTED stamps central_uid
     *  on the local note row so the dirty-subset lookup excludes
     *  it next tick. */
    private PublishResult publishEnrolmentNote(final OperationJournalEntry entry) {
        final JsonNode payload = entry.payload();
        if (!(payload instanceof ObjectNode obj)) {
            return new PublishResult(-1,
                    "enrolment-note payload missing or not an object",
                    TerminalState.REJECTED);
        }
        final String enrollmentUid = textOrNull(obj, "enrollmentUid");
        final String noteUid = textOrNull(obj, "noteUid");
        final String noteText = textOrNull(obj, "noteText");
        if (enrollmentUid == null || noteUid == null || noteText == null) {
            return new PublishResult(-1,
                    "enrolment-note payload missing required fields",
                    TerminalState.REJECTED);
        }
        try {
            final URI uri = URI.create(
                    props.central().baseUrl() + "/api/tracker");
            final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(Math.max(1_000,
                            props.central().connectTimeoutMillis())))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            buildEnrolmentNoteBody(enrollmentUid,
                                    noteUid, noteText),
                            StandardCharsets.UTF_8));
            if (props.central().username() != null
                    && !props.central().username().isBlank()) {
                final String token = props.central().username() + ":"
                        + (props.central().password() == null ? ""
                        : props.central().password());
                req.header("Authorization", "Basic "
                        + Base64.getEncoder().encodeToString(
                                token.getBytes(StandardCharsets.UTF_8)));
            }
            final HttpResponse<String> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            final int status = resp.statusCode();
            final String respBody = resp.body() == null ? "" : resp.body();
            final TerminalState terminal = ResponseClassifier.classify(status);
            if (terminal == TerminalState.ACCEPTED && noteRepo != null) {
                noteRepo.markSynced(noteUid, noteUid);
            }
            return new PublishResult(status, respBody, terminal);
        } catch (IOException ex) {
            LOG.warn("enrolment-note publish I/O failure: {}", ex.getMessage());
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new PublishResult(-1, "interrupted", TerminalState.RETRYABLE);
        }
    }

    /** DHIS2 2.44 tracker envelope — enrolment notes attach as
     *  {@code {enrollments: [{enrollment, notes: [{note, value}]}]}}.
     *  Central merges the note onto the existing enrolment. */
    private String buildEnrolmentNoteBody(final String enrollmentUid,
                                             final String noteUid,
                                             final String noteText) {
        final ObjectNode envelope = jsonMapper.createObjectNode();
        final ObjectNode enrolment = jsonMapper.createObjectNode();
        enrolment.put("enrollment", enrollmentUid);
        final ObjectNode note = jsonMapper.createObjectNode();
        note.put("note", noteUid);
        note.put("value", noteText);
        enrolment.putArray("notes").add(note);
        envelope.putArray("enrollments").add(enrolment);
        return envelope.toString();
    }

    private static String sideFieldName(final String kind) {
        return switch (kind) {
            case "TRACKED_ENTITY" -> "trackedEntity";
            case "ENROLLMENT" -> "enrollment";
            case "EVENT" -> "event";
            default -> "trackedEntity";
        };
    }

    private static String textOrNull(final JsonNode node, final String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return null;
        }
        return node.get(field).asText(null);
    }

    private String targetPath(final OperationJournalEntry entry) {
        final CapabilityFlags caps = engine.capabilities();
        return switch (entry.entityType()) {
            case AGGREGATE_DATA_VALUE -> caps.endpointPolicy(EndpointId.DATA_VALUE_SETS).path();
            case EVENT, PROGRAM_STAGE_EVENT -> {
                if (caps.trackerApi() == CapabilityFlags.TrackerApi.LEGACY_ONLY) {
                    yield caps.endpointPolicy(EndpointId.LEGACY_EVENTS_LIST).path();
                }
                // DHIS2 2.44 tracker writes (including DELETE via
                // importStrategy) go to /api/tracker, not
                // /api/tracker/events — the latter is a read-only
                // query endpoint that 405s on POST. TRACKER_EVENTS
                // stays correct for GETs elsewhere.
                yield caps.endpointPolicy(EndpointId.TRACKER_IMPORT).path();
            }
            case TRACKED_ENTITY, ENROLLMENT -> caps.endpointPolicy(EndpointId.TRACKER_IMPORT).path();
            /* RELATIONSHIP + ENROLMENT_NOTE entries never reach
             * targetPath — they're dispatched inline by their own
             * publishX methods. Returning a sentinel keeps the
             * switch exhaustive without misrouting any caller that
             * bypasses publish(). */
            case RELATIONSHIP -> "/api/relationships";
            case ENROLMENT_NOTE -> "/api/tracker";
            // SM-1a — DatasetCompletion rows POST their marker to the
            // standard DHIS2 completion resource. The resource accepts
            // {completeDataSetRegistrations:[{dataSet, period, orgUnit,
            // attributeOptionCombo?, completed, storedBy, date}]}.
            case AGGREGATE_DATASET_COMPLETION -> "/api/completeDataSetRegistrations";
        };
    }

    public enum TerminalState { ACCEPTED, REJECTED, RETRYABLE, CONFLICT }

    /** DHIS2 2.44 tracker-import-aware response classifier.
     *  Status-only classification (ResponseClassifier.classify) is
     *  insufficient for the tracker endpoint because central can
     *  return 200 OK with a per-object failure inside its
     *  bundleReport — e.g. one of several relationships in a batch
     *  was ignored or rejected while the batch overall was OK. For
     *  our single-relationship drain batches this still matters:
     *  that one object either made it in or it didn't.
     *
     *  Rules (in order):
     *  1. Non-2xx → delegate to ResponseClassifier.
     *  2. 2xx + unparseable body → ACCEPTED (keeps behaviour
     *     bug-compatible when central returns something exotic).
     *  3. Top-level status=ERROR → REJECTED.
     *  4. stats.ignored > 0 → REJECTED.
     *  5. Any objectReport with non-empty errorReports → REJECTED.
     *  6. Otherwise → ACCEPTED. */
    private TerminalState classifyTrackerImportResponse(
            final int status, final String body, final String uid) {
        if (status / 100 != 2) {
            return ResponseClassifier.classify(status);
        }
        if (body == null || body.isBlank()) {
            return TerminalState.ACCEPTED;
        }
        try {
            final JsonNode root = jsonMapper.readTree(body);
            final String topStatus = textOrNull(root, "status");
            if ("ERROR".equalsIgnoreCase(topStatus)) {
                logTrackerFailure(root, uid);
                return TerminalState.REJECTED;
            }
            final JsonNode stats = root.get("stats");
            if (stats != null && stats.has("ignored")
                    && stats.get("ignored").asInt(0) > 0) {
                logTrackerFailure(root, uid);
                return TerminalState.REJECTED;
            }
            // Dive into bundleReport.typeReportMap.RELATIONSHIP
            // .objectReports[].errorReports[] to find per-UID
            // failures. DHIS2 2.44 shape — if the shape changes
            // in a future version we fall back to ACCEPTED (the
            // top-level status gate above still catches the common
            // error case).
            final JsonNode typeMap = navigate(root,
                    "bundleReport", "typeReportMap", "RELATIONSHIP");
            if (typeMap != null) {
                final JsonNode objectReports = typeMap.get("objectReports");
                if (objectReports != null && objectReports.isArray()) {
                    for (final JsonNode or : objectReports) {
                        final JsonNode errs = or.get("errorReports");
                        if (errs != null && errs.isArray() && errs.size() > 0) {
                            logTrackerFailure(root, uid);
                            return TerminalState.REJECTED;
                        }
                    }
                }
            }
            return TerminalState.ACCEPTED;
        } catch (IOException ex) {
            // Body isn't valid JSON — fall back to status-only.
            return TerminalState.ACCEPTED;
        }
    }

    private static JsonNode navigate(final JsonNode root,
                                       final String... path) {
        JsonNode node = root;
        for (final String key : path) {
            if (node == null) {
                return null;
            }
            node = node.get(key);
        }
        return node;
    }

    private void logTrackerFailure(final JsonNode root, final String uid) {
        final JsonNode validation = root.get("validationReport");
        if (validation != null) {
            final JsonNode errs = validation.get("errorReports");
            if (errs != null && errs.isArray() && errs.size() > 0) {
                LOG.warn("tracker import rejected for {}: {}",
                        uid, errs.toString());
                return;
            }
        }
        LOG.warn("tracker import rejected for {}: {}", uid,
                root.toString());
    }

    public record PublishResult(int status, String body, TerminalState terminal) { }
}
