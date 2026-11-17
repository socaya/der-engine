package ug.ac.mak.der.dhis2emulator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/dimensions/**} CRUD surface. The read-only list +
 * recommendations endpoints live in {@link AppShellEmptySurfacesController}
 * (they're probed by every analytics app at boot and need a shape-
 * specific empty response); this controller owns the write-side +
 * per-UID CRUD + sharing + translations + subscribers + favorites +
 * per-property item management.
 *
 * <p>Persistence: all dimensions are opaque to DER on edge — the
 * aggregation engine that would use them (Wave 2) is not yet wired.
 * Stored as JSON under {@code der.system_setting} with namespaced
 * keys:
 * <ul>
 *   <li>{@code dimension:<uid>} — the dimension object itself</li>
 *   <li>{@code dimension:<uid>:sharing} — sharing block</li>
 *   <li>{@code dimension:<uid>:translations} — translation collection</li>
 *   <li>{@code dimension:<uid>:<property>} — scalar property write</li>
 *   <li>{@code dimension:<uid>:<property>:<itemId>} — collection member</li>
 *   <li>{@code dimension:<uid>:subscriber} — subscribed userIds</li>
 *   <li>{@code dimension:<uid>:favorite} — favorited userIds</li>
 * </ul>
 * This covers the full P0 write contract — later waves can read these
 * back when the on-edge analytics engine lands.
 */
@RestController
@RequestMapping(path = "/api/dimensions", produces = MediaType.APPLICATION_JSON_VALUE)
public class DimensionsController {

    private static final String NS = "dimension:";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SystemSettingsRepository repo;

    public DimensionsController(final SystemSettingsRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    // ---- Read-side extras (list + recommendations handled elsewhere) ----

    @GetMapping("/constraints")
    public ResponseEntity<Map<String, Object>> constraints(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of("constraints", List.of()));
    }

    @GetMapping("/getObjectListCsv")
    public ResponseEntity<String> listCsv(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .body("id,name\n");
    }

