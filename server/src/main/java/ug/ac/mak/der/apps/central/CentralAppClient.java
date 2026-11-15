package ug.ac.mak.der.apps.central;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * DER-APPS-DHIS2-001 FR-SYNC-002/003 — thin HTTP client over central
 * DHIS2's {@code /api/apps} surface. Isolated from
 * {@link CentralAppSyncService} so the sync loop stays focused on
 * diff + install logic and can be unit-tested against a mocked client.
 */
@Component
public class CentralAppClient {

    private static final Logger LOG = LoggerFactory.getLogger(CentralAppClient.class);

    private final HttpClient http;
    private final Dhis2Properties props;
    private final ObjectMapper json;

    public CentralAppClient(final HttpClient http,
                             final Dhis2Properties props,
                             final ObjectMapper json) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.json = Objects.requireNonNull(json, "json");
    }

    /** @return {@code true} iff {@code der.dhis2.central.base-url}
     *  is configured. */
    public boolean centralConfigured() {
        return props.central().baseUrl() != null
                && !props.central().baseUrl().isBlank();
    }

    /**
     * Enumerate central's app catalogue. Returns an empty list when
     * central is unreachable or the response is malformed — the sync
     * loop surfaces that as an OK-with-zero-discovered run rather than
     * aborting hard, so a transient network blip doesn't leave the
     * admin screen showing "FAILED" for 6h.
     */
    public List<CentralApp> listApps() throws IOException {
        if (!centralConfigured()) {
            return List.of();
        }
        final URI target;
        try {
            target = new URI(props.central().baseUrl() + "/api/apps");
        } catch (URISyntaxException ex) {
            throw new IOException("invalid central baseUrl", ex);
        }
        final HttpRequest.Builder req = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMillis(
                        Math.max(1000, props.central().connectTimeoutMillis())))
                .header("Accept", "application/json")
                .GET();
        addAuth(req);
        final HttpResponse<byte[]> resp;
        try {
            resp = http.send(req.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted calling central", ex);
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            LOG.warn("central /api/apps returned {}", resp.statusCode());
            return List.of();
        }
        return parse(resp.body());
    }

    public byte[] fetchBundle(final String downloadUrl) throws IOException {
        Objects.requireNonNull(downloadUrl, "downloadUrl");
        final URI target;
        try {
            target = new URI(resolve(downloadUrl));
        } catch (URISyntaxException ex) {
            throw new IOException("invalid downloadUrl: " + downloadUrl, ex);
        }
        final HttpRequest.Builder req = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMillis(
                        Math.max(1000, props.central().connectTimeoutMillis())))
                .GET();
        addAuth(req);
        final HttpResponse<byte[]> resp;
        try {
            resp = http.send(req.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted fetching bundle", ex);
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IOException("central bundle fetch returned "
                    + resp.statusCode());
        }
        return resp.body();
    }

    /** Resolve a relative {@code downloadUrl} against the configured
     *  central base; absolute URLs pass through. */
    private String resolve(final String downloadUrl) {
        if (downloadUrl.startsWith("http://") || downloadUrl.startsWith("https://")) {
            return downloadUrl;
        }
        final String base = props.central().baseUrl();
        if (downloadUrl.startsWith("/")) {
            return base + downloadUrl;
        }
        return base + "/" + downloadUrl;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private List<CentralApp> parse(final byte[] body) throws IOException {
        if (body == null || body.length == 0) {
            return List.of();
        }
        // Central may return either a bare array or an {apps: [...]}
        // envelope depending on version. Probe the first non-whitespace
        // byte so we can route both without heavy reflection.
        final int first = firstNonWhitespace(body);
        if (first < 0) {
            return List.of();
        }
        final CollectionType listType = json.getTypeFactory()
                .constructCollectionType(List.class, CentralApp.class);
        if (body[first] == '[') {
            return Collections.unmodifiableList(json.readValue(body, listType));
        }
        final var envelope = json.readValue(body, java.util.Map.class);
        final Object inner = envelope.get("apps");
        if (!(inner instanceof List list)) {
            return List.of();
        }
        return Collections.unmodifiableList(
                json.convertValue(list, listType));
    }

    private static int firstNonWhitespace(final byte[] body) {
        for (int i = 0; i < body.length; i++) {
            final byte b = body[i];
            if (b != ' ' && b != '\t' && b != '\n' && b != '\r') {
                return i;
            }
        }
        return -1;
    }

    private void addAuth(final HttpRequest.Builder req) {
        if (props.central().username() == null
                || props.central().username().isBlank()) {
            return;
        }
        final String token = props.central().username() + ":"
                + (props.central().password() == null ? ""
                : props.central().password());
        req.header("Authorization", "Basic "
                + Base64.getEncoder().encodeToString(
                        token.getBytes(StandardCharsets.UTF_8)));
    }
}
