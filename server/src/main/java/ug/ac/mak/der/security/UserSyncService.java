package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ug.ac.mak.der.dhis2.Dhis2ReferenceClient;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient.Dhis2ResponseException;
import ug.ac.mak.der.dhis2.Dhis2ReferenceClient.Dhis2UnreachableException;

/**
 * FR-02-02 + FR-02-08 — mirror DHIS2 users into {@code der.edge_user}
 * so they can sign in offline, and reconcile lifecycle changes
 * (disable / role delta / tombstone) when central updates them.
 *
 * <p>Pulls from {@code GET /api/users?fields=id,username,firstName,
 * surname,displayName,disabled,userRoles[id,name,authorities]}.
 * Upserts keyed on {@code external_uid = DHIS2 user id}. Credential
 * material is <strong>not</strong> mirrored — DHIS2-origin users
 * sign in through the first-online path where the verifier is
 * derived locally (ADR-0003 provisioning flow).</p>
 *
 * <p>Lifecycle rules applied per run:
 * <ul>
 *   <li>Central has {@code disabled: true} → set {@code
 *       edge_user.disabled=true} and revoke every active session.</li>
 *   <li>DHIS2 user carries the {@code ALL} authority (DHIS2's
 *       superadmin bit) → ensure ADMIN role locally. Otherwise
 *       ensure OPERATOR. Local admin promotions set by SQL stay
 *       put if the DHIS2 role mapping doesn't decide ADMIN —
 *       presence of ADMIN locally wins over absence from central
 *       so a central-side misconfig can't lock everyone out.</li>
 *   <li>DHIS2-origin row that central no longer returns →
 *       tombstone: set {@code disabled=true}, revoke sessions,
 *       emit {@code USER_RECONCILIATION_REMOVED}. The row stays
 *       until the journal retention sweep (FR-09-10) reclaims it.</li>
 *   <li>Every successful upsert stamps
 *       {@code last_central_sync_at=now} which refreshes the
 *       FR-02-06 offline-credential-age window without requiring
 *       the user to sign in online.</li>
 * </ul>
 * </p>
 *
 * <p>Bootstrap-origin users ({@code origin=BOOTSTRAP}) are never
 * touched — the sweep ignores anyone whose {@code external_uid} is
 * null, so the local admin stays independent of central auth.</p>
 */
@Service
@ConditionalOnBean(Dhis2ReferenceClient.class)
public class UserSyncService {

    private static final Logger LOG = LoggerFactory.getLogger(UserSyncService.class);

    static final String USERS_PATH =
            "/api/users?paging=false"
            + "&fields=id,username,firstName,surname,displayName,disabled,"
            + "userRoles[id,name,authorities]";

    private final Dhis2ReferenceClient central;
    private final EdgeUserRepository users;
    private final SecurityAuditRepository audit;
    private final Clock clock;
    private final boolean enabled;

    private ObjectProvider<EdgeSessionRepository> sessionsProvider;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setSessions(final ObjectProvider<EdgeSessionRepository> p) {
        this.sessionsProvider = p;
    }

    public UserSyncService(final Dhis2ReferenceClient central,
                              final EdgeUserRepository users,
                              final SecurityAuditRepository audit,
                              final Clock clock,
                              @Value("${der.security.user-sync.enabled:true}")
                                  final boolean enabled) {
        this.central = Objects.requireNonNull(central, "central");
        this.users = Objects.requireNonNull(users, "users");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.enabled = enabled;
    }

    /**
     * Scheduled daily at 02:00 UTC — offset earlier than the
     * compliance / app sweeps (03:00+) so the user mirror is fresh
     * before anything else runs.
     */
    @Scheduled(cron = "${der.security.user-sync.cron:0 0 2 * * *}")
    public void dailySweep() {
        if (!enabled) {
            return;
        }
        try {
            sweepNow("SCHEDULED");
        } catch (final RuntimeException ex) {
            LOG.warn("scheduled user sync failed: {}", ex.getMessage());
        }
    }

