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

    @Autowired
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder,
                             final ObjectMapper jsonMapper,
                             final TrackerRelationshipRepository relationshipRepo) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.engine = Objects.requireNonNull(engine, "engine");
        this.referralEncoder = Objects.requireNonNull(referralEncoder, "referralEncoder");
        this.jsonMapper = Objects.requireNonNull(jsonMapper, "jsonMapper");
        this.relationshipRepo = relationshipRepo;
    }

    /** Back-compat ctor for pre-slice-3 callers (tests). Omitting
     *  the relationship repo disables the post-publish repo
     *  side-effects. */
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder,
                             final ObjectMapper jsonMapper) {
        this(http, props, engine, referralEncoder, jsonMapper, null);
    }

    /** Back-compat ctor for pre-R-D/tracker-async callers (tests). */
    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine,
                             final ReferralPayloadEncoder referralEncoder) {
        this(http, props, engine, referralEncoder, new ObjectMapper(), null);
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
        final String path;
        try {
            path = targetPath(entry);
        } catch (Dhis2CompatibilityUnavailableException ex) {
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        }
        try {
            final URI uri = URI.create(props.central().baseUrl() + path);
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
        final boolean isDelete = "DELETE".equalsIgnoreCase(operation);
        final String path = isDelete
                ? "/api/relationships/" + uid
                : "/api/relationships";
        try {
            final URI uri = URI.create(props.central().baseUrl() + path);
            final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofMillis(Math.max(1_000,
                            props.central().connectTimeoutMillis())))
                    .header("Accept", "application/json");
            if (isDelete) {
                req.DELETE();
            } else {
                req.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(
                                buildRelationshipCreateBody(obj),
                                StandardCharsets.UTF_8));
            }
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
            /* Local side-effects only on ACCEPTED. RETRYABLE +
             * REJECTED + CONFLICT leave the row in its current
             * state so the next drain retries (RETRYABLE) or the
             * operator sees it in the attention queue (REJECTED /
             * CONFLICT). */
            if (terminal == TerminalState.ACCEPTED && relationshipRepo != null) {
                if (isDelete) {
                    relationshipRepo.purge(uid);
                } else {
                    relationshipRepo.markSynced(uid, uid,
                            java.time.Instant.now());
                }
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

    /** DHIS2 wire-shape for POST /api/relationships (TEI↔TEI
     *  today). Reads the flat payload the controller enqueued +
     *  wraps each side in {trackedEntity:{trackedEntity:"<uid>"}}
     *  per /api/tracker shape. ENROLLMENT / EVENT sides use the
     *  analogous {enrollment:{enrollment:"<uid>"}} nesting. */
    private String buildRelationshipCreateBody(final ObjectNode payload) {
        final ObjectNode out = jsonMapper.createObjectNode();
        out.put("relationship", payload.path("relationshipUid").asText(""));
        out.put("relationshipType",
                payload.path("relationshipType").asText(""));
        out.put("bidirectional",
                payload.path("bidirectional").asBoolean(false));
        out.set("from", relationshipSide(
                payload.path("fromEntityType").asText(""),
                payload.path("fromEntityUid").asText("")));
        out.set("to", relationshipSide(
                payload.path("toEntityType").asText(""),
                payload.path("toEntityUid").asText("")));
        return out.toString();
    }

    private ObjectNode relationshipSide(final String kind, final String uid) {
        final ObjectNode side = jsonMapper.createObjectNode();
        final ObjectNode inner = jsonMapper.createObjectNode();
        inner.put(sideFieldName(kind), uid);
        side.set(sideFieldName(kind), inner);
        return side;
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
                yield caps.endpointPolicy(EndpointId.TRACKER_EVENTS).path();
            }
            case TRACKED_ENTITY, ENROLLMENT -> caps.endpointPolicy(EndpointId.TRACKER_IMPORT).path();
            /* RELATIONSHIP entries never reach targetPath — they're
             * dispatched inline via publishRelationship(). Returning
             * the base path keeps the switch exhaustive without
             * misrouting any caller that bypasses publish(). */
            case RELATIONSHIP -> "/api/relationships";
        };
    }

    public enum TerminalState { ACCEPTED, REJECTED, RETRYABLE, CONFLICT }

    public record PublishResult(int status, String body, TerminalState terminal) { }
}
