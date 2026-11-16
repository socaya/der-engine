package ug.ac.mak.der.dhis2emulator;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/fileResources} emulator. Supports the three
 * endpoints custom apps need:
 *
 * <ul>
 *   <li>{@code POST /api/fileResources} — multipart upload.
 *       Creates a row in {@code der.app_file_resource}, returns
 *       the DHIS2-shape import response with a UID the app then
 *       stores on the owning entity.</li>
 *   <li>{@code GET /api/fileResources/{uid}} — metadata read
 *       (name, content-type, length, status, md5).</li>
 *   <li>{@code GET /api/fileResources/{uid}/data} — blob read,
 *       emits the actual bytes with the right Content-Type.</li>
 * </ul>
 *
 * <p>No streaming of giant blobs — the row is held in Postgres
 * {@code bytea}, which is fine for DHIS2 custom-app attachments
 * (typically small forms + photos). Files above the Spring
 * {@code spring.servlet.multipart.max-file-size} ceiling 413
 * at the servlet layer before this handler sees them.</p>
 */
@RestController
@RequestMapping(path = "/api/fileResources",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class FileResourceController {

    private static final String SELECT_META = "SELECT file_resource_uid, "
            + "name, content_type, content_length, content_md5, domain, "
            + "storage_status, created_at FROM der.app_file_resource "
            + "WHERE file_resource_uid = ?";

    private final JdbcTemplate jdbc;

    public FileResourceController(final JdbcTemplate jdbc) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(
            final Authentication auth,
            @RequestParam("file") final MultipartFile file,
            @RequestParam(name = "domain",
                    defaultValue = "DATA_VALUE") final String domain) throws IOException {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(dhis2Error(400,
                    "BadRequest", "file part is required"));
        }
        final byte[] bytes = file.getBytes();
        final String uid = dhis2Uid();
        final String md5 = md5Hex(bytes);
        final String contentType = file.getContentType() == null
                ? "application/octet-stream" : file.getContentType();
        jdbc.update(
                "INSERT INTO der.app_file_resource "
              + "(file_resource_uid, name, content_type, content_length, "
              + " content_md5, domain, storage_status, bytes, created_by) "
              + "VALUES (?, ?, ?, ?, ?, ?, 'STORED', ?, ?)",
                uid,
                file.getOriginalFilename() == null
                        ? "upload-" + uid : file.getOriginalFilename(),
                contentType, (long) bytes.length, md5,
                domain, bytes, principal.user().userId());
        final Map<String, Object> response = new LinkedHashMap<>();
        response.put("httpStatus", "OK");
        response.put("httpStatusCode", 202);
        response.put("status", "OK");
        response.put("message",
                "File resource stored. Any associated data entity will be "
                        + "available once the file resource is linked to it.");
        final Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("name", file.getOriginalFilename());
        resp.put("displayName", file.getOriginalFilename());
        resp.put("id", uid);
        resp.put("contentType", contentType);
        resp.put("contentLength", bytes.length);
        resp.put("contentMd5", md5);
        resp.put("domain", domain);
        resp.put("hasMultipleStorageFiles", false);
        resp.put("storageStatus", "STORED");
        response.put("response", Map.of("fileResource", resp));
        return ResponseEntity.status(202).body(response);
    }

    @GetMapping("/{uid}")
    public ResponseEntity<?> readMetadata(final Authentication auth,
                                              @PathVariable final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        try {
            final Map<String, Object> m = jdbc.queryForObject(SELECT_META,
                    (rs, i) -> {
                        final Map<String, Object> out = new LinkedHashMap<>();
                        out.put("id", rs.getString("file_resource_uid"));
                        out.put("name", rs.getString("name"));
                        out.put("displayName", rs.getString("name"));
                        out.put("contentType", rs.getString("content_type"));
                        out.put("contentLength", rs.getLong("content_length"));
                        out.put("contentMd5", rs.getString("content_md5"));
                        out.put("domain", rs.getString("domain"));
                        out.put("storageStatus", rs.getString("storage_status"));
                        out.put("created", rs.getTimestamp("created_at")
                                .toInstant().toString());
                        return out;
                    },
                    uid);
            return ResponseEntity.ok(m);
        } catch (final EmptyResultDataAccessException ex) {
            return ResponseEntity.status(404).body(dhis2Error(404, "NotFound",
                    "fileResource " + uid + " does not exist on this edge."));
        }
    }

    @GetMapping(path = "/{uid}/data", produces = MediaType.ALL_VALUE)
    public ResponseEntity<?> readBytes(final Authentication auth,
                                            @PathVariable final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        try {
            final Map<String, Object> row = jdbc.queryForMap(
                    "SELECT content_type, bytes FROM der.app_file_resource "
                  + "WHERE file_resource_uid = ?", uid);
            final byte[] bytes = (byte[]) row.get("bytes");
            final String contentType = (String) row.get("content_type");
            if (bytes == null) {
                return ResponseEntity.status(404).build();
            }
            final HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                    contentType == null ? "application/octet-stream"
                            : contentType));
            headers.setCacheControl(CacheControl.maxAge(
                    java.time.Duration.ofHours(1)));
            return new ResponseEntity<>(bytes, headers, 200);
        } catch (final EmptyResultDataAccessException ex) {
            return ResponseEntity.status(404).body(dhis2Error(404, "NotFound",
                    "fileResource " + uid + " does not exist on this edge."));
        }
    }

    // ---- helpers ----

    private static final char[] UID_ALPHABET =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    .toCharArray();
    private static final java.security.SecureRandom RNG = new java.security.SecureRandom();

    /** DHIS2 UIDs are 11-char [a-zA-Z0-9] starting with a letter.
     *  Match that shape so centrally-visible UIDs look native. */
    private static String dhis2Uid() {
        final char[] out = new char[11];
        // First char must be a letter.
        out[0] = UID_ALPHABET[RNG.nextInt(52)];
        for (int i = 1; i < 11; i++) {
            out[i] = UID_ALPHABET[RNG.nextInt(UID_ALPHABET.length)];
        }
        return new String(out);
    }

    private static String md5Hex(final byte[] bytes) {
        try {
            final byte[] digest = MessageDigest.getInstance("MD5")
                    .digest(bytes);
            final StringBuilder sb = new StringBuilder(digest.length * 2);
            for (final byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (final NoSuchAlgorithmException ex) {
            // MD5 is in every JDK. Belt-and-braces fallback.
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private static Map<String, Object> dhis2Error(final int code,
                                                       final String status,
                                                       final String message) {
        return Map.of(
                "httpStatus", status,
                "httpStatusCode", code,
                "status", "ERROR",
                "message", message);
    }
}
