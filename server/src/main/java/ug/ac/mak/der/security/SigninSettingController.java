package ug.ac.mak.der.security;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import ug.ac.mak.der.Generated;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Sign-in page settings surface.
 *
 * <p>Two public GETs (no session) let the device shell paint the
 * login screen before the user has authenticated; the write surface
 * under {@code /edge-api/v1/admin/signin-settings} is gated at the
 * SecurityConfig layer by the {@code der.system.settings.write}
 * authority (same bucket as other operational admin writes — this
 * repo has no {@code der.system.write}; see AuthorityCatalog).</p>
 */
@RestController
public class SigninSettingController {

    /** Per spec — the four layouts the client knows how to render. */
    static final Set<String> LAYOUTS =
            Set.of("sidebar", "standard", "hero", "marketing");

    /** PNG/JPEG/SVG/WebP cover every realistic admin-provided asset. */
    static final Set<String> ALLOWED_MIME = Set.of(
            "image/png", "image/jpeg", "image/svg+xml", "image/webp");

    /** 2 MB cap — big enough for an SVG + reasonable raster, small
     *  enough to keep the public GET cheap. */
    static final int MAX_BYTES = 2 * 1024 * 1024;

    static final String BG_URL =
            "/edge-api/v1/public/signin-settings/background";

    private final SigninSettingRepository repo;

    public SigninSettingController(final SigninSettingRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    // ---- Public reads --------------------------------------------------

    @GetMapping(path = "/edge-api/v1/public/signin-settings",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> readPublic() {
        final SigninSettingRepository.Settings s = repo.read();
        final boolean hasBg = s.bgEtag() != null;
        final Map<String, Object> body = new LinkedHashMap<>();
        body.put("layout", s.layout());
        body.put("appTitle", s.appTitle());
        body.put("appIntro", s.appIntro());
        body.put("submitLabel", s.submitLabel());
        body.put("footerHtml", s.footerHtml());
        body.put("hasBackground", hasBg);
        body.put("backgroundUrl", hasBg ? BG_URL : null);
        body.put("backgroundEtag", s.bgEtag());
        return ResponseEntity.ok(body);
    }

    @GetMapping(path = "/edge-api/v1/public/signin-settings/background")
    public ResponseEntity<byte[]> readBackground(
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false)
            final String ifNoneMatch) {
        final SigninSettingRepository.Settings meta = repo.read();
        if (meta.bgEtag() == null) {
            return ResponseEntity.notFound().build();
        }
        final String quotedEtag = quote(meta.bgEtag());
        if (ifNoneMatch != null && matches(ifNoneMatch, meta.bgEtag())) {
            return ResponseEntity.status(304).eTag(quotedEtag).build();
        }
        final byte[] bytes = repo.readBackground();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(meta.bgMime()))
                .eTag(quotedEtag)
                .body(bytes);
    }

    // ---- Admin writes --------------------------------------------------

    @PutMapping(path = "/edge-api/v1/admin/signin-settings",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> updateText(
            final Authentication authentication,
            @RequestBody(required = false) final TextUpdate body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "body required"));
        }
        if (body.layout() != null && !LAYOUTS.contains(body.layout())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "layout must be one of " + LAYOUTS));
        }
        repo.updateText(body.layout(), body.appTitle(), body.appIntro(),
                body.submitLabel(), body.footerHtml(), principal.userId());
        return readPublic();
    }

    @PostMapping(path = "/edge-api/v1/admin/signin-settings/background",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> uploadBackground(
            final Authentication authentication,
            @RequestParam("file") final MultipartFile file)
            throws IOException {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "file required"));
        }
        final String mime = file.getContentType();
        if (mime == null || !ALLOWED_MIME.contains(mime.toLowerCase())) {
            return ResponseEntity.status(415).body(Map.of(
                    "error", "unsupported media type; allowed: " + ALLOWED_MIME));
        }
        if (file.getSize() > MAX_BYTES) {
            return ResponseEntity.status(413).body(Map.of(
                    "error", "file exceeds " + MAX_BYTES + " bytes"));
        }
        final byte[] bytes = file.getBytes();
        final String etag = sha256Hex(bytes);
        repo.updateBackground(bytes, mime.toLowerCase(), etag, principal.userId());
        return ResponseEntity.ok(Map.of(
                "etag", etag,
                "mime", mime.toLowerCase(),
                "bytes", bytes.length));
    }

    @DeleteMapping(path = "/edge-api/v1/admin/signin-settings/background",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> clearBackground(
            final Authentication authentication) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.clearBackground(principal.userId());
        return ResponseEntity.noContent().build();
    }

    // ---- helpers -------------------------------------------------------

    static String sha256Hex(final byte[] bytes) {
        // SHA-256 is a JDK-required algorithm, so the NoSuchAlgorithm path
        // is unreachable — unwrap it here and let the caller treat it as a
        // programming error if the JDK is ever shipped without it.
        final MessageDigest md = sha256();
        final byte[] digest = md.digest(bytes);
        final StringBuilder sb = new StringBuilder(digest.length * 2);
        for (final byte b : digest) {
            sb.append(String.format("%02x", b & 0xff));
        }
        return sb.toString();
    }

    /**
     * JaCoCo-excluded via {@link Generated}: the JRE guarantees SHA-256
     * (JLS §21.5), so the catch is an unreachable safety net.
     */
    @Generated("JRE-spec defensive branch — SHA-256 is always available")
    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private static String quote(final String etag) {
        return "\"" + etag + "\"";
    }

    /** Honour both the quoted and bare form of If-None-Match. */
    static boolean matches(final String header, final String etag) {
        if (header == null || etag == null) {
            return false;
        }
        for (final String part : header.split(",")) {
            final String trimmed = part.trim();
            if (trimmed.equals(etag) || trimmed.equals("\"" + etag + "\"")
                    || trimmed.equals("*")) {
                return true;
            }
        }
        return false;
    }

    /** JSON shape for PUT /admin/signin-settings. */
    public record TextUpdate(String layout,
                              String appTitle,
                              String appIntro,
                              String submitLabel,
                              String footerHtml) { }
}
