package ug.ac.mak.der.security;

import java.time.Clock;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * On first boot — when the {@code edge_user} table contains no row with the
 * {@code ADMIN} role — this runner provisions a single administrator from
 * {@code DER_BOOTSTRAP_ADMIN_USERNAME/PASSWORD}. Subsequent boots are no-ops.
 *
 * <p>If no ADMIN exists AND the bootstrap env is not set, the runner logs a
 * loud WARN but does not fail startup — Phase 02 may still be useful for
 * read-only inspection via future unauthenticated endpoints. Phase 02's gate
 * enforces that at least one admin exists before any provisioning test runs.</p>
 */
@Component
public class BootstrapAdminProvisioner implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(BootstrapAdminProvisioner.class);
    static final String EVENT_TYPE = "BOOTSTRAP_ADMIN_PROVISIONED";

    private final EdgeUserRepository users;
    private final PasswordHasher hasher;
    private final SecurityAuditRepository audit;
    private final SecurityProperties props;
    private final Clock clock;

    public BootstrapAdminProvisioner(final EdgeUserRepository users,
                                      final PasswordHasher hasher,
                                      final SecurityAuditRepository audit,
                                      final SecurityProperties props,
                                      final Clock clock) {
        this.users = Objects.requireNonNull(users, "users");
        this.hasher = Objects.requireNonNull(hasher, "hasher");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.props = Objects.requireNonNull(props, "props");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @Override
    public void run(final ApplicationArguments args) {
        if (users.anyUserHasRole(EdgeRole.ADMIN)) {
            LOG.debug("ADMIN user already exists; bootstrap no-op.");
            return;
        }
        if (!props.bootstrap().isConfigured()) {
            LOG.warn("No ADMIN exists AND DER_BOOTSTRAP_ADMIN_USERNAME/PASSWORD are unset. "
                    + "Set them and restart, OR provision via SQL. All /edge-api/v1/provisioning/** "
                    + "endpoints will be unreachable until an ADMIN is seeded.");
            return;
        }
        final Instant now = Instant.now(clock);
        final String username = props.bootstrap().adminUsername().toLowerCase(java.util.Locale.ROOT);
        final UUID userId = UUID.randomUUID();
        final String verifier = hasher.hash(props.bootstrap().adminPassword());
        users.upsert(new EdgeUser(
                userId,
                username,
                "Bootstrap administrator",
                EdgeUser.Origin.BOOTSTRAP,
                null,
                false,
                EnumSet.of(EdgeRole.ADMIN),
                now,
                now
        ), verifier);
        audit.append(new AuditEvent(
                EVENT_TYPE,
                AuditEvent.Outcome.SUCCESS,
                null, userId,
                null, null,
                Map.of("username", username)
        ), now);
        LOG.warn("Bootstrap administrator '{}' provisioned. Clear DER_BOOTSTRAP_ADMIN_* "
                + "from the environment and restart to prevent repeated audit noise.",
                PiiMasking.maskUsername(username));
    }
}
