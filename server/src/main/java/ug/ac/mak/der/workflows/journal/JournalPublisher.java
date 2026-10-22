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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2Properties;
import ug.ac.mak.der.dhis2.compatibility.CapabilityFlags;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityEngine;
import ug.ac.mak.der.dhis2.compatibility.Dhis2CompatibilityUnavailableException;
import ug.ac.mak.der.dhis2.compatibility.EndpointId;
import ug.ac.mak.der.workflows.aggregate.OperationJournalEntry;

/**
 * Publishes a journal entry's payload to central. Capability-aware routing per
 * ADR-0010. Returns a classified {@link PublishResult}.
 */
@Service
public class JournalPublisher {

    private static final Logger LOG = LoggerFactory.getLogger(JournalPublisher.class);

    private final HttpClient http;
    private final Dhis2Properties props;
    private final Dhis2CompatibilityEngine engine;

    public JournalPublisher(final HttpClient http, final Dhis2Properties props,
                             final Dhis2CompatibilityEngine engine) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.engine = Objects.requireNonNull(engine, "engine");
    }

    public PublishResult publish(final OperationJournalEntry entry) {
        if (props.central().baseUrl() == null || props.central().baseUrl().isBlank()) {
            return new PublishResult(-1, "central not configured", TerminalState.RETRYABLE);
        }
        final String path;
        try {
            path = targetPath(entry);
        } catch (Dhis2CompatibilityUnavailableException ex) {
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        }
        try {
            final URI uri = URI.create(props.central().baseUrl() + path);
            final String body = entry.payload() == null ? "{}" : entry.payload().toString();
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
            return new PublishResult(status, resp.body() == null ? "" : resp.body(),
                    ResponseClassifier.classify(status));
        } catch (IOException ex) {
            LOG.warn("publish I/O failure: {}", ex.getMessage());
            return new PublishResult(-1, ex.getMessage(), TerminalState.RETRYABLE);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return new PublishResult(-1, "interrupted", TerminalState.RETRYABLE);
        }
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
        };
    }

    public enum TerminalState { ACCEPTED, REJECTED, RETRYABLE, CONFLICT }

    public record PublishResult(int status, String body, TerminalState terminal) { }
}
