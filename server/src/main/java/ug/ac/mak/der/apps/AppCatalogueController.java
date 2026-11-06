package ug.ac.mak.der.apps;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
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
 *   <li>{@code GET /edge-api/v1/apps/signing-key} — the raw Ed25519 public key.</li>
 * </ul>
 *
 * <p>Admin surface — gated by {@code der.system.settings.write} at
 * {@link ug.ac.mak.der.security.SecurityConfig}:</p>
 * <ul>
 *   <li>{@code POST /edge-api/v1/admin/apps/install} — multipart upload.</li>
 *   <li>{@code POST /edge-api/v1/admin/apps/{appId}/upgrade} — new version.</li>
 *   <li>{@code POST /edge-api/v1/admin/apps/{appId}/enable|disable}.</li>
 *   <li>{@code DELETE /edge-api/v1/admin/apps/{appId}}.</li>
 * </ul>
 */
@RestController
public class AppCatalogueController {

    /** The bundle types we accept + serve. Matches what browsers will execute. */
    static final Set<String> JS_MIME = Set.of(
            "application/javascript", "text/javascript");

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

    // ---- admin writes --------------------------------------------------

    @PostMapping(path = "/edge-api/v1/admin/apps/install",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> install(
            final Authentication authentication,
            @RequestParam("file") final MultipartFile file,
            @RequestParam("appKey") final String appKey,
            @RequestParam("displayName") final String displayName,
            @RequestParam(value = "module", required = false) final String module,
            @RequestParam("version") final String version,
            @RequestParam("requiresDerApi") final String requiresDerApi,
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
        final byte[] bytes = file.getBytes();
        // Reuse app_id when app_key already exists; otherwise mint a new row.
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
        return ResponseEntity.ok(storeVersion(appId, appKey, version, requiresDerApi,
                bytes, userId));
    }

    @PostMapping(path = "/edge-api/v1/admin/apps/{appId}/upgrade",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> upgrade(
            final Authentication authentication,
            @PathVariable("appId") final UUID appId,
            @RequestParam("file") final MultipartFile file,
            @RequestParam("version") final String version,
            @RequestParam("requiresDerApi") final String requiresDerApi)
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
        final byte[] bytes = file.getBytes();
        return ResponseEntity.ok(storeVersion(appId, existing.get().appKey(), version,
                requiresDerApi, bytes, userId));
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

    private Map<String, Object> storeVersion(final UUID appId,
                                              final String appKey,
                                              final String version,
                                              final String requiresDerApi,
                                              final byte[] bytes,
                                              final UUID userId) {
        final String sha = sha256Hex(bytes);
        final String signature = Base64.getEncoder()
                .encodeToString(signer.signBundle(bytes));
        repo.installVersion(appId, version, bytes, sha, signature, requiresDerApi, userId);
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

    private ResponseEntity<Map<String, Object>> validateFile(final MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "file required"));
        }
        final String mime = file.getContentType();
        if (mime == null || !JS_MIME.contains(mime.toLowerCase(java.util.Locale.ROOT))) {
            return ResponseEntity.status(415)
                    .body(Map.of("error", "unsupported media type; allowed: " + JS_MIME));
        }
        if (file.getSize() > MAX_BUNDLE_BYTES) {
            return ResponseEntity.status(413)
                    .body(Map.of("error", "file exceeds " + MAX_BUNDLE_BYTES + " bytes"));
        }
        return null;
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
}
