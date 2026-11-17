package ug.ac.mak.der.apps;

import java.io.IOException;
import java.net.URI;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Objects;
import java.util.Optional;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * Serves static files from an installed DHIS2 custom app at
 * {@code /dhis-web-<appKey>/**}. ADR-0005.
 *
 * <p>Alpha.3 upgrades:
 * <ul>
 *   <li>trailing-slash + no-slash both land on {@code index.html}</li>
 *   <li>disabled apps return 404 (not just absent ones)</li>
 *   <li>{@code manifest.webapp} is served from the DB-stored JSON so
 *     DHIS2 app loaders that fetch the manifest work without touching
 *     the extracted bundle</li>
 * </ul>
 */
@Controller
public class AppStaticHandler {

    private final InstalledAppRepository repository;
    private final AppCatalogueRepository catalogueRepo;
    private final boolean cspEnabled;
    private final JdbcTemplate jdbc;
    private final String eregistersProgramOverride;
    private final SecureRandom rand = new SecureRandom();

    /** eregisters 1.1.12's hardcoded PROGRAM constant. If the
     *  operator's facility is bound to a different WITH_REGISTRATION
     *  program, this string is rewritten in the bundle on the fly. */
    private static final String EREGISTERS_HARDCODED_PROGRAM_UID = "ueBhWkWll5v";

    @Autowired
    public AppStaticHandler(final InstalledAppRepository repository,
                              final AppCatalogueRepository catalogueRepo,
                              @Value("${der.apps.csp.enabled:false}") final boolean cspEnabled,
                              final JdbcTemplate jdbc,
                              @Value("${der.apps.eregisters.program-uid:}")
                                  final String eregistersProgramOverride) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.catalogueRepo = Objects.requireNonNull(catalogueRepo, "catalogueRepo");
        this.cspEnabled = cspEnabled;
        // Nullable: the pre-slice-B test ctors above pass null;
        // resolveEregistersProgramUid guards and returns the
        // hardcoded UID unchanged in that path.
        this.jdbc = jdbc;
        this.eregistersProgramOverride = eregistersProgramOverride == null
                ? "" : eregistersProgramOverride.trim();
    }

    /** Test-only convenience — DER_ESM-shape fixtures that don't go
     *  through the catalogue repo at all. */
    public AppStaticHandler(final InstalledAppRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.catalogueRepo = null;
        this.cspEnabled = false;
        this.jdbc = null;
        this.eregistersProgramOverride = "";
    }

    /** Test-only convenience — toggle CSP without wiring the
     *  catalogue repo, since filesystem-backed fixtures don't need it. */
    public AppStaticHandler(final InstalledAppRepository repository,
                              final boolean cspEnabled) {
        this.repository = Objects.requireNonNull(repository, "repository");
        this.catalogueRepo = null;
        this.cspEnabled = cspEnabled;
        this.jdbc = null;
        this.eregistersProgramOverride = "";
    }

    public AppStaticHandler(final InstalledAppRepository repository,
                              final AppCatalogueRepository catalogueRepo) {
        this(repository, catalogueRepo, false, null, "");
    }

    @GetMapping("/dhis-web-{appKey}")
    public ResponseEntity<byte[]> rootNoSlash(@PathVariable("appKey") final String appKey,
                                                final HttpServletRequest request) {
        // DER-APPS-DHIS2-001 D8 — top-level navigation to the DHIS2 path
        // redirects to the unified /apps/{appKey} namespace so operators
        // get the shell chrome. Asset loads from inside the iframe arrive
        // with Sec-Fetch-Dest=iframe and skip the redirect.
        if (isTopLevelDocumentNavigation(request)) {
            return ResponseEntity.status(302)
                    .location(URI.create("/apps/" + appKey))
                    .build();
        }
        return ResponseEntity.status(301)
                .location(URI.create("/dhis-web-" + appKey + "/"))
                .build();
    }

    @GetMapping("/dhis-web-{appKey}/**")
    public ResponseEntity<byte[]> serve(@PathVariable("appKey") final String appKey,
                                          final HttpServletRequest request) throws IOException {
        // FR-APP-003 — all /dhis-web-* traffic requires an authenticated
        // DER session cookie, including index.html itself. Anonymous
        // bookmark visits get 401.
        if (!isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        final Optional<InstalledApp> maybe = repository.findByKey(appKey);
        if (maybe.isEmpty() || !maybe.get().enabled()) {
            return ResponseEntity.notFound().build();
        }
        final InstalledApp app = maybe.get();
        final String uri = request.getRequestURI();
        final String prefix = "/dhis-web-" + appKey + "/";
        if (!uri.startsWith(prefix)) {
            return ResponseEntity.notFound().build();
        }
        String relative = uri.substring(prefix.length());
        if (relative.isEmpty() || "index.html".equals(relative)) {
            // FR-DIAG-001 — stamp last-opened on each index.html serve so
            // the admin diagnostic screen can see which DHIS2 apps are
            // actually being run. Only triggers on the entry point, not
            // every static asset.
            try {
                repository.touchLastOpened(app.appId(),
                        java.time.Instant.now());
            } catch (RuntimeException ex) {
                // best-effort — telemetry must never fail the serve.
            }
        }
        if (relative.isEmpty()) {
            // D8 pre-dates the deep-link launch model (FR-APP-003). For
            // DHIS2_IFRAME apps the operator opens /dhis-web-<key>/ in a
            // new tab from the catalogue tile — redirecting back to the
            // shell would loop. For legacy DER_ESM kept the shell-wrap.
            if (isTopLevelDocumentNavigation(request)
                    && app.hostKind() != InstalledApp.HostKind.DHIS2_IFRAME) {
                return ResponseEntity.status(302)
                        .location(URI.create("/apps/" + appKey))
                        .build();
            }
            relative = "index.html";
        }
        if ("manifest.webapp".equals(relative)) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .cacheControl(CacheControl.noCache())
                    .body(app.manifestJson().getBytes(StandardCharsets.UTF_8));
        }
        // DHIS2_IFRAME apps can live in either of two storage worlds:
        //   - ADR-0037 signed-bundle path: `installPath` is a db://
        //     sentinel, actual bytes live in installed_app_version.
        //   - ADR-0005 legacy path (AppInstaller): `installPath` is
        //     a filesystem directory where the zip was extracted.
        // DER_ESM apps always use filesystem. Decide by inspecting
        // installPath so both DHIS2 install flows serve correctly.
        byte[] body;
        // Zip-backed storage uses a scheme sentinel in installPath so
        // we can distinguish it from a real filesystem directory:
        //   - `db://<key>` — ADR-0037 signed-bundle path. Bytes live
        //     in installed_app_version.
        //   - `zip://<key>` — legacy sentinel retained for
        //     back-compat with Phase 5d fixtures.
        // Anything else (an absolute filesystem path) means the
        // ADR-0005 AppInstaller extracted the zip to disk.
        final boolean zipBacked = app.hostKind() == InstalledApp.HostKind.DHIS2_IFRAME
                && app.installPath() != null
                && (app.installPath().startsWith("db://")
                    || app.installPath().startsWith("zip://"));
        if (zipBacked) {
            final Optional<byte[]> served = serveFromZip(app, relative);
            if (served.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            body = served.get();
        } else {
            final Path root = Paths.get(app.installPath()).toAbsolutePath().normalize();
            final Path target = root.resolve(relative).toAbsolutePath().normalize();
            if (!target.startsWith(root) || !Files.isRegularFile(target)) {
                return ResponseEntity.notFound().build();
            }
            body = Files.readAllBytes(target);
        }
        // DER-APPS-DHIS2-002 — eregisters 1.1.12 hardcodes the program
        // UID "ueBhWkWll5v" as PROGRAM in metadata-resources.ts. When
        // the operator's facility is bound to a different
        // WITH_REGISTRATION program, the app's metadata sync 404s on
        // every program-specific read. Rewriting the string literal
        // at serve time in the two JS files that carry it
        // (App-<hash>.js + the metadata-resources chunk) lets the
        // same bundle work against any mirrored program. The
        // substitution target is picked in this order:
        //   1. der.apps.eregisters.program-uid override (operator-set
        //      via /admin/ops/settings if the facility runs multiple
        //      WITH_REGISTRATION programs and needs to pin one)
        //   2. the first WITH_REGISTRATION program in the mirror (when
        //      there's exactly one, this is the right answer)
        //   3. leave the hardcoded UID alone (the mirror might
        //      actually carry ueBhWkWll5v, in which case the app
        //      works unchanged)
        if ("eregisters".equals(app.appKey()) && relative.endsWith(".js")) {
            body = rewriteEregistersProgramUid(body);
        }
        final String contentType = guessContentType(relative);
        final HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.setCacheControl(cacheHeaderFor(relative));
        if (cspEnabled && contentType.startsWith("text/html")) {
            final String nonce = nextNonce();
            body = injectNonce(body, nonce);
            headers.add("Content-Security-Policy",
                    "default-src 'self'; "
                            + "script-src 'self' 'nonce-" + nonce + "'; "
                            + "style-src 'self' 'nonce-" + nonce + "' 'unsafe-inline'; "
                            + "img-src 'self' data: blob:; "
                            + "connect-src 'self'; "
                            + "font-src 'self' data:; "
                            + "object-src 'none'; "
                            + "frame-ancestors 'self'");
            headers.setCacheControl(CacheControl.noCache());
        }
        // FR-APP-003 — X-Frame-Options prevents a third-party page from
        // iframe-embedding a DHIS2 app pulled from this origin. The
        // DER client shell itself is same-origin so the SAMEORIGIN token
        // still lets the hybrid dispatcher mount it.
        headers.add("X-Frame-Options", "SAMEORIGIN");
        return ResponseEntity.ok().headers(headers).body(body);
    }

    /**
     * DER-APPS-DHIS2-001 — resolve one entry out of a DHIS2_IFRAME
     * app's stored zip. Returns {@link Optional#empty()} when the
     * entry name is unsafe, the active version row is missing, the
     * bytes are not a parseable zip, or the entry simply isn't in
     * the archive.
     *
     * <p>No filesystem extraction — the active zip lives in
     * {@code installed_app_version.bundle_bytes} so rollback via
     * {@code AppCatalogueController} works without re-extracting.
     * The admin-only upload path already enforces archive size +
     * entry caps, so parsing here is bounded.</p>
     */
    private Optional<byte[]> serveFromZip(final InstalledApp app,
                                             final String relative) {
        if (catalogueRepo == null) {
            return Optional.empty();
        }
        if (!AppBundleArchive.isPathSafe(relative)) {
            return Optional.empty();
        }
        final Optional<AppCatalogueRepository.BundleRow> row =
                catalogueRepo.readBundle(app.appId(), app.version());
        if (row.isEmpty() || row.get().bytes() == null) {
            return Optional.empty();
        }
        final AppBundleArchive archive;
        try (var in = new java.io.ByteArrayInputStream(row.get().bytes())) {
            archive = AppBundleArchive.parse(in);
        } catch (IOException ex) {
            return Optional.empty();
        }
        final byte[] entry = archive.entry(relative);
        return entry == null ? Optional.empty() : Optional.of(entry);
    }

    /** Sec-Fetch-Dest=document indicates a top-level navigation
     *  (operator typed the URL or clicked a bookmark). iframe loads
     *  arrive with Sec-Fetch-Dest=iframe. When the header is absent
     *  (older clients, non-browser tools) we don't redirect — the
     *  app still works, just no shell-chrome wrapping. */
    static boolean isTopLevelDocumentNavigation(final HttpServletRequest request) {
        final String dest = request.getHeader("Sec-Fetch-Dest");
        return "document".equals(dest);
    }

    private static boolean isAuthenticated() {
        final Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();
        return auth instanceof EdgeUserPrincipal;
    }

    /**
     * Pick the program UID eregisters should actually bind to and
     * replace every literal occurrence of the hardcoded
     * {@code "ueBhWkWll5v"} in the served JS body with it. The
     * substitution target is picked in this order:
     * <ol>
     *   <li>{@code der.apps.eregisters.program-uid} config override —
     *       set by ops when the facility carries multiple
     *       WITH_REGISTRATION programs and needs to pin one.</li>
     *   <li>The sole WITH_REGISTRATION program in the mirror — the
     *       typical single-program-facility case.</li>
     *   <li>The hardcoded value itself (unchanged body) — the mirror
     *       may actually carry {@code ueBhWkWll5v} or there may be
     *       multiple registration programs and the operator hasn't
     *       picked one yet.</li>
     * </ol>
     */
    byte[] rewriteEregistersProgramUid(final byte[] body) {
        final String target = resolveEregistersProgramUid();
        if (target.equals(EREGISTERS_HARDCODED_PROGRAM_UID)) {
            return body;
        }
        final String text = new String(body, StandardCharsets.UTF_8);
        if (!text.contains(EREGISTERS_HARDCODED_PROGRAM_UID)) {
            return body;
        }
        final String rewritten = text.replace(
                EREGISTERS_HARDCODED_PROGRAM_UID, target);
        return rewritten.getBytes(StandardCharsets.UTF_8);
    }

    private String resolveEregistersProgramUid() {
        if (!eregistersProgramOverride.isEmpty()) {
            return eregistersProgramOverride;
        }
        if (jdbc == null) {
            return EREGISTERS_HARDCODED_PROGRAM_UID;
        }
        try {
            final java.util.List<String> uids = jdbc.queryForList(
                    "SELECT dhis2_uid FROM der.metadata_program "
                            + "WHERE payload->>'programType' = 'WITH_REGISTRATION' "
                            + "ORDER BY display_name LIMIT 2",
                    String.class);
            if (uids.size() == 1) {
                return uids.get(0);
            }
            // Multiple WITH_REGISTRATION programs AND the hardcoded
            // UID is one of them → leave the bundle alone (the
            // intended program is already selected).
            if (uids.contains(EREGISTERS_HARDCODED_PROGRAM_UID)) {
                return EREGISTERS_HARDCODED_PROGRAM_UID;
            }
            // Multiple programs AND none is the hardcoded UID →
            // pick the first; operator can pin a specific one via
            // der.apps.eregisters.program-uid.
            if (!uids.isEmpty()) {
                return uids.get(0);
            }
        } catch (final RuntimeException ex) {
            // Mirror unreachable at serve time → serve the bundle
            // unchanged. The app will 404 on the first program read
            // which the DER emulator's graceful-empty wraps.
        }
        return EREGISTERS_HARDCODED_PROGRAM_UID;
    }

    private String nextNonce() {
        final byte[] buf = new byte[16];
        rand.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }

    static byte[] injectNonce(final byte[] html, final String nonce) {
        String s = new String(html, StandardCharsets.UTF_8);
        s = s.replace("<script", "<script nonce=\"" + nonce + "\"");
        s = s.replace("<style", "<style nonce=\"" + nonce + "\"");
        return s.getBytes(StandardCharsets.UTF_8);
    }

    static String guessContentType(final String name) {
        final String guessed = URLConnection.guessContentTypeFromName(name);
        if (guessed != null) {
            return guessed;
        }
        if (name.endsWith(".js") || name.endsWith(".mjs")) {
            return "application/javascript";
        }
        if (name.endsWith(".css")) {
            return "text/css";
        }
        if (name.endsWith(".json")) {
            return "application/json";
        }
        if (name.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (name.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (name.endsWith(".woff")) {
            return "font/woff";
        }
        return "application/octet-stream";
    }

    private static CacheControl cacheHeaderFor(final String path) {
        if (path.endsWith(".html") || path.equals("index.html")) {
            return CacheControl.noCache();
        }
        return CacheControl.maxAge(java.time.Duration.ofHours(1)).cachePublic();
    }
}
