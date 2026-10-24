package ug.ac.mak.der.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.dhis2.Dhis2ConnectionConfig;
import ug.ac.mak.der.dhis2.Dhis2ConnectionConfigRepository;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecretEnvelope;

/**
 * ADMIN surface for the editable DHIS2 central-connection + compat
 * config. Secrets round-trip as {@code "***"} on reads and are only
 * updated when the payload supplies a non-blank new value — so the
 * admin UI never sees cleartext passwords/PATs.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/dhis2-connection",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class Dhis2ConnectionController {

    static final String SECRET_MASK = "***";

    private final Dhis2ConnectionConfigRepository repo;
    private final SecretEnvelope secrets;

    public Dhis2ConnectionController(final Dhis2ConnectionConfigRepository repo,
                                     final SecretEnvelope secrets) {
        this.repo = repo;
        this.secrets = secrets;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> read() {
        return ResponseEntity.ok(mask(repo.read()));
    }

    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> write(final Authentication auth,
                                                      @RequestBody final Map<String, Object> body) {
        final UUID userId = auth instanceof EdgeUserPrincipal p ? p.userId() : null;
        final Dhis2ConnectionConfig current = repo.read();

        final Dhis2ConnectionConfig next = new Dhis2ConnectionConfig(
                str(body, "baseUrl", current.baseUrl()),
                str(body, "username", current.username()),
                sealedOrKeep(body, "password", current.passwordSealed()),
                sealedOrKeep(body, "patToken", current.patTokenSealed()),
                bool(body, "allowMismatch", current.allowMismatch()),
                str(body, "pinnedVersion", current.pinnedVersion()),
                str(body, "minSupportedVersion", current.minSupportedVersion()),
                str(body, "maxTestedVersion", current.maxTestedVersion()),
                str(body, "compatMode", current.compatMode()),
                intOrNull(body, "snapshotTtlHours", current.snapshotTtlHours()),
                intOrNull(body, "connectTimeoutMillis", current.connectTimeoutMillis()),
                boolOrNull(body, "proxyEnabled", current.proxyEnabled()),
                boolOrNull(body, "proxyAllowWrites", current.proxyAllowWrites()),
                str(body, "proxyAllowPaths", current.proxyAllowPaths()),
                null, userId);
        repo.write(next, userId);
        return ResponseEntity.ok(mask(repo.read()));
    }

    Map<String, Object> mask(final Dhis2ConnectionConfig c) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("baseUrl", c.baseUrl());
        m.put("username", c.username());
        m.put("passwordSet", c.passwordSealed() != null && !c.passwordSealed().isBlank());
        m.put("patTokenSet", c.patTokenSealed() != null && !c.patTokenSealed().isBlank());
        m.put("password", c.passwordSealed() == null || c.passwordSealed().isBlank() ? null : SECRET_MASK);
        m.put("patToken",  c.patTokenSealed()  == null || c.patTokenSealed().isBlank()  ? null : SECRET_MASK);
        m.put("allowMismatch", c.allowMismatch());
        m.put("pinnedVersion", c.pinnedVersion());
        m.put("minSupportedVersion", c.minSupportedVersion());
        m.put("maxTestedVersion", c.maxTestedVersion());
        m.put("compatMode", c.compatMode());
        m.put("snapshotTtlHours", c.snapshotTtlHours());
        m.put("connectTimeoutMillis", c.connectTimeoutMillis());
        m.put("proxyEnabled", c.proxyEnabled());
        m.put("proxyAllowWrites", c.proxyAllowWrites());
        m.put("proxyAllowPaths", c.proxyAllowPaths());
        m.put("updatedAt", c.updatedAt() == null ? null : c.updatedAt().toString());
        m.put("updatedBy", c.updatedBy() == null ? null : c.updatedBy().toString());
        return m;
    }

    private static String str(final Map<String, Object> body, final String k, final String fallback) {
        if (!body.containsKey(k)) {
            return fallback;
        }
        final Object v = body.get(k);
        return v == null ? null : String.valueOf(v);
    }

    private String sealedOrKeep(final Map<String, Object> body, final String k, final String existing) {
        if (!body.containsKey(k)) {
            return existing;
        }
        final Object v = body.get(k);
        if (v == null) {
            return null;
        }
        final String s = String.valueOf(v);
        if (s.isEmpty()) {
            return null;
        }
        if (SECRET_MASK.equals(s)) {
            return existing;
        }
        return secrets.seal(s);
    }

    private static boolean bool(final Map<String, Object> body, final String k, final boolean fallback) {
        if (!body.containsKey(k) || body.get(k) == null) {
            return fallback;
        }
        return Boolean.parseBoolean(String.valueOf(body.get(k)));
    }

    private static Boolean boolOrNull(final Map<String, Object> body, final String k, final Boolean fallback) {
        if (!body.containsKey(k)) {
            return fallback;
        }
        final Object v = body.get(k);
        return v == null ? null : Boolean.parseBoolean(String.valueOf(v));
    }

    private static Integer intOrNull(final Map<String, Object> body, final String k, final Integer fallback) {
        if (!body.containsKey(k)) {
            return fallback;
        }
        final Object v = body.get(k);
        if (v == null) {
            return null;
        }
        try {
            return v instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(v));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
