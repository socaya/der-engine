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
import org.springframework.beans.factory.ObjectProvider;
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
 * <p>Enabled by {@code der.dhis2.proxy.enabled=true}. When disabled —
 * or when the path doesn't match the allow-list, or central is not
 * configured — the controller returns the DER-APPS-DHIS2-001 FR-EMU-007
 * envelope: {@code 404 { code: EMULATOR_NOT_IMPLEMENTED, endpoint, … }}
 * and records a hit in {@code der.emulator_miss} so the admin
 * {@code /system/apps} diagnostic (FR-DIAG-002) can show operators
 * which endpoints their apps are actually asking for.</p>
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
            "/api/organisationUnitLevels", "/api/organisationUnitGroups",
            "/api/organisationUnitGroupSets", "/api/categoryOptions",
            "/api/categoryOptionCombos", "/api/categoryCombos");

    private final HttpClient http;
    private final Dhis2Properties props;
    private final boolean enabled;
    private final boolean allowWrites;
    private final Set<String> allowPrefixes;
    private final ObjectProvider<EmulatorMissRepository> missRepo;

    public Dhis2ApiProxyController(final HttpClient http, final Dhis2Properties props,
                                     @Value("${der.dhis2.proxy.enabled:true}") final boolean enabled,
                                     @Value("${der.dhis2.proxy.allow-writes:false}") final boolean allowWrites,
                                     @Value("${der.dhis2.proxy.allow-paths:}") final String allowPaths,
                                     final ObjectProvider<EmulatorMissRepository> missRepo) {
        this.http = Objects.requireNonNull(http, "http");
        this.props = Objects.requireNonNull(props, "props");
        this.enabled = enabled;
        this.allowWrites = allowWrites;
        this.allowPrefixes = parseAllow(allowPaths);
        this.missRepo = missRepo;
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
        final String path = request.getRequestURI();
        final String origin = originHint(request);
        if (!enabled) {
            logMiss(path, origin);
            return ResponseEntity.status(404).body(
                    notImplementedBody(path,
                            "DHIS2 passthrough proxy is disabled on this edge; "
                                    + "this request is not supported offline."));
        }
        final String method = request.getMethod();
        if (!isReadMethod(method) && !allowWrites) {
            logMiss(path, origin);
            return ResponseEntity.status(404).body(
                    notImplementedBody(path,
                            "Writes to this endpoint are blocked at the "
                                    + "DER proxy. Use DER's authoring surface or "
                                    + "the journal/sync path for durable writes."));
        }
        if (props.central().baseUrl() == null || props.central().baseUrl().isBlank()) {
            logMiss(path, origin);
            return ResponseEntity.status(404).body(
                    notImplementedBody(path,
                            "No central DHIS2 is configured; this endpoint is "
                                    + "not mirrored by the DER emulator."));
        }
        if (!matchesAllowList(path)) {
            logMiss(path, origin);
            return ResponseEntity.status(404).body(
                    notImplementedBody(path,
                            "Endpoint is not mirrored by the DER emulator and "
                                    + "is not on the proxy allow-list."));
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
            // FR-04-06 category #2: INVALID_REQUEST. Distinct from
            // the unsupported-endpoint 404 (different code field so
            // clients can route behaviour).
            return ResponseEntity.status(400).body(invalidRequestBody(
                    path, "invalid upstream target: " + ex.getMessage()));
        } catch (IOException ex) {
            // FR-04-06 category #3: TEMPORARY_FAILURE. The caller
            // should retry; the request itself is valid, central
            // just isn't reachable right now.
            LOG.warn("proxy I/O failure: {}", ex.getMessage());
            return ResponseEntity.status(502).body(upstreamUnavailableBody(
                    path, "upstream I/O: " + ex.getMessage()));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(504).body(upstreamInterruptedBody(path));
        }
    }

    private static boolean isReadMethod(final String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method);
    }

    /**
     * FR-04-06 — invariant error-envelope shape. Every non-pass-through
     * response from this controller emits {@code { httpStatus,
     * httpStatusCode, status: "ERROR", code, endpoint, message }}.
     * The {@code code} field is the FR-04-06 category discriminator:
     *
     * <ul>
     *   <li>{@code EMULATOR_NOT_IMPLEMENTED} — unsupported operation
     *     (DER doesn't mirror / proxy this endpoint). 404.</li>
     *   <li>{@code INVALID_REQUEST} — the request itself is malformed
     *     before it ever leaves DER. 400.</li>
     *   <li>{@code UPSTREAM_UNAVAILABLE} — valid request, central
     *     didn't answer. Caller should retry. 502.</li>
     *   <li>{@code UPSTREAM_INTERRUPTED} — thread interrupted mid-
     *     upstream. Caller should retry. 504.</li>
     * </ul>
     */
    private static byte[] envelope(final int status,
                                     final String httpStatusLabel,
                                     final String code,
                                     final String endpoint,
                                     final String message) {
        final String escapedPath = endpoint == null ? ""
                : endpoint.replace("\"", "\\\"");
        final String escapedMessage = message == null ? ""
                : message.replace("\"", "\\\"");
        return ("{\"httpStatus\":\"" + httpStatusLabel + "\","
                + "\"httpStatusCode\":" + status + ","
                + "\"status\":\"ERROR\","
                + "\"code\":\"" + code + "\","
                + "\"endpoint\":\"" + escapedPath + "\","
                + "\"message\":\"" + escapedMessage + "\"}")
                .getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] invalidRequestBody(final String endpoint,
                                               final String message) {
        return envelope(400, "BadRequest", "INVALID_REQUEST",
                endpoint, message);
    }

    private static byte[] upstreamUnavailableBody(final String endpoint,
                                                    final String message) {
        return envelope(502, "BadGateway", "UPSTREAM_UNAVAILABLE",
                endpoint, message);
    }

    private static byte[] upstreamInterruptedBody(final String endpoint) {
        return envelope(504, "GatewayTimeout", "UPSTREAM_INTERRUPTED",
                endpoint, "upstream call interrupted before a response landed");
    }

    /**
     * EMULATOR_NOT_IMPLEMENTED envelope (DER-APPS-DHIS2-001 FR-EMU-007).
     * DHIS2 apps historically treat 404 on {@code /api/*} as "endpoint
     * doesn't exist on this server," which is exactly the semantic we
     * want. The extra {@code code} field lets DER tooling distinguish
     * emulator misses from genuine object-not-found.
     */
    private static byte[] notImplementedBody(final String path,
                                                final String message) {
        return envelope(404, "NotFound", "EMULATOR_NOT_IMPLEMENTED",
                path, message);
    }

    private void logMiss(final String path, final String origin) {
        if (missRepo == null) {
            return;
        }
        final EmulatorMissRepository repo = missRepo.getIfAvailable();
        if (repo == null) {
            return;
        }
        try {
            repo.record(path, origin);
        } catch (RuntimeException ex) {
            LOG.debug("emulator_miss record failed: {}", ex.getMessage());
        }
    }

    /**
     * Best-effort attribution of the calling app. The static-handler
     * serves app index pages from {@code /apps/{appKey}}, and
     * iframe-hosted apps send {@code Referer: /apps/{appKey}}. If we
     * can't parse it, we store "" — the admin table just shows the
     * endpoint instead.
     */
    private static String originHint(final HttpServletRequest request) {
        final String referer = request.getHeader("Referer");
        if (referer == null || referer.isBlank()) {
            return "";
        }
        final int anchor = referer.indexOf("/apps/");
        if (anchor < 0) {
            return "";
        }
        final String after = referer.substring(anchor + "/apps/".length());
        final int end = indexOfAny(after, '/', '?', '#');
        return end < 0 ? after : after.substring(0, end);
    }

    private static int indexOfAny(final String s, final char... chars) {
        int best = -1;
        for (final char c : chars) {
            final int i = s.indexOf(c);
            if (i >= 0 && (best < 0 || i < best)) {
                best = i;
            }
        }
        return best;
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
