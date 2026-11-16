package ug.ac.mak.der.dhis2emulator;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.EdgeUserPrincipal;

/**
 * DHIS2 {@code /api/dataStore/<ns>/<key>} CRUD emulator.
 *
 * <p>Namespace-scoped per-app JSON blob store. Shape mirrors
 * DHIS2 central exactly so stock DHIS2 custom apps
 * (eregisters, Capture) can persist their UI config / lookup
 * tables without the appliance needing WAN. Backed by V128's
 * {@code der.app_data_store} table.</p>
 *
 * <p>DER-specific namespace matrix (same convention as central):
 * <ul>
 *   <li>Reads — any authenticated session.</li>
 *   <li>Writes — any authenticated session can create / update
 *       values in a namespace they've already written to OR in a
 *       namespace that doesn't exist yet. First-writer-wins for
 *       namespace creation. Matches DHIS2 central's
 *       open-by-default posture.</li>
 * </ul>
 * The ADR-0017 authority surface could tighten writes to a
 * specific per-namespace role in the future; keeping it open
 * for now so existing DHIS2 apps work unmodified.</p>
 *
 * <p>404 responses carry the DHIS2-shaped error body with
 * {@code message} / {@code httpStatus} / {@code httpStatusCode}
 * so DHIS2 app-runtime surfaces a readable error instead of the
 * opaque "An unknown error occurred" fallback.</p>
 */
@RestController
@RequestMapping(path = "/api/dataStore",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class AppDataStoreController {

    private final AppDataStoreRepository repo;

    public AppDataStoreController(final AppDataStoreRepository repo) {
        this.repo = Objects.requireNonNull(repo, "repo");
    }

    @GetMapping
    public ResponseEntity<List<String>> listNamespaces(
            final Authentication auth) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(repo.listNamespaces());
    }

    @GetMapping("/{namespace}")
    public ResponseEntity<?> listKeys(final Authentication auth,
                                          @PathVariable final String namespace) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final List<String> keys = repo.listKeys(namespace);
        if (keys.isEmpty()) {
            return notFound("dataStore", "namespace " + namespace);
        }
        return ResponseEntity.ok(keys);
    }

    @GetMapping(path = "/{namespace}/{key}")
    public ResponseEntity<?> read(final Authentication auth,
                                      @PathVariable final String namespace,
                                      @PathVariable final String key) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        final Optional<String> value = repo.findValue(namespace, key);
        if (value.isEmpty()) {
            return notFound("dataStore", namespace + "/" + key);
        }
        // Serve the raw JSON so the body shape matches DHIS2
        // central (not wrapped in {"value": ...}).
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .body(value.get());
    }

    @GetMapping(path = "/{namespace}/{key}/metaData")
    public ResponseEntity<?> readMetadata(final Authentication auth,
                                              @PathVariable final String namespace,
                                              @PathVariable final String key) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (!repo.exists(namespace, key)) {
            return notFound("dataStore", namespace + "/" + key);
        }
        // Minimal DHIS2-shape metadata response.
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("namespace", namespace);
        m.put("key", key);
        return ResponseEntity.ok(m);
    }

    /**
     * POST creates the key when absent; 409 CONFLICT when the key
     * already exists (matches DHIS2 central's POST-vs-PUT split).
     */
    @PostMapping(path = "/{namespace}/{key}",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(final Authentication auth,
                                        @PathVariable final String namespace,
                                        @PathVariable final String key,
                                        @RequestBody final String value) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (repo.exists(namespace, key)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(dhis2Error(409, "Conflict",
                            "dataStore key " + namespace + "/" + key
                                    + " already exists"));
        }
        repo.upsert(namespace, key, value, principal.user().userId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("httpStatus", "Created",
                        "httpStatusCode", 201,
                        "status", "OK",
                        "message",
                        "Key '" + key + "' created."));
    }

    /**
     * PUT replaces the value; 404 when the key doesn't exist.
     * DHIS2 central's exact semantics.
     */
    @PutMapping(path = "/{namespace}/{key}",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(final Authentication auth,
                                        @PathVariable final String namespace,
                                        @PathVariable final String key,
                                        @RequestBody final String value) {
        if (!(auth instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (!repo.exists(namespace, key)) {
            return notFound("dataStore", namespace + "/" + key);
        }
        repo.upsert(namespace, key, value, principal.user().userId());
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", "Key '" + key + "' updated."));
    }

    @DeleteMapping("/{namespace}/{key}")
    public ResponseEntity<?> delete(final Authentication auth,
                                        @PathVariable final String namespace,
                                        @PathVariable final String key) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (repo.delete(namespace, key) == 0) {
            return notFound("dataStore", namespace + "/" + key);
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", "Key '" + key + "' deleted."));
    }

    @DeleteMapping("/{namespace}")
    public ResponseEntity<?> deleteNamespace(final Authentication auth,
                                                 @PathVariable final String namespace) {
        if (!(auth instanceof EdgeUserPrincipal)) {
            return ResponseEntity.status(401).build();
        }
        if (repo.deleteNamespace(namespace) == 0) {
            return notFound("dataStore", "namespace " + namespace);
        }
        return ResponseEntity.ok(Map.of("httpStatus", "OK",
                "httpStatusCode", 200,
                "status", "OK",
                "message", "Namespace '" + namespace + "' deleted."));
    }

    private static ResponseEntity<Map<String, Object>> notFound(
            final String resource, final String ref) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(dhis2Error(404, "NotFound",
                        resource + " " + ref + " does not exist on this edge."));
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