    /** Operator-triggered sweep. Audits as {@code source=OPERATOR}. */
    public SyncReport runNow() {
        return sweepNow("OPERATOR");
    }

    public SyncReport sweepNow(final String source) {
        final Instant now = Instant.now(clock);
        final List<DhisUser> centralUsers;
        try {
            centralUsers = fetchCentralUsers();
        } catch (final Dhis2UnreachableException | Dhis2ResponseException ex) {
            LOG.warn("user sync central-fetch failed: {}", ex.getMessage());
            audit.append(new AuditEvent("USER_SYNC_RUN",
                    AuditEvent.Outcome.ERROR, null, null, null, null,
                    Map.of("source", source, "error", ex.getMessage())),
                    now);
            return new SyncReport(source, 0, 0, 0, 0, ex.getMessage());
        }
        int upserts = 0;
        int disables = 0;
        int tombstones = 0;
        final Set<String> seenCentralUids = new HashSet<>();
        for (final DhisUser cu : centralUsers) {
            if (cu.uid() == null || cu.uid().isBlank()
                    || cu.username() == null || cu.username().isBlank()) {
                continue;
            }
            seenCentralUids.add(cu.uid());
            final Optional<EdgeUser> existing = users.findByExternalUid(cu.uid());
            final UUID userId = existing.map(EdgeUser::userId).orElseGet(UUID::randomUUID);
            final Instant createdAt = existing.map(EdgeUser::createdAt).orElse(now);
            final EnumSet<EdgeRole> roles = resolveRoles(cu, existing);
            final EdgeUser desired = new EdgeUser(userId,
                    cu.username().toLowerCase(java.util.Locale.ROOT),
                    cu.displayName(), EdgeUser.Origin.DHIS2,
                    cu.uid(), cu.disabled(), roles, createdAt, now);
            users.upsert(desired, null);
            users.markCentralSyncAt(userId, now);
            upserts++;
            audit.append(new AuditEvent("USER_SYNC_UPSERT",
                    AuditEvent.Outcome.SUCCESS, null, userId, null, null,
                    Map.of("source", source, "externalUid", cu.uid(),
                            "disabled", String.valueOf(cu.disabled()),
                            "roles", roles.toString())),
                    now);
            if (cu.disabled() && existing.map(u -> !u.disabled()).orElse(false)) {
                revokeSessionsFor(userId);
                disables++;
                audit.append(new AuditEvent("USER_SYNC_DISABLED",
                        AuditEvent.Outcome.SUCCESS, null, userId,
                        null, null,
                        Map.of("source", source, "externalUid", cu.uid())),
                        now);
            }
        }
        // Tombstone sweep — DHIS2-origin users present locally but
        // missing from the central response. Bootstrap users are
        // skipped by construction (external_uid is null).
        for (final EdgeUser local : users.findAll()) {
            if (local.origin() != EdgeUser.Origin.DHIS2
                    || local.externalUid() == null
                    || seenCentralUids.contains(local.externalUid())
                    || local.disabled()) {
                continue;
            }
            users.setDisabled(local.userId(), true);
            revokeSessionsFor(local.userId());
            tombstones++;
            audit.append(new AuditEvent("USER_RECONCILIATION_REMOVED",
                    AuditEvent.Outcome.SUCCESS, null, local.userId(),
                    null, null,
                    Map.of("source", source,
                            "externalUid", local.externalUid(),
                            "username", local.username())),
                    now);
        }
        audit.append(new AuditEvent("USER_SYNC_RUN",
                AuditEvent.Outcome.SUCCESS, null, null, null, null,
                Map.of("source", source,
                        "centralCount", String.valueOf(centralUsers.size()),
                        "upserts", String.valueOf(upserts),
                        "disables", String.valueOf(disables),
                        "tombstones", String.valueOf(tombstones))),
                now);
        LOG.info("user sync {} — central={}, upserts={}, disables={}, tombstones={}",
                source, centralUsers.size(), upserts, disables, tombstones);
        return new SyncReport(source, centralUsers.size(),
                upserts, disables, tombstones, null);
    }

