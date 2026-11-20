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
        // DHIS2 app shells embed a __DHIS2_BASE_URL__ placeholder in
        // their index.html that central replaces on serve with the
        // real instance base URL. The app's bootstrap then calls
        // new URL(base) on the value — literal __DHIS2_BASE_URL__
        // throws "Failed to construct 'URL': Invalid URL" and the
        // app dies at init (observed in mu-hiv-tracker 1.0.2). We
        // substitute with the request's own origin (scheme +
        // Host header) so the app's new URL() gets a valid absolute
        // URL that same-origin's back to DER for every /api call.
        if (contentType.startsWith("text/html")) {
            String html = new String(body, StandardCharsets.UTF_8);
            // DHIS2 __DHIS2_BASE_URL__ placeholder substitution.
            //
            // We used to substitute with the server's own Host header,
            // but in dev the client talks to Vite at :5174 while DER
            // listens on :8085, and in production a reverse proxy
            // means the client's real origin diverges from what the
            // server sees. Either way the app ends up making cross-
            // origin fetches, cookies get stripped, and /api/me 401s
            // → the app shows its own login screen even though the
            // operator is signed into DER.
            //
            // Fix: emit a tiny boot script that resets the meta
            // content to window.location.origin at the browser side.
            // Runs synchronously before the app's main bundle so the
            // app's new URL(base) sees the browser's real origin.
            // Placeholder stays in the meta tag as a readable default
            // in case the script fails.
            if (html.contains("__DHIS2_BASE_URL__")) {
                // Leave the placeholder in the meta; the bootstrap
                // script below rewrites it on load.
                final String baseScript = "<script>(function(){var m="
                        + "document.querySelector('meta[name=\"dhis2-base-url\"]');"
                        + "if(m)m.content=window.location.origin;})();</script>";
                final int headEnd = html.toLowerCase(java.util.Locale.ROOT)
                        .indexOf("</head>");
                if (headEnd >= 0) {
                    html = html.substring(0, headEnd) + baseScript
                            + html.substring(headEnd);
                } else {
                    // No </head> — fall back to replacing with the
                    // request Host and hope it matches (legacy path).
                    final String origin = request.getScheme() + "://"
                            + request.getHeader("Host");
                    html = html.replace("__DHIS2_BASE_URL__", origin);
                }
            }
            // Every DHIS2 app serve gets the HeaderBar-hide CSS so
            // only DER chrome shows at the top. COI apps now mount
            // as iframes too (the DER SPA sets COOP + COEP on its
            // own top document so isolation propagates into the
            // iframe) — no separate top-bar injection needed.
            html = injectHideHeaderBar(html);
            body = html.getBytes(StandardCharsets.UTF_8);
        }
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

        // Cross-origin-isolation (COOP + COEP + CORP) for apps that
        // need OPFS synchronous access / SharedArrayBuffer / Atomics.
        // Auto-detected by the presence of coi-serviceworker.js in the
        // app's install directory — a common library DHIS2 custom apps
        // bundle specifically because they depend on an isolated
        // context (e.g. mu-hiv-tracker 1.0.2 ships one, uses OPFS for
        // its LibSQL store, and fails silently without this header set
        // because crossOriginIsolated stays false on first load).
        //
        // credentialless COEP (over require-corp) because our DHIS2
        // custom apps load cross-origin fonts + images that don't
        // carry CORP headers; require-corp would block them. The
        // credentialless variant still provides the isolated context
        // but strips credentials from cross-origin requests rather
        // than requiring CORP opt-in.
        if (isCoiEnabled(app)) {
            headers.add("Cross-Origin-Opener-Policy", "same-origin");
            headers.add("Cross-Origin-Embedder-Policy", "credentialless");
            headers.add("Cross-Origin-Resource-Policy", "same-origin");
        }
        return ResponseEntity.ok().headers(headers).body(body);
    }

    /** Cache of install-paths that we've confirmed ship a
     *  coi-serviceworker.js helper. First serve per app pays the
     *  file-exists probe; every subsequent serve is a hashmap hit. */
    private final java.util.concurrent.ConcurrentMap<String, Boolean> coiCache
            = new java.util.concurrent.ConcurrentHashMap<>();

    /** Injects a minimal DER top-bar + spacer into a COI app's HTML.
     *  Inline styles only — no external stylesheet that might run
     *  afoul of COEP:credentialless on cross-origin fetches. The
     *  bar is fixed + z-indexed above the app content, 44px tall
     *  with a 44px body-padding spacer so no app content is hidden
     *  behind it.
     *
     *  <p>Gives operators a Back-to-DER link, the app label, and a
     *  subtle "Isolated mode" pill so the handoff is deliberate
     *  rather than "I lost my shell". No DER session queries happen
     *  here — this is pure markup, served alongside the HTML; the
     *  app's own bootstrap handles live state.</p> */
    /** Inject a tiny CSS block at the end of &lt;head&gt; that hides
     *  the DHIS2 HeaderBar component (data-test^='headerbar-') on
     *  every DHIS2 app serve. Operators get consistent DER chrome
     *  across every DHIS2 app regardless of whether it mounts as an
     *  iframe (inside the DER shell) or as a top-level navigation
     *  (COI apps). Uses :has() — baseline 2024 across every browser
     *  DER targets — so the rule stays scoped to the real HeaderBar
     *  and doesn't collateral every &lt;header&gt; in the app. */
    private static String injectHideHeaderBar(final String html) {
        final String css = "<style id=\"__der_hide_dhis2_headerbar__\">"
                + "header:has([data-test^='headerbar-']),"
                + "div:has(> header [data-test='headerbar-logo']){"
                + "display:none !important;"
                + "}"
                + "</style>";
        final int headEnd = html.toLowerCase(java.util.Locale.ROOT)
                .indexOf("</head>");
        if (headEnd < 0) {
            return css + html;
        }
        return html.substring(0, headEnd) + css + html.substring(headEnd);
    }

    private static String injectDerTopbar(final String html, final InstalledApp app) {
        final String displayName = app.displayName()
                .replace("\"", "&quot;")
                .replace("<", "&lt;").replace(">", "&gt;");
        final String bar = "<style>"
            // Push the app body down 44px to leave room for the fixed
            // DER top-bar below. HeaderBar hiding already lands via
            // injectHideHeaderBar on every serve.
            + "body{padding-top:44px !important;margin-top:0 !important;}"
            + "#__der_bar__{"
            + "position:fixed;top:0;left:0;right:0;height:44px;z-index:2147483647;"
            + "display:flex;align-items:center;gap:16px;padding:0 20px;"
            + "background:#0d2e5c;color:#eaf0f7;"
            + "font:500 13px/1.3 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;"
            + "box-shadow:0 1px 3px rgba(0,0,0,0.25);"
            + "}"
            + "#__der_bar__ a,#__der_bar__ a:visited{color:#eaf0f7;text-decoration:none;}"
            + "#__der_bar__ a:hover{text-decoration:underline;}"
            + "#__der_bar__ .__der_back__{"
            + "display:inline-flex;align-items:center;gap:6px;"
            + "padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.08);"
            + "}"
            + "#__der_bar__ .__der_back__:hover{background:rgba(255,255,255,0.15);text-decoration:none;}"
            + "#__der_bar__ .__der_app_name__{font-weight:600;flex:1;"
            + "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}"
            + "#__der_bar__ .__der_pill__{"
            + "font-size:11px;padding:3px 10px;border-radius:12px;"
            + "background:rgba(255,255,255,0.12);letter-spacing:0.3px;"
            + "}"
            + "@media (prefers-reduced-motion:no-preference){"
            + "#__der_bar__{transition:background .2s ease}"
            + "}"
            + "</style>"
            + "<div id=\"__der_bar__\" role=\"banner\">"
            + "<a href=\"/\" class=\"__der_back__\" title=\"Back to DER\">"
            + "<svg width=\"12\" height=\"12\" viewBox=\"0 0 12 12\" fill=\"none\" "
            + "aria-hidden=\"true\"><path d=\"M7.5 2L3.5 6l4 4\" stroke=\"currentColor\" "
            + "stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"
            + "DER</a>"
            + "<span class=\"__der_app_name__\">" + displayName + "</span>"
            + "<span class=\"__der_pill__\" title=\"This app runs in an isolated window for secure local storage\">"
            + "Isolated mode</span>"
            + "</div>";
        // Place the bar immediately after <body ...>; fall back to
        // prepending if no body tag is present (very rare).
        final int bodyIdx = indexOfBodyOpen(html);
        if (bodyIdx < 0) {
            return bar + html;
        }
        return html.substring(0, bodyIdx) + bar + html.substring(bodyIdx);
    }

    private static int indexOfBodyOpen(final String html) {
        final int i = html.toLowerCase(java.util.Locale.ROOT).indexOf("<body");
        if (i < 0) {
            return -1;
        }
        final int end = html.indexOf('>', i);
        return end < 0 ? -1 : end + 1;
    }

    private boolean isCoiEnabled(final InstalledApp app) {
        final String path = app.installPath();
        if (path == null || path.startsWith("db://") || path.startsWith("zip://")) {
            // Zip-backed apps would need us to peek into the archive.
            // Deferred — on-disk extraction covers the real-world case
            // (AppInstaller unpacks every upload; signed-bundle apps
            // ship their own SW scope and don't need our header).
            return false;
        }
        return coiCache.computeIfAbsent(path, (p) -> {
            try {
                return Files.isRegularFile(Paths.get(p).resolve("coi-serviceworker.js"));
            } catch (RuntimeException ex) {
                return false;
            }
        });
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
