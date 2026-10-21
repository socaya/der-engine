package ug.ac.mak.der.dhis2;

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

/**
 * Minimal HTTP client that queries {@code GET /api/system/info} on the pinned
 * central DHIS2 and parses the response into a {@link Dhis2Version}.
 *
 * <p>Deliberately dependency-light: uses only {@link HttpClient} and Jackson,
 * which the server already pulls in via Spring Boot starters. No retry logic,
 * no connection pooling heuristics — Phase 04 introduces those as part of the
 * durable sync worker; Phase 01 just needs a correct probe.</p>
 */
public class Dhis2ReferenceClient {

    private static final String INFO_PATH = "/api/system/info";

    private final HttpClient http;
    private final ObjectMapper mapper;
    private final Dhis2Properties.Central central;

    public Dhis2ReferenceClient(final HttpClient http, final ObjectMapper mapper,
                                final Dhis2Properties.Central central) {
        this.http = Objects.requireNonNull(http, "http");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.central = Objects.requireNonNull(central, "central");
    }

    /**
     * Perform the probe. Throws {@link Dhis2UnreachableException} if the central
     * cannot be reached or returns a non-2xx status; throws
     * {@link Dhis2ResponseException} if the body is not valid JSON or lacks
     * {@code version}.
     */
    public Dhis2Version fetchVersion() throws Dhis2UnreachableException, Dhis2ResponseException {
        if (central.baseUrl() == null || central.baseUrl().isBlank()) {
            throw new Dhis2UnreachableException("der.dhis2.central.base-url is not configured", null);
        }
        final URI uri = URI.create(central.baseUrl() + INFO_PATH);
        final HttpRequest.Builder req = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(Math.max(1_000, central.connectTimeoutMillis())))
                .header("Accept", "application/json")
                .GET();
        if (central.username() != null && !central.username().isBlank()) {
            final String token = central.username() + ":" + (central.password() == null ? "" : central.password());
            req.header("Authorization",
                    "Basic " + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8)));
        }

        final HttpResponse<String> resp;
        try {
            resp = http.send(req.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            throw new Dhis2UnreachableException("I/O error contacting " + uri, ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new Dhis2UnreachableException("Interrupted contacting " + uri, ex);
        }
        if (resp.statusCode() / 100 != 2) {
            throw new Dhis2UnreachableException("DHIS2 " + INFO_PATH + " returned HTTP " + resp.statusCode(), null);
        }

        final JsonNode body;
        try {
            body = mapper.readTree(resp.body());
        } catch (IOException ex) {
            throw new Dhis2ResponseException("Response body is not valid JSON", ex);
        }
        final JsonNode versionNode = body.get("version");
        if (versionNode == null || !versionNode.isTextual() || versionNode.asText().isBlank()) {
            throw new Dhis2ResponseException("Response is missing a non-blank 'version' field", null);
        }
        final String revision = textOrNull(body.get("revision"));
        final String buildTime = textOrNull(body.get("buildTime"));
        return new Dhis2Version(versionNode.asText(), revision, buildTime);
    }

    private static String textOrNull(final JsonNode node) {
        return node == null || !node.isTextual() ? null : node.asText();
    }

    /** Thrown when the DHIS2 central cannot be reached or returns non-2xx. */
    public static final class Dhis2UnreachableException extends Exception {
        private static final long serialVersionUID = 1L;
        public Dhis2UnreachableException(final String msg, final Throwable cause) {
            super(msg, cause);
        }
    }

    /** Thrown when the DHIS2 central responds but with an unexpected payload. */
    public static final class Dhis2ResponseException extends Exception {
        private static final long serialVersionUID = 1L;
        public Dhis2ResponseException(final String msg, final Throwable cause) {
            super(msg, cause);
        }
    }
}
