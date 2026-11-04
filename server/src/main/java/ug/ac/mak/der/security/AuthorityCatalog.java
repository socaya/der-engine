package ug.ac.mak.der.security;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The full catalogue of authorities DER's admin surface recognises.  Dynamic
 * roles (see {@link RoleDefinition}) select authorities from this list; the
 * admin UI's role editor renders the list grouped by {@link #module()}.
 *
 * <p>Every authority string is prefixed {@code der.<module>.<verb>}.  The
 * database {@code role_authority.authority LIKE 'der.%'} CHECK constraint
 * mirrors that convention.</p>
 *
 * <p>Adding a new authority: add the enum constant AND include its
 * {@link #authority()} string in the Administrator seed in V086 (or a later
 * migration) so the built-in admin role stays an "all authorities" role.</p>
 */
public enum AuthorityCatalog {
    USERS_READ      ("der.users.read",      "Users",      "View users and mappings"),
    USERS_WRITE     ("der.users.write",     "Users",      "Create, edit and disable users"),

    ROLES_READ      ("der.roles.read",      "Roles",      "View the role catalogue"),
    ROLES_WRITE     ("der.roles.write",     "Roles",      "Create, edit and delete roles"),

    DHIS2_READ      ("der.dhis2.read",      "DHIS2",      "View DHIS2 wiring and metadata"),
    DHIS2_WRITE     ("der.dhis2.write",     "DHIS2",      "Edit DHIS2 wiring and credentials"),

    SYNC_READ       ("der.sync.read",       "Sync",       "View sync jobs and drift"),
    SYNC_RUN        ("der.sync.run",        "Sync",       "Trigger metadata and data syncs"),

    DRAFTS_READ     ("der.drafts.read",     "Drafts",     "View drafts"),
    DRAFTS_PUBLISH  ("der.drafts.publish",  "Drafts",     "Publish and schedule drafts"),

    CONFLICTS_READ    ("der.conflicts.read",    "Conflicts", "View the conflict queue"),
    CONFLICTS_RESOLVE ("der.conflicts.resolve", "Conflicts", "Resolve conflicts"),

    REFERRALS_READ   ("der.referrals.read",   "Referrals", "View referrals"),
    REFERRALS_MANAGE ("der.referrals.manage", "Referrals", "Accept, dismiss and route referrals"),

    DEVICES_READ   ("der.devices.read",   "Devices", "View device fleet"),
    DEVICES_MANAGE ("der.devices.manage", "Devices", "Approve, suspend and revoke devices"),

    NETWORK_READ   ("der.network.read",   "Network", "View network topology and peers"),
    NETWORK_MANAGE ("der.network.manage", "Network", "Edit peers and routing"),

    WORKFLOWS_READ   ("der.workflows.read",   "Workflows", "View capture workflows"),
    WORKFLOWS_MANAGE ("der.workflows.manage", "Workflows", "Edit and publish capture workflows"),

    BACKUP_READ   ("der.backup.read",   "Backup", "View backup runs"),
    BACKUP_MANAGE ("der.backup.manage", "Backup", "Trigger backups and restores"),

    AUDIT_READ    ("der.audit.read",    "Audit",  "View the security audit stream"),

    SYSTEM_READ   ("der.system.read",   "System", "View system diagnostics and settings"),
    SYSTEM_MANAGE ("der.system.manage", "System", "Edit system settings and feature flags");

    private final String authority;
    private final String module;
    private final String description;

    AuthorityCatalog(final String authority, final String module, final String description) {
        this.authority = Objects.requireNonNull(authority, "authority");
        this.module = Objects.requireNonNull(module, "module");
        this.description = Objects.requireNonNull(description, "description");
    }

    public String authority() {
        return authority;
    }

    public String module() {
        return module;
    }

    public String description() {
        return description;
    }

    /** Full catalogue, insertion order (= module-grouped). */
    public static List<AuthorityCatalog> all() {
        return List.of(values());
    }

    /** The set of valid authority strings (for input validation). */
    public static Set<String> validAuthorityStrings() {
        return java.util.Arrays.stream(values())
                .map(AuthorityCatalog::authority)
                .collect(Collectors.toUnmodifiableSet());
    }
}