    private void revokeSessionsFor(final UUID userId) {
        final EdgeSessionRepository sessions = sessionsProvider == null
                ? null : sessionsProvider.getIfAvailable();
        if (sessions == null) {
            return;
        }
        try {
            sessions.revokeAllForUser(userId, Instant.now(clock));
        } catch (final RuntimeException ex) {
            LOG.debug("revokeAllForUser for {} failed: {}", userId, ex.getMessage());
        }
    }

    /**
     * Role resolution: central sets a floor, local decisions carry
     * forward. A DHIS2 user with the {@code ALL} authority resolves
     * to ADMIN; everyone else defaults to OPERATOR. An existing
     * local ADMIN always stays ADMIN — central-side misconfig
     * cannot strip privileges unilaterally. This matches the
     * "central is source of identity, local operators decide who
     * runs the appliance" posture.
     */
    private static EnumSet<EdgeRole> resolveRoles(final DhisUser cu,
                                                      final Optional<EdgeUser> existing) {
        final EnumSet<EdgeRole> out = EnumSet.of(EdgeRole.OPERATOR);
        if (cu.hasAllAuthority()) {
            out.add(EdgeRole.ADMIN);
        }
        existing.ifPresent(u -> {
            if (u.roles().contains(EdgeRole.ADMIN)) {
                out.add(EdgeRole.ADMIN);
            }
            if (u.roles().contains(EdgeRole.REVIEWER)) {
                out.add(EdgeRole.REVIEWER);
            }
        });
        return out;
    }

    List<DhisUser> fetchCentralUsers()
            throws Dhis2UnreachableException, Dhis2ResponseException {
        final JsonNode body = central.fetchJson(USERS_PATH);
        final JsonNode users = body.get("users");
        if (users == null || !users.isArray()) {
            return List.of();
        }
        final List<DhisUser> out = new ArrayList<>();
        for (final JsonNode u : users) {
            final String uid = textOrNull(u.get("id"));
            final String username = textOrNull(u.get("username"));
            if (uid == null || username == null) {
                continue;
            }
            final String display = textOrNull(u.get("displayName"));
            final String first = textOrNull(u.get("firstName"));
            final String surname = textOrNull(u.get("surname"));
            final String name = (display != null && !display.isBlank())
                    ? display
                    : trim((first == null ? "" : first) + " "
                            + (surname == null ? "" : surname));
            final boolean disabled = u.has("disabled") && u.get("disabled").asBoolean(false);
            boolean hasAll = false;
            final JsonNode roles = u.get("userRoles");
            if (roles != null && roles.isArray()) {
                for (final JsonNode r : roles) {
                    final JsonNode auths = r.get("authorities");
                    if (auths != null && auths.isArray()) {
                        for (final JsonNode a : auths) {
                            if ("ALL".equals(a.asText())) {
                                hasAll = true;
                                break;
                            }
                        }
                    }
                    if (hasAll) {
                        break;
                    }
                }
            }
            out.add(new DhisUser(uid, username,
                    name.isEmpty() ? username : name,
                    disabled, hasAll));
        }
        return out;
    }

    private static String textOrNull(final JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private static String trim(final String s) {
        return s == null ? "" : s.trim();
    }

    /** One DHIS2 user mapped to the fields DER's sync loop cares about. */
    public record DhisUser(String uid, String username, String displayName,
                              boolean disabled, boolean hasAllAuthority) {
        public boolean hasAllAuthority() {
            return hasAllAuthority;
        }
    }

    /** Return value from a sweep — used by admin trigger for the UI. */
    public record SyncReport(String source, int centralCount,
                                int upserts, int disables, int tombstones,
                                String error) { }
}
