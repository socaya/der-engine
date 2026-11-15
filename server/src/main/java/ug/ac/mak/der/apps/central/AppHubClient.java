package ug.ac.mak.der.apps.central;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import ug.ac.mak.der.dhis2.Dhis2Properties;

/**
 * Central-sync upstream for the DHIS2 App Hub
 * ({@code https://apps.dhis2.org/api/v1}).
 *
 * <p>The sibling {@link CentralAppClient} talks to the DHIS2 instance
 * DER is paired with; its {@code /api/apps} response doesn't include
 * downloadable bundle URLs, which blocks real auto-install for stock
 * apps. The App Hub does — each app lists a {@code versions} array
 * with signed {@code downloadUrl}s plus DHIS2-version compatibility
 * bounds, so DER can pick the right version for its pinned central.</p>
 *
 * <p>Mapping to {@link CentralApp} per hub app:
 * <ul>
 *   <li>pick the highest {@code version} whose
 *       {@code [minDhisVersion, maxDhisVersion]} window includes the
 *       DER compat pin ({@code der.dhis2.compatibility.max-tested-version});
 *       versions with an empty / absent {@code maxDhisVersion} count
 *       as unbounded above.</li>
 *   <li>when no version is in-range, the app is skipped (logged WARN;
 *       FR-SYNC-005 preview shows it with reason "no compatible
 *       version"). We don't fall back to the newest-ever version —
 *       installing a stock bundle that explicitly declared it needs
 *       a newer DHIS2 than DER wraps is exactly the risk FR-SYNC-008
 *       protects against, and silent fallback would defeat that.</li>
 * </ul>
 */
@Component
public class AppHubClient {

    private static final Logger LOG = LoggerFactory.getLogger(AppHubClient.class);

    private final HttpClient http;
    private final ObjectMapper json;
    private final String baseUrl;
    private final int connectTimeoutMillis;
    private final String derCompatVersion;

    public AppHubClient(final HttpClient http,
                          final ObjectMapper json,
                          final Dhis2Properties props,
                          @Value("${der.apps.central-sync.app-hub-base-url:"
                                  + "https://apps.dhis2.org/api/v1}") final String baseUrl) {
        this.http = Objects.requireNonNull(http, "http");
        this.json = Objects.requireNonNull(json, "json");
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.connectTimeoutMillis = Math.max(1000,
                props.central().connectTimeoutMillis());
        this.derCompatVersion = Objects.requireNonNull(
                props.compatibility().maxTestedVersion(), "maxTestedVersion");
    }

    public List<CentralApp> listApps() throws IOException {
        if (baseUrl == null || baseUrl.isBlank()) {
            return List.of();
        }
        final URI target;
        try {
            target = new URI(baseUrl + "/apps");
        } catch (URISyntaxException ex) {
            throw new IOException("invalid app-hub base-url", ex);
        }
        final HttpRequest req = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMillis(connectTimeoutMillis))
                .header("Accept", "application/json")
                .GET().build();
        final HttpResponse<byte[]> resp;
        try {
            resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted calling app hub", ex);
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            LOG.warn("app hub returned {}", resp.statusCode());
            return List.of();
        }
        return parse(resp.body());
    }

    public byte[] fetchBundle(final String downloadUrl) throws IOException {
        Objects.requireNonNull(downloadUrl, "downloadUrl");
        if (!downloadUrl.startsWith("http://") && !downloadUrl.startsWith("https://")) {
            throw new IOException("app-hub downloadUrl must be absolute: "
                    + downloadUrl);
        }
        final URI target;
        try {
            target = new URI(downloadUrl);
        } catch (URISyntaxException ex) {
            throw new IOException("invalid app-hub downloadUrl", ex);
        }
        final HttpRequest req = HttpRequest.newBuilder(target)
                .timeout(Duration.ofMillis(connectTimeoutMillis))
                .GET().build();
        final HttpResponse<byte[]> resp;
        try {
            resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted fetching app-hub bundle", ex);
        }
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IOException("app-hub bundle fetch returned "
                    + resp.statusCode());
        }
        return resp.body();
    }

    private List<CentralApp> parse(final byte[] body) throws IOException {
        if (body == null || body.length == 0) {
            return List.of();
        }
        final HubApp[] raw = json.readValue(body, HubApp[].class);
        final List<CentralApp> out = new ArrayList<>(raw.length);
        for (final HubApp app : raw) {
            if (app == null) {
                continue;
            }
            final HubVersion v = pickVersion(app);
            if (v == null) {
                LOG.info("app-hub app {} has no version compatible with DHIS2 {}",
                        app.name, derCompatVersion);
                continue;
            }
            final String key = app.key == null || app.key.isBlank()
                    ? slugify(app.name) : app.key;
            out.add(new CentralApp(key, app.name,
                    v.version, v.downloadUrl,
                    null,  // sha256 not advertised by hub
                    null));  // signature likewise
        }
        return Collections.unmodifiableList(out);
    }

    /**
     * Highest {@code HubVersion.version} whose
     * {@code [minDhisVersion, maxDhisVersion]} window includes DER's
     * compat pin. Simple semver compare on major.minor; patch is
     * ignored (DHIS2 compat windows are expressed at minor-level).
     */
    HubVersion pickVersion(final HubApp app) {
        if (app.versions == null) {
            return null;
        }
        HubVersion best = null;
        for (final HubVersion v : app.versions) {
            if (v == null || v.version == null || v.downloadUrl == null) {
                continue;
            }
            if (!compatible(v, derCompatVersion)) {
                continue;
            }
            if (best == null || compareSemver(v.version, best.version) > 0) {
                best = v;
            }
        }
        return best;
    }

    static boolean compatible(final HubVersion v, final String derVersion) {
        if (v.minDhisVersion != null && !v.minDhisVersion.isBlank()
                && compareSemver(derVersion, v.minDhisVersion) < 0) {
            return false;
        }
        if (v.maxDhisVersion != null && !v.maxDhisVersion.isBlank()
                && compareSemver(derVersion, v.maxDhisVersion) > 0) {
            return false;
        }
        return true;
    }

    /**
     * Lexical-numeric compare on the first two dot-separated segments.
     * {@code "2.44" > "2.41"}, {@code "2.44" == "2.44.1"} (patch
     * ignored). Non-numeric segments compare lexically.
     */
    static int compareSemver(final String left, final String right) {
        if (left == null) {
            return right == null ? 0 : -1;
        }
        if (right == null) {
            return 1;
        }
        final String[] l = left.split("\\.", -1);
        final String[] r = right.split("\\.", -1);
        for (int i = 0; i < 2; i++) {
            final String ls = i < l.length ? l[i] : "0";
            final String rs = i < r.length ? r[i] : "0";
            try {
                final int cmp = Integer.compare(Integer.parseInt(ls),
                        Integer.parseInt(rs));
                if (cmp != 0) {
                    return cmp;
                }
            } catch (NumberFormatException ex) {
                final int cmp = ls.compareTo(rs);
                if (cmp != 0) {
                    return cmp;
                }
            }
        }
        return 0;
    }

    private static String stripTrailingSlash(final String url) {
        if (url == null) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String slugify(final String name) {
        if (name == null) {
            return "";
        }
        return name.toLowerCase().replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }

    // ---- hub DTOs --------------------------------------------------

    @JsonIgnoreProperties(ignoreUnknown = true)
    static final class HubApp {
        public String id;
        public String key;
        public String name;
        public String appType;
        public List<HubVersion> versions;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    static final class HubVersion {
        public String id;
        public String version;
        public String minDhisVersion;
        public String maxDhisVersion;
        public String downloadUrl;
    }
}
