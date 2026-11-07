package ug.ac.mak.der.apps;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ug.ac.mak.der.Generated;
import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * App bundle catalogue + install surface (C-UI-5a server side).
 *
 * <p>Public surface — no session required:</p>
 * <ul>
 *   <li>{@code GET /edge-api/v1/apps} — enabled apps + their active version metadata.</li>
 *   <li>{@code GET /edge-api/v1/apps/{appId}/{version}/bundle.js} — immutable bundle bytes.</li>
 *   <li>{@code GET /edge-api/v1/apps/{appId}/{version}/icon} — icon blob (V092).</li>
 *   <li>{@code GET /edge-api/v1/apps/signing-key} — the raw Ed25519 public key.</li>
 * </ul>
 *
 * <p>Admin surface — gated by {@code der.system.settings.write} at
 * {@link ug.ac.mak.der.security.SecurityConfig}:</p>
 * <ul>
 *   <li>{@code POST /edge-api/v1/admin/apps/install} — multipart upload (.js or .zip).</li>
 *   <li>{@code POST /edge-api/v1/admin/apps/{appId}/upgrade} — new version.</li>
 *   <li>{@code POST /edge-api/v1/admin/apps/{appId}/enable|disable}.</li>
 *   <li>{@code DELETE /edge-api/v1/admin/apps/{appId}}.</li>
 * </ul>
 *
 * <p>Install accepts two file shapes:</p>
 * <ul>
 *   <li>Raw {@code .js} / {@code .mjs} bundle with typed form fields — the
 *       original Phase 02 flow, unchanged.</li>
 *   <li>DHIS2-style {@code .zip} containing {@code manifest.webapp},
 *       {@code bundle.js} and an optional icon. The manifest supplies
 *       {@code appKey} ({@code name}), {@code displayName}, {@code version},
 *       {@code module} and {@code requires_der_api}; form parameters for
 *       those fields are ignored on the zip path.</li>
 * </ul>
 *
 * <p>The Ed25519 signing boundary is unchanged across both paths: the
 * signature covers only the raw {@code bundle.js} bytes, never the zip
 * envelope, so device-side verification needs no awareness of packaging.</p>
 */
@RestController
public class AppCatalogueController {

    /** The bundle types we accept + serve. Matches what browsers will execute. */
    static final Set<String> JS_MIME = Set.of(
            "application/javascript", "text/javascript");

    /** Zip MIME shapes we recognise. */
    static final Set<String> ZIP_MIME = Set.of(
            "application/zip", "application/x-zip-compressed", "multipart/x-zip");

    /** 5 MB is comfortable for a webpack-built admin tile; refuse the rest. */
    static final int MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

    private final AppCatalogueRepository repo;
    private final AppSigningKeyService signer;
    private final InstalledAppRepository installedApps;
    private final ObjectMapper mapper;

    public AppCatalogueController(final AppCatalogueRepository repo,
                                   final AppSigningKeyService signer,
                                   final InstalledAppRepository installedApps,
                                   final ObjectMapper mapper) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.signer = Objects.requireNonNull(signer, "signer");
        this.installedApps = Objects.requireNonNull(installedApps, "installedApps");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    // ---- public reads --------------------------------------------------

