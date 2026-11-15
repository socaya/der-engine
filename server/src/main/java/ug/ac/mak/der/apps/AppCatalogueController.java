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

    /** FR-DIAG-001 — admin diagnostic listing. Unlike the public
     *  /edge-api/v1/apps catalogue (enabled apps with their active
     *  version), this surfaces every installed_app row with its
     *  Phase 2a provenance so operators can audit what's running on
     *  the appliance and when it was last opened. Admin-only. */
    @GetMapping(path = "/edge-api/v1/admin/apps",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> adminList(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(ug.ac.mak.der.security.EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        final List<Map<String, Object>> rows = new ArrayList<>();
        for (final InstalledApp app : installedApps.findAll()) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("appId", app.appId().toString());
            m.put("appKey", app.appKey());
            m.put("displayName", app.displayName());
            m.put("version", app.version());
            m.put("enabled", app.enabled());
            m.put("hostKind", app.hostKind().name());
            m.put("source", app.source().name());
            m.put("trustLevel", app.trustLevel().name());
            m.put("installedAt", app.installedAt().toString());
            m.put("installedBy", app.installedBy().toString());
            m.put("lastOpenedAt", app.lastOpenedAt() == null ? null
                    : app.lastOpenedAt().toString());
            m.put("centralAppId", app.centralAppId());
            rows.add(m);
        }
        return ResponseEntity.ok(Map.of("count", rows.size(), "apps", rows));
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
        // FR-DIAG-001 — stamp last-opened so the admin diagnostic screen
        // can show which installed apps are actually being run. Best
        // effort; a storage blip here must not fail the bundle fetch.
        try {
            installedApps.touchLastOpened(appId, java.time.Instant.now());
        } catch (RuntimeException ex) {
            // swallow; diagnostic telemetry is non-essential.
        }
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
            return ResponseEntity.ok(installZip(parsed,
                    InstalledApp.Source.MANUAL_UPLOAD, null, userId));
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
            // Raw .js uploads are the DER-native ESM path — host is DER_ESM
            // and the Ed25519 signature is mandatory, so trust_level=SIGNED.
            installedApps.insert(new InstalledApp(
                    appId, appKey, version, displayName,
                    manifestJson(module, iconSvg),
                    "db://" + appKey,
                    userId, java.time.Instant.now(), true,
                    InstalledApp.HostKind.DER_ESM,
                    InstalledApp.Source.MANUAL_UPLOAD,
                    InstalledApp.TrustLevel.SIGNED,
                    null, null));
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

    /** DER-APPS-DHIS2-001 FR-SYNC-006 — list every version ever
     *  installed for this app, active + superseded. Powers the admin
     *  rollback picker. ADMIN-only. */
    @GetMapping(path = "/edge-api/v1/admin/apps/{appId}/versions",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> listVersions(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(
                ug.ac.mak.der.security.EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        final List<Map<String, Object>> rows = new ArrayList<>();
        for (final AppCatalogueRepository.VersionRow v : repo.listVersions(appId)) {
            final Map<String, Object> m = new LinkedHashMap<>();
            m.put("version", v.version());
            m.put("sha256", v.sha256());
            m.put("uploadedAt", v.uploadedAt().toString());
            m.put("supersededAt", v.supersededAt() == null ? null
                    : v.supersededAt().toString());
            m.put("active", v.supersededAt() == null);
            m.put("uploadedBy", v.uploadedBy() == null ? null
                    : v.uploadedBy().toString());
            rows.add(m);
        }
        return ResponseEntity.ok(Map.of("appId", appId.toString(),
                "versions", rows));
    }

    /** DER-APPS-DHIS2-001 FR-SYNC-006 — reactivate a prior version.
     *  Supersedes whatever is currently active and un-supersedes the
     *  target. 404 when the target version doesn't exist for this app.
     *  Admin-only. */
    @PostMapping(path = "/edge-api/v1/admin/apps/{appId}/rollback",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> rollback(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId,
            @org.springframework.web.bind.annotation.RequestBody
                final Map<String, Object> body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!principal.user().roles().contains(
                ug.ac.mak.der.security.EdgeRole.ADMIN)) {
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN"));
        }
        final String version = body == null ? null
                : String.valueOf(body.get("version"));
        if (version == null || version.isBlank() || "null".equals(version)) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "version required in body"));
        }
        final int touched = repo.rollbackToVersion(appId, version);
        if (touched == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "appId", appId.toString(),
                "activeVersion", version,
                "rolledBackBy", principal.user().userId().toString()));
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
    private Map<String, Object> installZip(final ParsedBundle parsed,
                                             final InstalledApp.Source source,
                                             final String centralAppId,
                                             final UUID userId) {
        final Optional<InstalledApp> existing = installedApps.findByKey(parsed.manifest.name);
        final UUID appId;
        if (existing.isPresent()) {
            appId = existing.get().appId();
            if (!existing.get().displayName().equals(parsed.manifest.displayName)) {
                installedApps.updateDisplayName(appId, parsed.manifest.displayName);
            }
        } else {
            appId = UUID.randomUUID();
            // Trust tiers (per D2): DER_ESM zips carry a signable
            // bundle.js so trust_level = SIGNED. DHIS2_IFRAME zips are
            // the stock DHIS2 Hub format — no bundle, no DER-side
            // signature, so UNSIGNED. installPath carries a `zip://`
            // sentinel on DHIS2_IFRAME so AppStaticHandler knows to
            // read bundle_bytes rather than the filesystem.
            final InstalledApp.TrustLevel trust =
                    parsed.hostKind == InstalledApp.HostKind.DER_ESM
                            ? InstalledApp.TrustLevel.SIGNED
                            : InstalledApp.TrustLevel.UNSIGNED;
            final String installPath =
                    parsed.hostKind == InstalledApp.HostKind.DHIS2_IFRAME
                            ? "zip://" + parsed.manifest.name
                            : "db://" + parsed.manifest.name;
            installedApps.insert(new InstalledApp(
                    appId, parsed.manifest.name, parsed.manifest.version,
                    parsed.manifest.displayName,
                    manifestJson(parsed.manifest.module, null),
                    installPath,
                    userId, java.time.Instant.now(), true,
                    parsed.hostKind,
                    source,
                    trust,
                    null, centralAppId));
        }
        return storeZipVersion(appId, parsed.manifest.name, parsed, userId);
    }

    /**
     * DER-APPS-DHIS2-001 FR-SYNC-003 — install a zip bundle fetched
     * from central. Shares the manual-upload code path so there's one
     * place that owns the manifest/signature/version persistence
     * semantics. Package-private; the central sync service is the only
     * caller.
     *
     * @throws ValidationFailure when the zip is malformed or missing
     *     a required entry (same validation as manual upload)
     */
    public Map<String, Object> installZipBytesForSync(final byte[] bytes,
                                                 final String centralAppId,
                                                 final UUID actorUserId)
            throws IOException, ValidationFailure {
        final ParsedBundle parsed = parseZipBytes(bytes);
        return installZip(parsed, InstalledApp.Source.CENTRAL_SYNC,
                centralAppId, actorUserId);
    }

    /** Insert the new {@code installed_app_version} row from a parsed zip. */
    private Map<String, Object> storeZipVersion(final UUID appId,
                                                  final String appKey,
                                                  final ParsedBundle parsed,
                                                  final UUID userId) {
        final String sha = sha256Hex(parsed.bundleBytes);
        // DHIS2_IFRAME zips carry third-party code we don't attest to;
        // skip the DER Ed25519 signing step — the device-side verifier
        // only fires on DER_ESM hosts anyway. requires_der_api is only
        // meaningful on DER-native bundles too, so default it to "0"
        // for iframe installs (schema-level NOT NULL).
        final boolean signable =
                parsed.hostKind == InstalledApp.HostKind.DER_ESM;
        final String signature = signable
                ? Base64.getEncoder().encodeToString(
                        signer.signBundle(parsed.bundleBytes))
                : null;
        final String requiresDerApi = signable
                ? parsed.manifest.requiresDerApi
                : "0";
        final String iconEtag = parsed.iconBytes == null
                ? null
                : sha256Hex(parsed.iconBytes).substring(0, 16);
        repo.installVersion(appId, parsed.manifest.version, parsed.bundleBytes,
                sha, signature, requiresDerApi, userId,
                parsed.manifestJsonRaw, parsed.iconBytes, parsed.iconMime, iconEtag);
        final Map<String, Object> body = installResponseBase(appId, appKey,
                parsed.manifest.version, sha, signature, requiresDerApi);
        body.put("module", parsed.manifest.module);
        body.put("hostKind", parsed.hostKind.name());
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
        return parseZipBytes(file.getBytes());
    }

    /**
     * Byte-array variant of {@link #parseZip(MultipartFile)} for
     * callers that already hold the bundle in memory (e.g.
     * {@link #installZipBytesForSync}). Same validation contract.
     */
    private ParsedBundle parseZipBytes(final byte[] bytes) throws IOException {
        final AppBundleArchive archive;
        try (var in = new ByteArrayInputStream(bytes)) {
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
        // DER_ESM shape: bundle.js present + requires_der_api declared.
        // DHIS2_IFRAME shape: index.html present, bundle.js absent. We
        // treat the whole zip as the versioned artifact and serve files
        // from it on demand at /dhis-web-<key>/*.
        final byte[] bundleJsBytes = archive.entry("bundle.js");
        final byte[] indexHtmlBytes = archive.entry("index.html");
        if (bundleJsBytes != null) {
            if (bundleJsBytes.length > MAX_BUNDLE_BYTES) {
                throw new ValidationFailure(413, "bundle.js exceeds "
                        + MAX_BUNDLE_BYTES + " bytes");
            }
            if (isBlank(manifest.requiresDerApi)) {
                throw new ValidationFailure(400,
                        "manifest.webapp missing required field: requires_der_api");
            }
            final IconResolution icon = resolveIcon(archive, manifest);
            return new ParsedBundle(manifest, manifestRaw, bundleJsBytes,
                    icon.bytes, icon.mime,
                    InstalledApp.HostKind.DER_ESM);
        }
        if (indexHtmlBytes == null) {
            throw new ValidationFailure(400,
                    "zip must contain either bundle.js (DER-native) "
                            + "or index.html (stock DHIS2)");
        }
        // Stock DHIS2 — zip is the artifact. Skip icon extraction; we
        // serve the icon via /dhis-web-<key>/ directly from the zip.
        return new ParsedBundle(manifest, manifestRaw, bytes, null, null,
                InstalledApp.HostKind.DHIS2_IFRAME);
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
        // DER-APPS-DHIS2-001 Phase 2a — hybrid-dispatcher metadata the
        // client needs to pick the right host. iframe apps expose a
        // launchUrl under /dhis-web-{appKey}/ instead of bundleUrl; the
        // client switches on hostKind.
        m.put("hostKind", row.hostKind().name());
        m.put("source", row.source().name());
        m.put("trustLevel", row.trustLevel().name());
        if (row.hostKind() == InstalledApp.HostKind.DHIS2_IFRAME) {
            m.put("launchUrl", "/dhis-web-" + row.appKey() + "/");
            // Phase 5d — deep-link (new tab) is the default launch
            // mode for DHIS2 apps per the Phase 03 pattern. Admins
            // can pin individual apps to the in-shell IframeHost
            // via a future per-app override (not yet exposed).
            m.put("launchMode", "DEEPLINK");
        }
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
        final InstalledApp.HostKind hostKind;

        ParsedBundle(final AppBundleManifest manifest,
                     final String manifestJsonRaw,
                     final byte[] bundleBytes,
                     final byte[] iconBytes,
                     final String iconMime,
                     final InstalledApp.HostKind hostKind) {
            this.manifest = manifest;
            this.manifestJsonRaw = manifestJsonRaw;
            this.bundleBytes = bundleBytes;
            this.iconBytes = iconBytes;
            this.iconMime = iconMime;
            this.hostKind = hostKind;
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
    public static final class ValidationFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final int status;

        public ValidationFailure(final int status, final String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }

        ResponseEntity<Map<String, Object>> toResponse() {
            return ResponseEntity.status(status)
                    .body(Map.of("error", getMessage()));
        }
    }
}
