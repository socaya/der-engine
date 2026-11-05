package ug.ac.mak.der.web;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.attribution.EdgeUserDhis2Mapping;
import ug.ac.mak.der.attribution.EdgeUserDhis2MappingRepository;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.ops.AdminSettingRepository;
import ug.ac.mak.der.orgunit.EdgeOrgUnitBinding;
import ug.ac.mak.der.orgunit.OrgUnitBindingService;
import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.SecretEnvelope;
import ug.ac.mak.der.security.SecurityAuditRepository;

import org.springframework.beans.factory.annotation.Autowired;

/**
 * ADR-0032: admin-only maintenance of the edge-user ↔ DHIS2-user map.
 * Operators map themselves at provisioning time; this controller lets
 * ADMINs patch and audit the map.
 */
@RestController
@RequestMapping(path = "/edge-api/v1/admin/users",
        produces = MediaType.APPLICATION_JSON_VALUE)
public class UserAttributionController {

    private static final String SETTING_DEFAULT_AUTH_TYPE =
            "dhis2.user_credentials.default_auth_type";

    private final EdgeUserDhis2MappingRepository repo;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final Dhis2ReferenceClient dhis2;
    private final AdminSettingRepository settings;
    private final SecretEnvelope envelope;
    /** Null on unbound dev instances (ConditionalOnBean). */
    private final OrgUnitBindingService binding;

    public UserAttributionController(final EdgeUserDhis2MappingRepository repo,
                                       final SecurityAuditRepository audit,
                                       final Clock clock,
                                       final Dhis2ReferenceClient dhis2,
                                       final AdminSettingRepository settings,
                                       final SecretEnvelope envelope,
                                       @Autowired(required = false)
                                       final OrgUnitBindingService binding) {
        this.repo = Objects.requireNonNull(repo, "repo");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.dhis2 = Objects.requireNonNull(dhis2, "dhis2");
        this.settings = Objects.requireNonNull(settings, "settings");
        this.envelope = Objects.requireNonNull(envelope, "envelope");
        this.binding = binding;
    }

    @GetMapping("/dhis2-mappings")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> list() {
        final List<EdgeUserDhis2Mapping> rows = repo.findAll();
        return ResponseEntity.ok(Map.of("mappings",
                rows.stream().map(UserAttributionController::toJson).toList()));
    }

