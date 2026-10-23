package ug.ac.mak.der.dhis2emulator;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * Opt-in catch-all passthrough proxy from DER's {@code /api/**} to the
 * configured central DHIS2 instance. Only fires for paths NOT already
 * handled by the emulator (Spring MVC prefers more-specific patterns).
 *
 * <p>Enabled by {@code der.dhis2.proxy.enabled=true}. When disabled,
 * the controller returns {@code 501 Not Implemented} so custom apps
 * see a predictable "feature not available offline" response instead
 * of a confusing 404.</p>
 *
 * <p>Read-side only by default: {@code GET} + {@code HEAD}. Write
 * methods ({@code POST}, {@code PUT}, {@code DELETE}, {@code PATCH})
 * are blocked because DER's journal + conflict-review path must be
 * authoritative for writes. Operators who need write passthrough
 * (e.g. for a reporting app that calls an analytics POST) can
 * opt in via {@code der.dhis2.proxy.allow-writes=true}.</p>
 *
 * <p>Path allow-list: by default only {@code /api/analytics},
 * {@code /api/events/query}, {@code /api/dataValueSets.json},
 * {@code /api/me/*}, {@code /api/userDataStore},
 * {@code /api/dataStore}, {@code /api/sqlViews},
 * {@code /api/visualizations}, {@code /api/eventReports},
 * {@code /api/maps}. Override via {@code der.dhis2.proxy.allow-paths}.</p>
 */
@RestController
@RequestMapping(path = "/api/**", produces = MediaType.APPLICATION_JSON_VALUE)
public class Dhis2ApiProxyController {

    private static final Logger LOG = LoggerFactory.getLogger(Dhis2ApiProxyController.class);
    private static final Set<String> DEFAULT_ALLOW = Set.of(
            "/api/analytics", "/api/events/query", "/api/dataValueSets.json",
            "/api/me", "/api/userDataStore", "/api/dataStore",
            "/api/sqlViews", "/api/visualizations", "/api/eventReports",
            "/api/maps", "/api/charts", "/api/reports", "/api/indicators",
            "/api/organisationUnitLevels", "/api/categoryOptions",
            "/api/categoryOptionCombos", "/api/categoryCombos");

    private final HttpClient http;
    private final Dhis2Properties props;
    private final boolean enabled;
    private final boolean allowWrites;
    private final Set<String> allowPrefixes;

    public Dhis2ApiProxyController(final HttpClient http, final Dhis2Properties props,
                                     @Value("${der.dhis2.proxy.enabled:false}") final boolean enabled,
                                     @Value("${der.dhis2.proxy.allow-writes:false}") final boolean allowWrites,
                                     @Value("${der.dhis2.proxy.allow-paths:}") final String allowPaths) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.enabled = enabled;
        this.allowWrites = allowWrites;
        this.allowPrefixes = parseAllow(allowPaths);
    }

    private static Set<String> parseAllow(final String csv) {
        if (csv == null || csv.isBlank()) {
            return DEFAULT_ALLOW;
        }
        final Set<String> out = new LinkedHashSet<>();
        for (final String s : csv.split(",")) {
            final String t = s.trim();
            if (!t.isBlank()) {
                out.add(t);
            }
        }
        return out.isEmpty() ? DEFAULT_ALLOW : out;
    }

    @RequestMapping(method = {RequestMethod.GET, RequestMethod.HEAD, RequestMethod.POST,
            RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public ResponseEntity<byte[]> proxy(final HttpServletRequest request,
                                          @RequestBody(required = false) final byte[] body) {
        if (!enabled) {
            return ResponseEntity.status(501).body(
                    ("{\"httpStatus\":\"NotImplemented\",\"httpStatusCode\":501,"
                            + "\"status\":\"ERROR\",\"message\":\"DHIS2 passthrough proxy is "
                            + "disabled on this edge; this request is not supported offline.\"}")
                            .getBytes(StandardCharsets.UTF_8));
        }
        final String method = request.getMethod();
        if (!isReadMethod(method) && !allowWrites) {
            return ResponseEntity.status(405).body(
                    "{\"status\":\"ERROR\",\"message\":\"writes blocked at proxy\"}"
                            .getBytes(StandardCharsets.UTF_8));
        }
        if (props.central().baseUrl() == null || props.central().baseUrl().isBlank()) {
            return ResponseEntity.status(503).body(
                    "{\"status\":\"ERROR\",\"message\":\"central not configured\"}"
                            .getBytes(StandardCharsets.UTF_8));
        }
        final String path = request.getRequestURI();
        if (!matchesAllowList(path)) {
            return ResponseEntity.status(403).body(
                    ("{\"status\":\"ERROR\",\"message\":\"path not in proxy allow-list: "
                            + path + "\"}").getBytes(StandardCharsets.UTF_8));
        }
        final String query = request.getQueryString();
        try {
            final URI target = new URI(props.central().baseUrl()
                    + path + (query == null ? "" : "?" + query));
            final HttpRequest.Builder req = HttpRequest.newBuilder(target)
                    .timeout(Duration.ofMillis(
                            Math.max(1000, props.central().connectTimeoutMillis())))
                    .method(method, body == null || body.length == 0
                            ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body));
            copyForwardableHeaders(request, req);
            addAuth(req);
            final HttpResponse<byte[]> resp = http.send(req.build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            final HttpHeaders out = new HttpHeaders();
            resp.headers().map().forEach((k, v) -> {
                if (isForwardableResponseHeader(k)) {
                    out.put(k, v);
                }
            });
            return ResponseEntity.status(resp.statusCode()).headers(out).body(resp.body());
        } catch (URISyntaxException ex) {
            return ResponseEntity.status(400).body(
                    ("{\"status\":\"ERROR\",\"message\":\"invalid target: "
                            + ex.getMessage() + "\"}").getBytes(StandardCharsets.UTF_8));
        } catch (IOException ex) {
            LOG.warn("proxy I/O failure: {}", ex.getMessage());
            return ResponseEntity.status(502).body(
                    ("{\"status\":\"ERROR\",\"message\":\"upstream I/O: "
                            + ex.getMessage() + "\"}").getBytes(StandardCharsets.UTF_8));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(504).body(
                    "{\"status\":\"ERROR\",\"message\":\"upstream interrupted\"}"
                            .getBytes(StandardCharsets.UTF_8));
        }
    }

    private static boolean isReadMethod(final String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method);
    }

    private boolean matchesAllowList(final String path) {
        for (final String p : allowPrefixes) {
            if (path.equals(p) || path.startsWith(p + "/") || path.startsWith(p + ".")) {
                return true;
            }
        }
        return false;
    }

    private static void copyForwardableHeaders(final HttpServletRequest request,
                                                 final HttpRequest.Builder req) {
        final List<String> forward = Arrays.asList("Accept", "Accept-Language", "Content-Type");
        for (final String name : forward) {
            final String v = request.getHeader(name);
            if (v != null && !v.isBlank()) {
                req.header(name, v);
            }
        }
    }

    private void addAuth(final HttpRequest.Builder req) {
        if (props.central().username() == null || props.central().username().isBlank()) {
            return;
        }
        final String token = props.central().username() + ":"
                + (props.central().password() == null ? "" : props.central().password());
        req.header("Authorization", "Basic "
                + Base64.getEncoder().encodeToString(token.getBytes(StandardCharsets.UTF_8)));
    }

    private static boolean isForwardableResponseHeader(final String name) {
        final String lower = name.toLowerCase();
        return lower.equals("content-type") || lower.equals("content-length")
                || lower.equals("cache-control") || lower.equals("etag")
                || lower.equals("last-modified") || lower.equals("vary");
    }
}