    @GetMapping("/dataSet/{uid}")
    public ResponseEntity<Map<String, Object>> byDataSet(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "dimensions", List.of(),
                "dataSet", Map.of("id", uid)));
    }

    @GetMapping("/gist")
    public ResponseEntity<Map<String, Object>> gist(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "dimensions", List.of(),
                "pager", pager(0)));
    }

    @GetMapping(path = "/gist.csv", produces = "text/csv")
    public ResponseEntity<String> gistCsv(final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok("id,name\n");
    }

    // ---- Collection POST + PATCH sharing (collection-level) ----

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            final Authentication auth,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final String uid = body != null && body.get("id") instanceof String s
                ? s : generateUid();
        persist(NS + uid, body, principal);
        return ResponseEntity.ok(Map.of("httpStatus", "Created",
                "message", "Dimension " + uid + " created",
                "response", Map.of("uid", uid, "klass",
                        "org.hisp.dhis.dimension.Dimension")));
    }

    @PatchMapping("/sharing")
    public ResponseEntity<Map<String, Object>> patchCollectionSharing(
            final Authentication auth,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + "sharing", body, principal);
        return ok("Collection sharing updated");
    }

    // ---- Per-UID CRUD ----

    @GetMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> getByUid(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String stored = repo.read(NS + uid);
        if (stored == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "httpStatus", "NotFound",
                    "httpStatusCode", 404,
                    "status", "ERROR",
                    "message", "Dimension " + uid + " does not exist"));
        }
        return ResponseEntity.ok(parseOrWrap(stored, uid));
    }

    @PutMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> putByUid(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid, body, principal);
        return ok("Dimension " + uid + " replaced");
    }

    @PatchMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> patchByUid(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid, body, principal);
        return ok("Dimension " + uid + " patched");
    }

    @DeleteMapping("/{uid}")
    public ResponseEntity<Map<String, Object>> deleteByUid(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        requireAdmin(principal);
        repo.delete(NS + uid);
        return ok("Dimension " + uid + " deleted");
    }

    // ---- Per-UID gist / items ----

    @GetMapping("/{uid}/gist")
    public ResponseEntity<Map<String, Object>> uidGist(
            final Authentication auth, @PathVariable("uid") final String uid) {
        return getByUid(auth, uid);
    }

    @GetMapping(path = "/{uid}/gist.csv", produces = "text/csv")
    public ResponseEntity<String> uidGistCsv(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok("id,name\n" + uid + "," + uid + "\n");
    }

    @GetMapping("/{uid}/items")
    public ResponseEntity<Map<String, Object>> items(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(Map.of(
                "items", List.of(),
                "pager", pager(0)));
    }

    // ---- Per-UID sharing + translations + subscribers + favorites ----

    @PutMapping("/{uid}/sharing")
    public ResponseEntity<Map<String, Object>> putSharing(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":sharing", body, principal);
        return ok("Sharing for " + uid + " updated");
    }

    @PutMapping("/{uid}/translations")
    public ResponseEntity<Map<String, Object>> putTranslations(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":translations", body, principal);
        return ok("Translations for " + uid + " saved");
    }

    /** 2.41-only — subscription moved into UserDataStore after 2.42. We
     *  keep accepting it so pre-2.42 clients don't error on the toggle. */
    @PostMapping("/{uid}/subscriber")
    public ResponseEntity<Map<String, Object>> addSubscriber(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":subscriber", Map.of("userId",
                principal.user().userId().toString()), principal);
        return ok("Subscribed to " + uid);
    }

    @DeleteMapping("/{uid}/subscriber")
    public ResponseEntity<Map<String, Object>> removeSubscriber(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.delete(NS + uid + ":subscriber");
        return ok("Unsubscribed from " + uid);
    }

    /** 2.41-only — favorites moved into UserDataStore after 2.42. */
    @PostMapping("/{uid}/favorite")
    public ResponseEntity<Map<String, Object>> addFavorite(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":favorite", Map.of("userId",
                principal.user().userId().toString()), principal);
        return ok(uid + " added to favorites");
    }

    @DeleteMapping("/{uid}/favorite")
    public ResponseEntity<Map<String, Object>> removeFavorite(
            final Authentication auth, @PathVariable("uid") final String uid) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.delete(NS + uid + ":favorite");
        return ok(uid + " removed from favorites");
    }

    // ---- Per-property endpoints ----

    @GetMapping("/{uid}/{property}")
    public ResponseEntity<Map<String, Object>> getProperty(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final String stored = repo.read(NS + uid + ":" + property);
        if (stored == null) {
            return ResponseEntity.ok(Map.of(property, List.of()));
        }
        return ResponseEntity.ok(parseOrWrap(stored, property));
    }

    @GetMapping(path = "/{uid}/{property}/gist")
    public ResponseEntity<Map<String, Object>> propertyGist(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property) {
        return getProperty(auth, uid, property);
    }

    @GetMapping(path = "/{uid}/{property}/gist.csv", produces = "text/csv")
    public ResponseEntity<String> propertyGistCsv(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok("id,name\n");
    }

    @PostMapping("/{uid}/{property}")
    public ResponseEntity<Map<String, Object>> addProperty(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property,
            @RequestBody(required = false) final Object body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":" + property, body, principal);
        return ok(property + " for " + uid + " added");
    }

    @PutMapping("/{uid}/{property}")
    public ResponseEntity<Map<String, Object>> replaceProperty(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property,
            @RequestBody(required = false) final Object body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":" + property, body, principal);
        return ok(property + " for " + uid + " replaced");
    }

    @DeleteMapping("/{uid}/{property}")
    public ResponseEntity<Map<String, Object>> deleteProperty(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.delete(NS + uid + ":" + property);
        return ok(property + " for " + uid + " cleared");
    }

    @PostMapping("/{uid}/{property}/{itemId}")
    public ResponseEntity<Map<String, Object>> addPropertyItem(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property,
            @PathVariable("itemId") final String itemId,
            @RequestBody(required = false) final Map<String, Object> body) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        persist(NS + uid + ":" + property + ":" + itemId, body, principal);
        return ok("Item " + itemId + " added to " + property);
    }

    @DeleteMapping("/{uid}/{property}/{itemId}")
    public ResponseEntity<Map<String, Object>> removePropertyItem(
            final Authentication auth,
            @PathVariable("uid") final String uid,
            @PathVariable("property") final String property,
            @PathVariable("itemId") final String itemId) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        repo.delete(NS + uid + ":" + property + ":" + itemId);
        return ok("Item " + itemId + " removed from " + property);
    }

    // ---- helpers ----

    private void persist(final String key, final Object body, final EdgeUserPrincipal who) {
        try {
            final String json = body == null ? "{}"
                    : MAPPER.writeValueAsString(body);
            repo.upsert(key, json, who.user().userId());
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("payload not serialisable", ex);
        }
    }

    private static Map<String, Object> parseOrWrap(final String stored, final String fallbackKey) {
        try {
            @SuppressWarnings("unchecked")
            final Map<String, Object> parsed = MAPPER.readValue(stored, Map.class);
            return parsed;
        } catch (Exception ex) {
            return Map.of(fallbackKey, stored);
        }
    }

    private static ResponseEntity<Map<String, Object>> ok(final String message) {
        return ResponseEntity.ok(Map.of("httpStatus", "OK", "message", message));
    }

    private static Map<String, Object> pager(final int total) {
        return Map.of("page", 1, "pageSize", 50,
                "pageCount", total == 0 ? 0 : 1, "total", total);
    }

    /** 11-char DHIS2-shape UID (same alphabet DHIS2 uses). */
    private static String generateUid() {
        final char[] alphabet = ("ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                + "abcdefghijklmnopqrstuvwxyz0123456789").toCharArray();
        final java.util.Random rng = new java.util.Random();
        final StringBuilder sb = new StringBuilder(11);
        sb.append(alphabet[rng.nextInt(52)]);
        for (int i = 1; i < 11; i++) {
            sb.append(alphabet[rng.nextInt(alphabet.length)]);
        }
        return sb.toString();
    }

    private static void requireAdmin(final EdgeUserPrincipal principal) {
        final boolean admin = principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!admin) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "ADMIN role required");
        }
    }

    @SuppressWarnings("unused")
    private static final List<String> KEEP = new ArrayList<>();
}