    @GetMapping(path = "/edge-api/v1/apps",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> list() {
        final List<Map<String, Object>> apps = new ArrayList<>();
        for (final AppCatalogueRepository.CatalogueEntry row : repo.catalogue()) {
            apps.add(toJson(row));
        }
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("apps", apps);
        return ResponseEntity.ok(body);
    }

    @GetMapping(path = "/edge-api/v1/apps/signing-key",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> signingKey() {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("algorithm", AppSigningKeyService.ALGORITHM);
        body.put("publicKeyB64", signer.publicKeyBase64());
        return ResponseEntity.ok(body);
    }

    @GetMapping(path = "/edge-api/v1/apps/{appId}/{version}/bundle.js")
    public ResponseEntity<byte[]> bundle(
            @PathVariable("appId") final UUID appId,
            @PathVariable("version") final String version,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false)
            final String ifNoneMatch) {
        final Optional<AppCatalogueRepository.BundleRow> row = repo.readBundle(appId, version);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final AppCatalogueRepository.BundleRow r = row.get();
        final String etag = etagOf(r.sha256());
        if (ifNoneMatch != null && matches(ifNoneMatch, r.sha256())) {
            return ResponseEntity.status(304).eTag(etag).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/javascript"))
                .eTag(etag)
                .cacheControl(org.springframework.http.CacheControl
                        .maxAge(java.time.Duration.ofSeconds(31_536_000L))
                        .cachePublic()
                        .immutable())
                .body(r.bytes());
    }

    @GetMapping(path = "/edge-api/v1/apps/{appId}/{version}/icon")
    public ResponseEntity<byte[]> icon(
            @PathVariable("appId") final UUID appId,
            @PathVariable("version") final String version,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false)
            final String ifNoneMatch) {
        final Optional<AppCatalogueRepository.IconRow> row = repo.readIcon(appId, version);
        if (row.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final AppCatalogueRepository.IconRow r = row.get();
        final String etag = "\"" + r.etag() + "\"";
        if (ifNoneMatch != null && iconMatches(ifNoneMatch, r.etag())) {
            return ResponseEntity.status(304).eTag(etag).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(r.mime()))
                .eTag(etag)
                .cacheControl(org.springframework.http.CacheControl
                        .maxAge(java.time.Duration.ofSeconds(31_536_000L))
                        .cachePublic()
                        .immutable())
                .body(r.bytes());
    }

    // ---- admin writes --------------------------------------------------

    @PostMapping(path = "/edge-api/v1/admin/apps/install",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> install(
            final Authentication authentication,
            @RequestParam("file") final MultipartFile file,
            @RequestParam(value = "appKey", required = false) final String appKey,
            @RequestParam(value = "displayName", required = false) final String displayName,
            @RequestParam(value = "module", required = false) final String module,
            @RequestParam(value = "version", required = false) final String version,
            @RequestParam(value = "requiresDerApi", required = false) final String requiresDerApi,
            @RequestParam(value = "iconSvg", required = false) final String iconSvg)
            throws IOException {
        final UUID userId = requirePrincipal(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        final ResponseEntity<Map<String, Object>> precheck = validateFile(file);
        if (precheck != null) {
            return precheck;
        }
        if (isZipUpload(file)) {
            final ParsedBundle parsed;
            try {
                parsed = parseZip(file);
            } catch (ValidationFailure ex) {
                return ex.toResponse();
            }
            return ResponseEntity.ok(installZip(parsed, userId));
        }
        if (appKey == null || displayName == null || version == null
                || requiresDerApi == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "appKey, displayName, version, requiresDerApi "
                            + "required for .js uploads"));
        }
        final byte[] bytes = file.getBytes();
        final Optional<InstalledApp> existing = installedApps.findByKey(appKey);
        final UUID appId;
        if (existing.isPresent()) {
            appId = existing.get().appId();
        } else {
            appId = UUID.randomUUID();
            installedApps.insert(new InstalledApp(
                    appId, appKey, version, displayName,
                    manifestJson(module, iconSvg),
                    "db://" + appKey,
                    userId, java.time.Instant.now(), true));
        }
        return ResponseEntity.ok(storeJsVersion(appId, appKey, version, module,
                requiresDerApi, bytes, userId));
    }

    @PostMapping(path = "/edge-api/v1/admin/apps/{appId}/upgrade",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upgrade(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId,
            @RequestParam("file") final MultipartFile file,
            @RequestParam(value = "version", required = false) final String version,
            @RequestParam(value = "requiresDerApi", required = false) final String requiresDerApi)
            throws IOException {
        final UUID userId = requirePrincipal(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        final Optional<InstalledApp> existing = installedApps.findById(appId);
        if (existing.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        final ResponseEntity<Map<String, Object>> precheck = validateFile(file);
        if (precheck != null) {
            return precheck;
        }
        if (isZipUpload(file)) {
            final ParsedBundle parsed;
            try {
                parsed = parseZip(file);
            } catch (ValidationFailure ex) {
                return ex.toResponse();
            }
            // Upgrade keeps the existing appId; manifest's name field
            // is advisory here (identity is the path variable).
            return ResponseEntity.ok(storeZipVersion(
                    appId, existing.get().appKey(), parsed, userId));
        }
        if (version == null || requiresDerApi == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "version, requiresDerApi "
                            + "required for .js uploads"));
        }
        final byte[] bytes = file.getBytes();
        return ResponseEntity.ok(storeJsVersion(appId, existing.get().appKey(),
                version, null, requiresDerApi, bytes, userId));
    }

    @PostMapping(path = "/edge-api/v1/admin/apps/{appId}/enable",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> enable(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId) {
        return toggle(authentication, appId, true);
    }

    @PostMapping(path = "/edge-api/v1/admin/apps/{appId}/disable",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> disable(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId) {
        return toggle(authentication, appId, false);
    }

    @DeleteMapping(path = "/edge-api/v1/admin/apps/{appId}")
    public ResponseEntity<Map<String, Object>> delete(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId) {
        final UUID userId = requirePrincipal(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.deleteApp(appId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    // ---- helpers -------------------------------------------------------

    private ResponseEntity<Map<String, Object>> toggle(final Authentication authentication,
                                                        final UUID appId,
                                                        final boolean enabled) {
        final UUID userId = requirePrincipal(authentication);
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.setEnabled(appId, enabled, userId);
        if (rows == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("appId", appId.toString(), "enabled", enabled));
    }

    /** Raw-{@code .js} path — no manifest, no icon. */
    private Map<String, Object> storeJsVersion(final UUID appId,
                                                 final String appKey,
                                                 final String version,
                                                 final String module,
                                                 final String requiresDerApi,
                                                 final byte[] bytes,
                                                 final UUID userId) {
        final String sha = sha256Hex(bytes);
        final String signature = Base64.getEncoder()
                .encodeToString(signer.signBundle(bytes));
        repo.installVersion(appId, version, bytes, sha, signature, requiresDerApi,
                userId);
        final Map<String, Object> body = installResponseBase(appId, appKey, version,
                sha, signature, requiresDerApi);
        body.put("module", module);
        body.put("iconUrl", null);
        body.put("manifestJson", null);
        return body;
    }

    /**
     * Fresh-install from a zip — mint the identity row if missing, then
     * persist the version with manifest + icon.
     */
    private Map<String, Object> installZip(final ParsedBundle parsed, final UUID userId) {
        final Optional<InstalledApp> existing = installedApps.findByKey(parsed.manifest.name);
        final UUID appId;
        if (existing.isPresent()) {
            appId = existing.get().appId();
            // Refresh display_name on re-install — the manifest is the
            // source of truth; without this a renamed app keeps its
            // original label in der.installed_app forever. Idempotent
            // when the value hasn't changed.
            if (!existing.get().displayName().equals(parsed.manifest.displayName)) {
                installedApps.updateDisplayName(appId, parsed.manifest.displayName);
            }
        } else {
            appId = UUID.randomUUID();
            installedApps.insert(new InstalledApp(
                    appId, parsed.manifest.name, parsed.manifest.version,
                    parsed.manifest.displayName,
                    manifestJson(parsed.manifest.module, null),
                    "db://" + parsed.manifest.name,
                    userId, java.time.Instant.now(), true));
        }
        return storeZipVersion(appId, parsed.manifest.name, parsed, userId);
    }

    /** Insert the new {@code installed_app_version} row from a parsed zip. */
    private Map<String, Object> storeZipVersion(final UUID appId,
                                                  final String appKey,
                                                  final ParsedBundle parsed,
                                                  final UUID userId) {
        final String sha = sha256Hex(parsed.bundleBytes);
        final String signature = Base64.getEncoder()
                .encodeToString(signer.signBundle(parsed.bundleBytes));
        final String iconEtag = parsed.iconBytes == null
                ? null
                : sha256Hex(parsed.iconBytes).substring(0, 16);
        repo.installVersion(appId, parsed.manifest.version, parsed.bundleBytes,
                sha, signature, parsed.manifest.requiresDerApi, userId,
                parsed.manifestJsonRaw, parsed.iconBytes, parsed.iconMime, iconEtag);
        final Map<String, Object> body = installResponseBase(appId, appKey,
                parsed.manifest.version, sha, signature, parsed.manifest.requiresDerApi);
        body.put("module", parsed.manifest.module);
        body.put("iconUrl", parsed.iconBytes == null ? null
                : iconUrl(appId, parsed.manifest.version));
        body.put("manifestJson", parsed.manifestJsonRaw);
        return body;
    }

    private Map<String, Object> installResponseBase(final UUID appId,
                                                     final String appKey,
                                                     final String version,
                                                     final String sha,
                                                     final String signature,
                                                     final String requiresDerApi) {
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("appId", appId.toString());
        body.put("appKey", appKey);
        body.put("version", version);
        body.put("bundleUrl", bundleUrl(appId, version));
        body.put("bundleSha256", sha);
        body.put("signatureB64", signature);
        body.put("requiresDerApi", requiresDerApi);
        return body;
    }

    /**
     * Validate the raw multipart envelope: non-empty, size ceiling, and
     * a recognised content type. Zip discrimination happens inside the
     * install handlers so the response bodies can stay specific.
     *
     * <p>The {@code file == null} branch is defensive: Spring's
     * {@code @RequestParam("file")} binding rejects the request with 400
     * before reaching this method when the multipart part is missing, so
     * only the {@code file.isEmpty()} case is reachable from HTTP.</p>
     */
    private ResponseEntity<Map<String, Object>> validateFile(final MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "file required"));
        }
        final boolean zip = isZipUpload(file);
        final String mime = normalisedMime(file);
        if (!zip && (mime == null || !JS_MIME.contains(mime))) {
            return ResponseEntity.status(415)
                    .body(Map.of("error", "unsupported media type; allowed: "
                            + JS_MIME + " or application/zip"));
        }
        final long limit = zip ? AppBundleArchive.MAX_ARCHIVE_BYTES : MAX_BUNDLE_BYTES;
        if (file.getSize() > limit) {
            return ResponseEntity.status(413)
                    .body(Map.of("error", "file exceeds " + limit + " bytes"));
        }
        return null;
    }

    /**
     * {@code true} iff the upload is a zip — by MIME or by filename. The
     * filename check lets us accept archives uploaded through tooling
     * that drops the content-type header (curl, etc.).
     */
    private static boolean isZipUpload(final MultipartFile file) {
        final String mime = normalisedMime(file);
        if (mime != null && ZIP_MIME.contains(mime)) {
            return true;
        }
        final String name = file.getOriginalFilename();
        return name != null && name.toLowerCase(Locale.ROOT).endsWith(".zip");
    }

    private static String normalisedMime(final MultipartFile file) {
        final String raw = file.getContentType();
        return raw == null ? null : raw.toLowerCase(Locale.ROOT);
    }

    /**
     * Parse + validate the zip envelope. Any structural problem surfaces
     * as a {@link ValidationFailure} carrying the HTTP status and payload
     * the caller will return directly.
     */
    private ParsedBundle parseZip(final MultipartFile file) throws IOException {
        final AppBundleArchive archive;
        try (var in = new ByteArrayInputStream(file.getBytes())) {
            archive = AppBundleArchive.parse(in);
        } catch (AppBundleArchive.ArchiveException ex) {
            throw new ValidationFailure(400, ex.getMessage());
        }
        final byte[] manifestBytes = archive.entry("manifest.webapp");
        if (manifestBytes == null) {
            throw new ValidationFailure(400, "missing manifest.webapp");
        }
        final String manifestRaw = new String(manifestBytes,
                java.nio.charset.StandardCharsets.UTF_8);
        final AppBundleManifest manifest;
        try {
            manifest = mapper.readValue(manifestBytes, AppBundleManifest.class);
        } catch (IOException ex) {
            throw new ValidationFailure(400, "malformed manifest.webapp");
        }
        if (isBlank(manifest.name)) {
            throw new ValidationFailure(400, "manifest.webapp missing required field: name");
        }
        if (isBlank(manifest.displayName)) {
            throw new ValidationFailure(400,
                    "manifest.webapp missing required field: displayName");
        }
        if (isBlank(manifest.version)) {
            throw new ValidationFailure(400,
                    "manifest.webapp missing required field: version");
        }
        if (isBlank(manifest.requiresDerApi)) {
            throw new ValidationFailure(400,
                    "manifest.webapp missing required field: requires_der_api");
        }
        final byte[] bundleBytes = archive.entry("bundle.js");
        if (bundleBytes == null) {
            throw new ValidationFailure(400, "missing bundle.js");
        }
        if (bundleBytes.length > MAX_BUNDLE_BYTES) {
            throw new ValidationFailure(413, "bundle.js exceeds "
                    + MAX_BUNDLE_BYTES + " bytes");
        }
        final IconResolution icon = resolveIcon(archive, manifest);
        return new ParsedBundle(manifest, manifestRaw, bundleBytes,
                icon.bytes, icon.mime);
    }

    /**
     * Pick the icon entry declared in {@code manifest.icons}. The DHIS2
     * convention keys icons by nominal pixel size as a string; we pick
     * the entry with the largest numeric key that resolves to a file
     * actually present in the archive, falling back to any entry on the
     * off-chance the map contains non-numeric keys. Returns a result
     * with null bytes if no icon can be resolved (icons are optional).
     */
    private static IconResolution resolveIcon(final AppBundleArchive archive,
                                               final AppBundleManifest manifest) {
        final Map<String, String> icons = manifest.iconsSafe();
        if (icons.isEmpty()) {
            return IconResolution.empty();
        }
        String chosenName = null;
        int chosenScore = Integer.MIN_VALUE;
        for (final Map.Entry<String, String> e : icons.entrySet()) {
            final String path = e.getValue();
            if (path == null || archive.entry(path) == null) {
                continue;
            }
            final int score;
            try {
                score = Integer.parseInt(e.getKey().trim());
            } catch (NumberFormatException nfe) {
                // Non-numeric key — treat as lowest priority but still eligible.
                if (chosenName == null) {
                    chosenName = path;
                }
                continue;
            }
            if (score > chosenScore) {
                chosenScore = score;
                chosenName = path;
            }
        }
        if (chosenName == null) {
            return IconResolution.empty();
        }
        final String mime = AppBundleArchive.iconMimeFor(chosenName);
        if (mime == null) {
            throw new ValidationFailure(400,
                    "icon " + chosenName + " must be .svg/.png/.webp/.jpg");
        }
        final byte[] bytes = archive.entry(chosenName);
        if (bytes.length > AppBundleArchive.MAX_ICON_BYTES) {
            throw new ValidationFailure(400,
                    "icon " + chosenName + " exceeds "
                            + AppBundleArchive.MAX_ICON_BYTES + " bytes");
        }
        return new IconResolution(bytes, mime);
    }

    private static boolean isBlank(final String s) {
        return s == null || s.isBlank();
    }

    private static UUID requirePrincipal(final Authentication authentication) {
        if (authentication instanceof EdgeUserPrincipal p) {
            return p.userId();
        }
        return null;
    }

    private Map<String, Object> toJson(final AppCatalogueRepository.CatalogueEntry row) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("appId", row.appId().toString());
        m.put("appKey", row.appKey());
        m.put("displayName", row.displayName());
        m.put("module", moduleFrom(row.manifestJson()));
        m.put("version", row.version());
        m.put("bundleUrl", bundleUrl(row.appId(), row.version()));
        m.put("bundleSha256", row.bundleSha256());
        m.put("signatureB64", row.signatureB64());
        m.put("requiresDerApi", row.requiresDerApi());
        m.put("iconUrl", row.iconEtag() == null ? null
                : iconUrl(row.appId(), row.version()));
        m.put("manifestJson", row.manifestJson());
        return m;
    }

    private String moduleFrom(final String manifestJson) {
        if (manifestJson == null || manifestJson.isBlank()) {
            return null;
        }
        try {
            final JsonNode n = mapper.readTree(manifestJson);
            final JsonNode m = n.get("module");
            return m == null || m.isNull() ? null : m.asText();
        } catch (IOException ex) {
            return null;
        }
    }

    private String manifestJson(final String module, final String iconSvg) {
        final Map<String, Object> m = new LinkedHashMap<>();
        if (module != null) {
            m.put("module", module);
        }
        if (iconSvg != null) {
            m.put("iconSvg", iconSvg);
        }
        return writeJsonUnchecked(m);
    }

    /**
     * Serialise an in-memory map to JSON. Jackson's
     * {@link ObjectMapper#writeValueAsString} is declared to throw
     * {@link com.fasterxml.jackson.core.JsonProcessingException} on
     * malformed graphs; a plain {@link LinkedHashMap} of String/String
     * cannot trigger it so the catch is defensive only.
     */
    @Generated("Defensive branch — plain LinkedHashMap can't IOException")
    private String writeJsonUnchecked(final Map<String, Object> m) {
        try {
            return mapper.writeValueAsString(m);
        } catch (IOException ex) {
            return "{}";
        }
    }

    private static String bundleUrl(final UUID appId, final String version) {
        return "/edge-api/v1/apps/" + appId + "/" + version + "/bundle.js";
    }

    private static String iconUrl(final UUID appId, final String version) {
        return "/edge-api/v1/apps/" + appId + "/" + version + "/icon";
    }

    private static String etagOf(final String sha256) {
        // Use the first 16 hex chars — plenty of collision resistance for
        // cache validation, keeps the header short.
        final String prefix = sha256.length() > 16 ? sha256.substring(0, 16) : sha256;
        return "\"" + prefix + "\"";
    }

    static boolean matches(final String header, final String sha256) {
        if (header == null || sha256 == null) {
            return false;
        }
        final String bare = sha256.length() > 16 ? sha256.substring(0, 16) : sha256;
        final String quoted = "\"" + bare + "\"";
        for (final String part : header.split(",")) {
            final String trimmed = part.trim();
            if (trimmed.equals("*") || trimmed.equals(bare) || trimmed.equals(quoted)) {
                return true;
            }
        }
        return false;
    }

    static boolean iconMatches(final String header, final String etag) {
        if (header == null || etag == null) {
            return false;
        }
        final String quoted = "\"" + etag + "\"";
        for (final String part : header.split(",")) {
            final String trimmed = part.trim();
            if (trimmed.equals("*") || trimmed.equals(etag) || trimmed.equals(quoted)) {
                return true;
            }
        }
        return false;
    }

    static String sha256Hex(final byte[] bytes) {
        final MessageDigest md = sha256();
        final byte[] digest = md.digest(bytes);
        final StringBuilder sb = new StringBuilder(digest.length * 2);
        for (final byte b : digest) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }

    /**
     * SHA-256 is a JLS-guaranteed algorithm, so the catch is a defensive
     * safety net only. Excluded from coverage via {@link Generated}.
     */
    @Generated("JRE-spec defensive branch — SHA-256 is always available")
    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    // ---- parse-output carriers ----------------------------------------

    /** Internal holder for a successfully-parsed zip install. */
    private static final class ParsedBundle {
        final AppBundleManifest manifest;
        final String manifestJsonRaw;
        final byte[] bundleBytes;
        final byte[] iconBytes; // nullable
        final String iconMime;  // nullable

        ParsedBundle(final AppBundleManifest manifest,
                     final String manifestJsonRaw,
                     final byte[] bundleBytes,
                     final byte[] iconBytes,
                     final String iconMime) {
            this.manifest = manifest;
            this.manifestJsonRaw = manifestJsonRaw;
            this.bundleBytes = bundleBytes;
            this.iconBytes = iconBytes;
            this.iconMime = iconMime;
        }
    }

    /** Resolved icon tuple — bytes/mime null when the archive has no icon. */
    private static final class IconResolution {
        final byte[] bytes;
        final String mime;

        IconResolution(final byte[] bytes, final String mime) {
            this.bytes = bytes;
            this.mime = mime;
        }

        static IconResolution empty() {
            return new IconResolution(null, null);
        }
    }

    /**
     * Carries a status + message pair from the zip parser back to the
     * controller entry point. Throwing lets validators compose without
     * each sub-step having to return {@code Optional<ResponseEntity>}.
     */
    private static final class ValidationFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final int status;

        ValidationFailure(final int status, final String message) {
            super(message);
            this.status = status;
        }

        ResponseEntity<Map<String, Object>> toResponse() {
            return ResponseEntity.status(status)
                    .body(Map.of("error", getMessage()));
        }
    }
}