    @GetMapping("/{id}/dhis2-mapping")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> get(@PathVariable("id") final UUID id) {
        return repo.findByEdgeUser(id)
                .<ResponseEntity<Map<String, Object>>>map(m -> ResponseEntity.ok(toJson(m)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping(path = "/{id}/dhis2-mapping",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> put(final Authentication authentication,
                                                     @PathVariable("id") final UUID id,
                                                     @RequestBody final MappingRequest body) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        if (body == null || body.dhis2UserUid() == null
                || body.dhis2Username() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MAPPING_INVALID",
                    "message", "dhis2UserUid and dhis2Username are required"));
        }
        final Instant now = Instant.now(clock);
        EdgeUserDhis2Mapping.AuthType authType = null;
        if (body.authType() != null && !body.authType().isBlank()) {
            try {
                authType = EdgeUserDhis2Mapping.AuthType.valueOf(body.authType());
            } catch (IllegalArgumentException ex) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "MAPPING_INVALID",
                        "message", "authType must be TOKEN or BASIC"));
            }
        }
        /* Only seal + persist the credential when the body carries a
         * non-blank value; a blank/null credential means the operator
         * is editing non-secret fields and the stored envelope must be
         * preserved (handled by COALESCE in the repo upsert). */
        String sealed = null;
        Instant credSetAt = null;
        UUID credSetBy = null;
        if (body.credential() != null && !body.credential().isBlank()) {
            if (authType == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "code", "MAPPING_INVALID",
                        "message", "authType is required when credential is set"));
            }
            sealed = envelope.seal(body.credential());
            credSetAt = now;
            credSetBy = principal.userId();
        }
        final EdgeUserDhis2Mapping mapping;
        try {
            mapping = new EdgeUserDhis2Mapping(id, body.dhis2UserUid(),
                    body.dhis2Username(), body.dhis2DisplayName(),
                    now, principal.userId(), now,
                    authType, sealed, credSetAt, credSetBy);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "MAPPING_INVALID", "message", ex.getMessage()));
        }
        repo.upsert(mapping);
        final Map<String, String> detail = new LinkedHashMap<>();
        detail.put("edgeUserId", id.toString());
        detail.put("dhis2UserUid", body.dhis2UserUid());
        if (authType != null) {
            detail.put("authType", authType.name());
        }
        if (sealed != null) {
            detail.put("credentialSet", "true");
        }
        audit.append(new AuditEvent("USER_DHIS2_MAPPING_SET",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.copyOf(detail)), now);
        /* Reload so the response reflects persisted auth_type +
         * hasCredential even when the operator didn't send either. */
        final EdgeUserDhis2Mapping stored = repo.findByEdgeUser(id).orElse(mapping);
        return ResponseEntity.ok(toJson(stored));
    }

    @DeleteMapping("/{id}/dhis2-mapping")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> delete(final Authentication authentication,
                                                        @PathVariable("id") final UUID id) {
        if (!(authentication instanceof EdgeUserPrincipal principal)) {
            return ResponseEntity.status(401).build();
        }
        final int rows = repo.delete(id);
        audit.append(new AuditEvent("USER_DHIS2_MAPPING_CLEARED",
                AuditEvent.Outcome.SUCCESS, principal.userId(), null, null, null,
                Map.of("edgeUserId", id.toString())), Instant.now(clock));
        return ResponseEntity.ok(Map.of("cleared", rows > 0));
    }

    /**
     * Search the bound DHIS2 central for user candidates to map against.
     * Proxies {@code GET /api/users} with the query filter + a compact
     * fields selector so the admin UI can render a typeahead picker.
     *
     * <p>Query semantics match DHIS2's native {@code query=} parameter
     * — match-anywhere across username, displayName, email.  Empty
     * query returns the first page of users (default sort).</p>
     */
    @GetMapping("/dhis2-candidates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> candidates(
            @RequestParam(name = "q", required = false) final String q,
            @RequestParam(name = "pageSize", required = false, defaultValue = "20")
            final int pageSize,
            @RequestParam(name = "scope", required = false, defaultValue = "ou")
            final String scope) {
        final int size = Math.max(1, Math.min(100, pageSize));
        /* scope=ou (default): restrict to users whose OU chain contains
         * the bound orgUnit (= the bound OU or any descendant). DHIS2
         * stores paths as "/ANCESTOR_UID/.../OWN_UID"; UIDs are random
         * 11-char strings so a path:like:<boundOuId> filter uniquely
         * picks the bound OU + descendants without collision.
         *
         * scope=all: no filter. Used when the operator needs to map an
         * out-of-scope user (e.g. a visiting district supervisor).
         *
         * When the edge isn't bound yet we silently fall back to "all"
         * since there is no OU to scope against. */
        EdgeOrgUnitBinding currentBinding =
                binding == null ? null : binding.current();
        if (currentBinding == null) {
            currentBinding = EdgeOrgUnitBinding.empty();
        }
        final boolean wantOuScope = !"all".equalsIgnoreCase(scope);
        final boolean ouScopeActive = wantOuScope && currentBinding.isBound();
        final StringBuilder p = new StringBuilder(
                "/api/users.json?fields=id,username,displayName,disabled")
                .append("&pageSize=").append(size);
        if (q != null && !q.isBlank()) {
            p.append("&query=").append(
                    URLEncoder.encode(q.trim(), StandardCharsets.UTF_8));
        }
        if (ouScopeActive) {
            p.append("&filter=organisationUnits.path:like:")
                    .append(URLEncoder.encode(currentBinding.orgUnitId(),
                            StandardCharsets.UTF_8));
        }
        final String path = p.toString();
        try {
            final JsonNode body = dhis2.fetchJson(path);
            final JsonNode users = body.get("users");
            final List<Map<String, Object>> rows = new ArrayList<>();
            if (users != null && users.isArray()) {
                for (final JsonNode u : users) {
                    final Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("id", textOrNull(u.get("id")));
                    entry.put("username", textOrNull(u.get("username")));
                    entry.put("displayName", textOrNull(u.get("displayName")));
                    final JsonNode disabled = u.get("disabled");
                    entry.put("disabled", disabled != null && disabled.asBoolean(false));
                    rows.add(entry);
                }
            }
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("candidates", rows);
            out.put("query", q == null ? "" : q);
            out.put("scope", ouScopeActive ? "ou" : "all");
            if (ouScopeActive) {
                out.put("boundOrgUnitId", currentBinding.orgUnitId());
                out.put("boundOrgUnitDisplayName",
                        currentBinding.orgUnitDisplayName());
            }
            return ResponseEntity.ok(out);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "DHIS2_UNREACHABLE",
                    "message", ex.getMessage() == null ? "DHIS2 central unreachable" : ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "code", "DHIS2_RESPONSE_INVALID",
                    "message", ex.getMessage() == null ? "DHIS2 central returned an invalid response" : ex.getMessage()));
        }
    }

    private static String textOrNull(final JsonNode node) {
        return node == null || !node.isTextual() ? null : node.asText();
    }

    /**
     * System-wide default auth type for per-user mappings.  Operators
     * override per mapping on the Edit form; when authType is null on
     * the mapping, this value is consulted at push time.
     */
    @GetMapping("/dhis2-auth-type-default")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> defaultAuthType() {
        final String raw = settings.read(SETTING_DEFAULT_AUTH_TYPE)
                .map(AdminSettingRepository.Entry::value)
                .orElse("\"BASIC\"");
        /* Stored as a JSON string so unquote before returning. */
        final String stripped = raw != null && raw.startsWith("\"") && raw.endsWith("\"")
                ? raw.substring(1, raw.length() - 1)
                : raw;
        return ResponseEntity.ok(Map.of(
                "defaultAuthType", stripped == null ? "BASIC" : stripped));
    }

    /**
     * Full DHIS2 user profile — proxies {@code GET /api/users/{uid}}
     * with the admin-oriented field set so the mapping form can show
     * email, phone, created-at, org units and the central's view of
     * group memberships after a candidate pick.
     */
    @GetMapping("/dhis2-user-details")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> userDetails(
            @RequestParam("uid") final String uid) {
        if (uid == null || uid.isBlank()
                || !uid.matches("^[A-Za-z][A-Za-z0-9]{10}$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "code", "UID_INVALID",
                    "message", "uid must be 11-char DHIS2 UID"));
        }
        /* DHIS2's field sub-selector uses [...], but Java's HttpClient does
         * not percent-encode those characters in a query string, and Tomcat
         * on central 2.44 rejects the raw brackets with HTTP 400.  Encode
         * them explicitly so the URI arrives on central as %5B / %5D. */
        final String path = "/api/users/" + uid + ".json?fields="
                + "id,username,displayName,email,phoneNumber,disabled,"
                + "created,lastUpdated,"
                + "userCredentials%5BlastLogin,twoFactorEnabled%5D,"
                + "organisationUnits%5Bid,displayName%5D,"
                + "userGroups%5Bid,displayName%5D";
        try {
            final JsonNode body = dhis2.fetchJson(path);
            final Map<String, Object> out = new LinkedHashMap<>();
            out.put("id", textOrNull(body.get("id")));
            out.put("username", textOrNull(body.get("username")));
            out.put("displayName", textOrNull(body.get("displayName")));
            out.put("email", textOrNull(body.get("email")));
            out.put("phoneNumber", textOrNull(body.get("phoneNumber")));
            out.put("disabled", body.get("disabled") != null
                    && body.get("disabled").asBoolean(false));
            out.put("created", textOrNull(body.get("created")));
            out.put("lastUpdated", textOrNull(body.get("lastUpdated")));
            final JsonNode creds = body.get("userCredentials");
            if (creds != null) {
                out.put("lastLogin", textOrNull(creds.get("lastLogin")));
                out.put("twoFactorEnabled",
                        creds.get("twoFactorEnabled") != null
                                && creds.get("twoFactorEnabled").asBoolean(false));
            }
            out.put("organisationUnits", namedList(body.get("organisationUnits")));
            out.put("userGroups", namedList(body.get("userGroups")));
            return ResponseEntity.ok(out);
        } catch (Dhis2ReferenceClient.Dhis2UnreachableException ex) {
            return ResponseEntity.status(503).body(Map.of(
                    "code", "DHIS2_UNREACHABLE",
                    "message", ex.getMessage() == null ? "DHIS2 central unreachable" : ex.getMessage()));
        } catch (Dhis2ReferenceClient.Dhis2ResponseException ex) {
            return ResponseEntity.status(502).body(Map.of(
                    "code", "DHIS2_RESPONSE_INVALID",
                    "message", ex.getMessage() == null ? "DHIS2 response invalid" : ex.getMessage()));
        }
    }

    private static List<Map<String, String>> namedList(final JsonNode arr) {
        final List<Map<String, String>> out = new java.util.ArrayList<>();
        if (arr == null || !arr.isArray()) {
            return out;
        }
        for (final JsonNode n : arr) {
            final Map<String, String> row = new LinkedHashMap<>();
            row.put("id", textOrNull(n.get("id")));
            row.put("displayName", textOrNull(n.get("displayName")));
            out.add(row);
        }
        return out;
    }

    private static Map<String, Object> toJson(final EdgeUserDhis2Mapping m) {
        final Map<String, Object> out = new LinkedHashMap<>();
        out.put("edgeUserId", m.edgeUserId().toString());
        out.put("dhis2UserUid", m.dhis2UserUid());
        out.put("dhis2Username", m.dhis2Username());
        out.put("dhis2DisplayName", m.dhis2DisplayName());
        out.put("mappedAt", m.mappedAt().toString());
        out.put("mappedBy", m.mappedBy().toString());
        out.put("lastVerifiedAt",
                m.lastVerifiedAt() == null ? null : m.lastVerifiedAt().toString());
        out.put("authType", m.authType() == null ? null : m.authType().name());
        out.put("hasCredential", m.hasCredential());
        out.put("credentialSetAt",
                m.credentialSetAt() == null ? null : m.credentialSetAt().toString());
        return out;
    }

    public record MappingRequest(
            @JsonProperty("dhis2UserUid") String dhis2UserUid,
            @JsonProperty("dhis2Username") String dhis2Username,
            @JsonProperty("dhis2DisplayName") String dhis2DisplayName,
            /** 'TOKEN' | 'BASIC' | null — null preserves existing value on update. */
            @JsonProperty("authType") String authType,
            /** Cleartext credential (sealed server-side).  null/blank preserves existing. */
            @JsonProperty("credential") String credential) { }
}
