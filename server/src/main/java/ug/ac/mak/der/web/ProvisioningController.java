package ug.ac.mak.der.web;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ug.ac.mak.der.security.AuditEvent;
import ug.ac.mak.der.security.EdgeRole;
import ug.ac.mak.der.security.EdgeUser;
import ug.ac.mak.der.security.EdgeUserPrincipal;
import ug.ac.mak.der.security.EdgeUserRepository;
import ug.ac.mak.der.security.PasswordHasher;
import ug.ac.mak.der.security.SecurityAuditRepository;

/**
 * Phase 02 administrator-only user provisioning. {@code POST /users} upserts a
 * DER-mirrored user with a password; {@code GET /users} lists them.
 *
 * <p>DHIS2 reconciliation ({@code POST /sync-users}) is a stub that currently
 * reports the configured central and returns {@code 501 NOT_IMPLEMENTED}; the
 * real reconciliation pipeline lands in Phase 05 along with inbound metadata.
 * This endpoint exists at Phase 02 so admins can observe the gap in the UI.</p>
 */
@RestController
@RequestMapping(path = "/edge-api/v1/provisioning", produces = MediaType.APPLICATION_JSON_VALUE)
public class ProvisioningController {

    private static final Logger LOG = LoggerFactory.getLogger(ProvisioningController.class);

    private final EdgeUserRepository users;
    private final PasswordHasher hasher;
    private final SecurityAuditRepository audit;
    private final Clock clock;

    public ProvisioningController(final EdgeUserRepository users,
                                   final PasswordHasher hasher,
                                   final SecurityAuditRepository audit,
                                   final Clock clock) {
        this.users = users;
        this.hasher = hasher;
        this.audit = audit;
        this.clock = clock;
    }

    @PostMapping(path = "/users", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody final CreateUserRequest req,
                                                   final Authentication authentication,
                                                   final HttpServletRequest http) {
        final EdgeUserPrincipal admin = asEdgePrincipal(authentication);
        if (admin == null) {
            return ResponseEntity.status(401).build();
        }
        final Instant now = Instant.now(clock);
        final Set<EdgeRole> roles = EnumSet.copyOf(req.roles().stream().map(EdgeRole::valueOf).toList());
        if (roles.contains(EdgeRole.SYNC_WORKER)) {
            audit.append(new AuditEvent(
                    "PROVISIONING_DENIED",
                    AuditEvent.Outcome.DENIED,
                    admin.userId(), null,
                    http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                    Map.of("reason", "SYNC_WORKER role is reserved for the sync service", "username", req.username())
            ), now);
            return ResponseEntity.status(400).build();
        }
        final UUID userId = UUID.randomUUID();
        final String verifier = hasher.hash(req.password());
        final EdgeUser stored = users.upsert(new EdgeUser(
                userId,
                req.username().toLowerCase(java.util.Locale.ROOT),
                req.displayName(),
                EdgeUser.Origin.BOOTSTRAP,
                null,
                false,
                roles,
                now,
                now
        ), verifier);
        audit.append(new AuditEvent(
                "USER_CREATED",
                AuditEvent.Outcome.SUCCESS,
                admin.userId(), stored.userId(),
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                Map.of("username", stored.username(), "roles", stored.roles().stream().map(Enum::name).toList())
        ), now);
        LOG.info("admin {} provisioned user {} with roles {}", admin.user().username(), stored.username(), stored.roles());
        return ResponseEntity.status(201).body(UserResponse.of(stored));
    }

    private static EdgeUserPrincipal asEdgePrincipal(final Authentication authentication) {
        return authentication instanceof EdgeUserPrincipal p ? p : null;
    }

    @GetMapping("/users")
    public ResponseEntity<ListResponse> listUsers() {
        final List<UserResponse> users = this.users.findAll().stream().map(UserResponse::of).toList();
        return ResponseEntity.ok(new ListResponse(users));
    }

    @PostMapping("/sync-users")
    public ResponseEntity<SyncResponse> syncUsers(final Authentication authentication,
                                                   final HttpServletRequest http) {
        final EdgeUserPrincipal admin = asEdgePrincipal(authentication);
        if (admin == null) {
            return ResponseEntity.status(401).build();
        }
        // Phase 02: the DHIS2→DER user reconciliation pipeline is scoped out
        // and will land in Phase 05 along with inbound metadata refresh. The
        // endpoint is advertised here so admins see where the hole is.
        final Instant now = Instant.now(clock);
        audit.append(new AuditEvent(
                "USER_SYNC_INVOKED",
                AuditEvent.Outcome.ERROR,
                admin.userId(), null,
                http.getRemoteAddr(), http.getHeader(HttpHeaders.USER_AGENT),
                Map.of("status", "NOT_IMPLEMENTED", "defer_until_phase", "05")
        ), now);
        return ResponseEntity.status(501).body(new SyncResponse(
                "NOT_IMPLEMENTED",
                "User reconciliation from DHIS2 is a Phase 05 deliverable. Phase 02 provisions local users only."));
    }

    public record CreateUserRequest(
            @NotBlank @Pattern(regexp = "^[a-z0-9._-]{3,64}$",
                    message = "username must be lower-case, 3-64 chars of [a-z0-9._-]") String username,
            @NotBlank @Size(max = 128) String displayName,
            @NotBlank @Size(min = 12, max = 1024) String password,
            @NotEmpty List<@Pattern(regexp = "ADMIN|OPERATOR|REVIEWER|SYNC_WORKER") String> roles
    ) { }

    public record UserResponse(
            @JsonProperty("userId") String userId,
            @JsonProperty("username") String username,
            @JsonProperty("displayName") String displayName,
            @JsonProperty("origin") String origin,
            @JsonProperty("disabled") boolean disabled,
            @JsonProperty("roles") List<String> roles,
            @JsonProperty("createdAt") String createdAt,
            @JsonProperty("updatedAt") String updatedAt
    ) {
        static UserResponse of(final EdgeUser u) {
            return new UserResponse(
                    u.userId().toString(),
                    u.username(),
                    u.displayName(),
                    u.origin().name(),
                    u.disabled(),
                    u.roles().stream().map(Enum::name).toList(),
                    u.createdAt().toString(),
                    u.updatedAt().toString()
            );
        }
    }

    public record ListResponse(@JsonProperty("users") List<UserResponse> users) { }

    public record SyncResponse(@JsonProperty("status") String status,
                                @JsonProperty("message") String message) { }
}
