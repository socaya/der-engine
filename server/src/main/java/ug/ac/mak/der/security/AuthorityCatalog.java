package ug.ac.mak.der.security;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The full catalogue of authorities DER's admin surface recognises.
 *
 * <p>Fine-grained by design: separate capabilities get separate authority
 * strings so a role can be granted only what it needs.  Dynamic roles
 * (see {@link RoleDefinition}) select authorities from this list; the
 * admin UI's role editor renders the list grouped by {@link #module()}.</p>
 *
 * <p>Every authority string is prefixed {@code der.<module>.<verb>}.  The
 * database {@code role_authority.authority LIKE 'der.%'} CHECK constraint
 * mirrors that convention.</p>
 *
 * <p>Adding a new authority: add the enum constant AND include its
 * {@link #authority()} string in the Administrator seed in the latest
 * migration so the built-in admin role stays an "all authorities" role.</p>
 */
public enum AuthorityCatalog {
    // ---- Users -----------------------------------------------------------
    USERS_READ          ("der.users.read",          "Users",  "View users and their mappings"),
    USERS_CREATE        ("der.users.create",        "Users",  "Provision new users"),
    USERS_UPDATE        ("der.users.update",        "Users",  "Edit user profile + display name"),
    USERS_DISABLE       ("der.users.disable",       "Users",  "Disable (or re-enable) a user"),
    USERS_MAPPING_WRITE ("der.users.mapping.write", "Users",  "Edit the edge-user ↔ DHIS2-user mapping"),
    USERS_ROLE_ASSIGN   ("der.users.role.assign",   "Users",  "Assign or revoke roles on a user"),

    // ---- Roles -----------------------------------------------------------
    ROLES_READ          ("der.roles.read",          "Roles",  "View the role catalogue"),
    ROLES_WRITE         ("der.roles.write",         "Roles",  "Create, edit and delete roles"),

    // ---- DHIS2 wiring ----------------------------------------------------
    DHIS2_READ              ("der.dhis2.read",              "DHIS2", "View DHIS2 wiring and metadata"),
    DHIS2_CONNECTION_WRITE  ("der.dhis2.connection.write",  "DHIS2", "Edit DHIS2 base URL + pins"),
    DHIS2_CREDENTIALS_ROTATE("der.dhis2.credentials.rotate", "DHIS2", "Rotate the DHIS2 service credential"),

    // ---- Sync ------------------------------------------------------------
    SYNC_READ            ("der.sync.read",            "Sync", "View sync jobs, snapshots and drift"),
    SYNC_METADATA_RUN    ("der.sync.metadata.run",    "Sync", "Trigger a metadata sync"),
    SYNC_DATA_RUN        ("der.sync.data.run",        "Sync", "Trigger an inbound data pull"),
    SYNC_DRIFT_RESOLVE   ("der.sync.drift.resolve",   "Sync", "Resolve metadata drift findings"),
    SYNC_SCHEDULE_WRITE  ("der.sync.schedule.write",  "Sync", "Edit the sync schedule / cron"),

    // ---- Drafts ----------------------------------------------------------
    DRAFTS_READ           ("der.drafts.read",           "Drafts", "View drafts"),
    DRAFTS_PUBLISH_OWN    ("der.drafts.publish.own",    "Drafts", "Publish one's own drafts"),
    DRAFTS_PUBLISH_ANY    ("der.drafts.publish.any",    "Drafts", "Publish any user's drafts (reviewer approval)"),
    DRAFTS_SCHEDULE_WRITE ("der.drafts.schedule.write", "Drafts", "Schedule a draft for future publication"),

    // ---- Conflicts -------------------------------------------------------
    CONFLICTS_READ         ("der.conflicts.read",         "Conflicts", "View the conflict queue"),
    CONFLICTS_RESOLVE      ("der.conflicts.resolve",      "Conflicts", "Resolve a single conflict"),
    CONFLICTS_BULK_RESOLVE ("der.conflicts.bulk.resolve", "Conflicts", "Bulk-resolve a filtered conflict set"),

    // ---- Referrals -------------------------------------------------------
    REFERRALS_READ      ("der.referrals.read",     "Referrals", "View referrals"),
    REFERRALS_ACCEPT    ("der.referrals.accept",   "Referrals", "Accept an inbound referral"),
    REFERRALS_DISMISS   ("der.referrals.dismiss",  "Referrals", "Dismiss an inbound referral"),
    REFERRALS_ESCALATE  ("der.referrals.escalate", "Referrals", "Escalate an unanswered referral"),

    // ---- Devices ---------------------------------------------------------
    DEVICES_READ         ("der.devices.read",         "Devices", "View the device fleet"),
    DEVICES_APPROVE      ("der.devices.approve",      "Devices", "Approve a pending enrolment"),
    DEVICES_SUSPEND      ("der.devices.suspend",      "Devices", "Suspend an approved device"),
    DEVICES_REVOKE       ("der.devices.revoke",       "Devices", "Revoke a device (permanent)"),
    DEVICES_DECOMMISSION ("der.devices.decommission", "Devices", "Delete a device + its history"),

    // ---- Network ---------------------------------------------------------
    NETWORK_READ           ("der.network.read",           "Network", "View network topology and peers"),
    NETWORK_PEER_WRITE     ("der.network.peer.write",     "Network", "Edit peer definitions and adjacency"),
    NETWORK_TOPOLOGY_WRITE ("der.network.topology.write", "Network", "Edit routing + topology"),
    NETWORK_FIREWALL_WRITE ("der.network.firewall.write", "Network", "Edit firewall + lease rules"),

    // ---- Workflows (capture workflows, not Spring workflows) -------------
    WORKFLOWS_READ            ("der.workflows.read",            "Workflows", "View capture workflows + activity"),
    WORKFLOWS_RUN_OPEN        ("der.workflows.run.open",        "Workflows", "Open a workflow run"),
    WORKFLOWS_RUN_CONTRIBUTE  ("der.workflows.run.contribute",  "Workflows", "Contribute to a workflow run"),
    WORKFLOWS_PUBLISH         ("der.workflows.publish",         "Workflows", "Publish a workflow run's output"),
    WORKFLOWS_CATALOGUE_WRITE ("der.workflows.catalogue.write", "Workflows", "Edit the workflow catalogue"),

    // ---- Backup + restore ------------------------------------------------
    BACKUP_READ      ("der.backup.read",     "Backup", "View backup runs"),
    BACKUP_TRIGGER   ("der.backup.trigger",  "Backup", "Trigger a backup"),
    BACKUP_DOWNLOAD  ("der.backup.download", "Backup", "Download a backup artefact"),
    RESTORE_EXECUTE  ("der.restore.execute", "Backup", "Execute a restore"),

    // ---- Audit -----------------------------------------------------------
    AUDIT_READ   ("der.audit.read",   "Audit", "View the security audit stream"),
    AUDIT_EXPORT ("der.audit.export", "Audit", "Export the audit stream to file"),

    // ---- Compliance ------------------------------------------------------
    COMPLIANCE_READ   ("der.compliance.read",   "Compliance", "View compliance posture"),
    COMPLIANCE_MANAGE ("der.compliance.manage", "Compliance", "Run retention / erasure / audit-export jobs"),

    // ---- System ---------------------------------------------------------
    SYSTEM_READ              ("der.system.read",              "System", "View diagnostics + settings"),
    SYSTEM_SETTINGS_WRITE    ("der.system.settings.write",    "System", "Edit settings + feature flags + org-unit binding"),
    SYSTEM_ANALYTICS_REFRESH ("der.system.analytics.refresh", "System", "Refresh analytics materialised views"),
    SYSTEM_HARDWARE_WRITE    ("der.system.hardware.write",    "System", "Write to hardware (LEDs, fan, etc.)"),
    SYSTEM_VAULT_READ        ("der.system.vault.read",        "System", "Read the security-hardening vault"),
    SYSTEM_TESTING_RUN       ("der.system.testing.run",       "System", "Run chaos / fault-injection harness"),
    SYSTEM_DECOMMISSION      ("der.system.decommission",      "System", "Decommission the edge (irreversible)");

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
