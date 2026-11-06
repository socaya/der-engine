package ug.ac.mak.der.security;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The full catalogue of authorities DER's admin surface recognises.
 *
 * <p>Each entry carries two prose strings:</p>
 * <ul>
 *   <li>{@link #allows()} — what a role carrying this authority can do.</li>
 *   <li>{@link #restricts()} — what the absence of the authority blocks,
 *       i.e. the enforcement clause.</li>
 * </ul>
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
    USERS_READ          ("der.users.read",          "Users",
            "View users and their mappings.",
            "Without this authority, operators cannot browse the users list."),
    USERS_CREATE        ("der.users.create",        "Users",
            "Provision new users.",
            "Blocks POST to /edge-api/v1/provisioning/users."),
    USERS_UPDATE        ("der.users.update",        "Users",
            "Edit a user's profile + display name.",
            "Blocks PUT on the user profile endpoints."),
    USERS_DISABLE       ("der.users.disable",       "Users",
            "Disable (or re-enable) a user.",
            "Blocks POST /provisioning/users/{id}/disable."),
    USERS_MAPPING_WRITE ("der.users.mapping.write", "Users",
            "Edit the edge-user ↔ DHIS2-user mapping.",
            "Blocks PUT + DELETE on /admin/users/*/dhis2-mapping."),
    USERS_ROLE_ASSIGN   ("der.users.role.assign",   "Users",
            "Assign or revoke roles on a user.",
            "Blocks POST /provisioning/users/{id}/roles."),

    // ---- Roles -----------------------------------------------------------
    ROLES_READ          ("der.roles.read",          "Roles",
            "View the role catalogue.",
            "Blocks GET /edge-api/v1/admin/roles."),
    ROLES_WRITE         ("der.roles.write",         "Roles",
            "Create, edit and delete roles.",
            "Blocks POST + PUT + DELETE on /edge-api/v1/admin/roles."),

    // ---- DHIS2 wiring ----------------------------------------------------
    DHIS2_READ              ("der.dhis2.read",              "DHIS2",
            "View DHIS2 wiring and metadata.",
            "Blocks GET on the DHIS2 configuration surface."),
    DHIS2_CONNECTION_WRITE  ("der.dhis2.connection.write",  "DHIS2",
            "Edit DHIS2 base URL + version pins.",
            "Blocks PUT on /edge-api/v1/dhis2/connection."),
    DHIS2_CREDENTIALS_ROTATE("der.dhis2.credentials.rotate", "DHIS2",
            "Rotate the DHIS2 service credential.",
            "Blocks POST /edge-api/v1/dhis2/credentials/rotate."),

    // ---- Sync ------------------------------------------------------------
    SYNC_READ            ("der.sync.read",            "Sync",
            "View sync jobs, snapshots and drift.",
            "Blocks GET on /edge-api/v1/sync/**."),
    SYNC_METADATA_RUN    ("der.sync.metadata.run",    "Sync",
            "Trigger a metadata sync.",
            "Blocks POST /edge-api/v1/sync/metadata/run."),
    SYNC_DATA_RUN        ("der.sync.data.run",        "Sync",
            "Trigger an inbound data pull.",
            "Blocks POST /edge-api/v1/sync/data/run."),
    SYNC_DRIFT_RESOLVE   ("der.sync.drift.resolve",   "Sync",
            "Resolve metadata drift findings.",
            "Blocks POST /edge-api/v1/sync/drift/*/resolve."),
    SYNC_SCHEDULE_WRITE  ("der.sync.schedule.write",  "Sync",
            "Edit the sync schedule / cron.",
            "Blocks PUT /edge-api/v1/sync/schedule."),

    // ---- Drafts ----------------------------------------------------------
    DRAFTS_READ           ("der.drafts.read",           "Drafts",
            "View drafts.",
            "Blocks GET on /edge-api/v1/drafts/**."),
    DRAFTS_PUBLISH_OWN    ("der.drafts.publish.own",    "Drafts",
            "Publish drafts the operator owns.",
            "Without this, operators cannot publish even their own drafts."),
    DRAFTS_PUBLISH_ANY    ("der.drafts.publish.any",    "Drafts",
            "Publish any user's drafts (reviewer approval flow).",
            "Reviewer approval POSTs on /approvals/** are blocked."),
    DRAFTS_SCHEDULE_WRITE ("der.drafts.schedule.write", "Drafts",
            "Schedule a draft for future publication.",
            "Blocks POST /edge-api/v1/drafts/*/schedule."),

    // ---- Conflicts -------------------------------------------------------
    CONFLICTS_READ         ("der.conflicts.read",         "Conflicts",
            "View the conflict queue.",
            "Blocks GET on /edge-api/v1/journal/conflicts."),
    CONFLICTS_RESOLVE      ("der.conflicts.resolve",      "Conflicts",
            "Resolve a single conflict.",
            "Blocks POST /edge-api/v1/journal/conflicts/*/resolve."),
    CONFLICTS_BULK_RESOLVE ("der.conflicts.bulk.resolve", "Conflicts",
            "Bulk-resolve a filtered conflict set.",
            "Blocks POST /edge-api/v1/journal/conflicts/bulk-resolve."),

    // ---- Referrals -------------------------------------------------------
    REFERRALS_READ      ("der.referrals.read",     "Referrals",
            "View referrals in + out.",
            "Blocks GET on /edge-api/v1/referral/**."),
    REFERRALS_ACCEPT    ("der.referrals.accept",   "Referrals",
            "Accept an inbound referral.",
            "Blocks POST /edge-api/v1/referral/inbox/*/accept."),
    REFERRALS_DISMISS   ("der.referrals.dismiss",  "Referrals",
            "Dismiss an inbound referral.",
            "Blocks POST /edge-api/v1/referral/inbox/*/dismiss."),
    REFERRALS_ESCALATE  ("der.referrals.escalate", "Referrals",
            "Escalate an unanswered referral (routing decision).",
            "Blocks POST /edge-api/v1/journal/*/next-hop."),

    // ---- Devices ---------------------------------------------------------
    DEVICES_READ         ("der.devices.read",         "Devices",
            "View the device fleet.",
            "Blocks GET on /edge-api/v1/devices/**."),
    DEVICES_APPROVE      ("der.devices.approve",      "Devices",
            "Approve a pending device enrolment.",
            "Blocks POST /edge-api/v1/devices/*/approve."),
    DEVICES_SUSPEND      ("der.devices.suspend",      "Devices",
            "Suspend an approved device.",
            "Blocks POST /edge-api/v1/devices/*/suspend."),
    DEVICES_REVOKE       ("der.devices.revoke",       "Devices",
            "Revoke a device (permanent).",
            "Blocks POST /edge-api/v1/devices/*/revoke."),
    DEVICES_DECOMMISSION ("der.devices.decommission", "Devices",
            "Delete a device + its history.",
            "Blocks DELETE /edge-api/v1/devices/**."),

    // ---- Network ---------------------------------------------------------
    NETWORK_READ           ("der.network.read",           "Network",
            "View network topology and peers.",
            "Blocks GET on /edge-api/v1/network/**."),
    NETWORK_PEER_WRITE     ("der.network.peer.write",     "Network",
            "Edit peer definitions and adjacency.",
            "Blocks POST/PUT/DELETE on /edge-api/v1/network/peers/**."),
    NETWORK_TOPOLOGY_WRITE ("der.network.topology.write", "Network",
            "Edit routing + topology.",
            "Blocks writes on the non-firewall, non-peers network surface."),
    NETWORK_FIREWALL_WRITE ("der.network.firewall.write", "Network",
            "Edit firewall + lease rules.",
            "Blocks writes on /edge-api/v1/network/firewall/**."),

    // ---- Workflows (capture workflows, not Spring workflows) -------------
    WORKFLOWS_READ            ("der.workflows.read",            "Workflows",
            "View capture workflows + activity feed.",
            "Blocks GET on workflow metrics + activity + catalogue."),
    WORKFLOWS_RUN_OPEN        ("der.workflows.run.open",        "Workflows",
            "Open a workflow run (start a capture session).",
            "Blocks POST /edge-api/v1/workflows/*/runs."),
    WORKFLOWS_RUN_CONTRIBUTE  ("der.workflows.run.contribute",  "Workflows",
            "Contribute to an open workflow run.",
            "Blocks POST /edge-api/v1/workflows/runs/*/contribute."),
    WORKFLOWS_PUBLISH         ("der.workflows.publish",         "Workflows",
            "Publish a workflow run's output.",
            "Blocks POST /edge-api/v1/workflows/runs/*/publish."),
    WORKFLOWS_CATALOGUE_WRITE ("der.workflows.catalogue.write", "Workflows",
            "Edit the workflow catalogue (not individual runs).",
            "Blocks POST + PUT + DELETE on /edge-api/v1/workflows/**."),

    // ---- Capture (ADR-0036 data-module form API) -------------------------
    CAPTURE_READ              ("der.capture.read",              "Capture",
            "Read workflow-scoped + free-standing capture forms and prefill values.",
            "Blocks GET on /edge-api/v1/capture/**."),

    // ---- Backup + restore ------------------------------------------------
    BACKUP_READ      ("der.backup.read",     "Backup",
            "View backup runs.",
            "Blocks GET on /edge-api/v1/backup/**."),
    BACKUP_TRIGGER   ("der.backup.trigger",  "Backup",
            "Trigger a backup run.",
            "Blocks POST /edge-api/v1/backup/run."),
    BACKUP_DOWNLOAD  ("der.backup.download", "Backup",
            "Download a backup artefact.",
            "Blocks GET /edge-api/v1/backup/*/download."),
    RESTORE_EXECUTE  ("der.restore.execute", "Backup",
            "Execute a restore.",
            "Blocks POST /edge-api/v1/restore/**."),

    // ---- Audit -----------------------------------------------------------
    AUDIT_READ   ("der.audit.read",   "Audit",
            "View the security audit stream.",
            "Blocks GET on /edge-api/v1/security/audit/**."),
    AUDIT_EXPORT ("der.audit.export", "Audit",
            "Export the audit stream to file.",
            "Blocks GET /edge-api/v1/security/audit/export."),

    // ---- Compliance ------------------------------------------------------
    COMPLIANCE_READ   ("der.compliance.read",   "Compliance",
            "View compliance posture.",
            "Blocks GET on /edge-api/v1/compliance/**."),
    COMPLIANCE_MANAGE ("der.compliance.manage", "Compliance",
            "Run retention / erasure / audit-export jobs.",
            "Blocks POST on /edge-api/v1/compliance/**."),

    // ---- System ---------------------------------------------------------
    SYSTEM_READ              ("der.system.read",              "System",
            "View diagnostics + settings.",
            "Blocks GET on /edge-api/v1/system/** and /actuator/metrics."),
    SYSTEM_SETTINGS_WRITE    ("der.system.settings.write",    "System",
            "Edit settings + feature flags + org-unit binding.",
            "Blocks /admin/ops/** and the settings + org-unit writes."),
    SYSTEM_ANALYTICS_REFRESH ("der.system.analytics.refresh", "System",
            "Refresh analytics materialised views.",
            "Blocks POST /edge-api/v1/analytics/refresh."),
    SYSTEM_HARDWARE_WRITE    ("der.system.hardware.write",    "System",
            "Write to hardware (LEDs, fan, etc.).",
            "Blocks POST on /edge-api/v1/system/hardware/**."),
    SYSTEM_VAULT_READ        ("der.system.vault.read",        "System",
            "Read the security-hardening vault.",
            "Blocks GET /edge-api/v1/security/hardening/vault/**."),
    SYSTEM_TESTING_RUN       ("der.system.testing.run",       "System",
            "Run chaos / fault-injection harness.",
            "Blocks /edge-api/v1/testing/**."),
    SYSTEM_DECOMMISSION      ("der.system.decommission",      "System",
            "Decommission the edge (irreversible).",
            "Blocks POST /edge-api/v1/admin/ops/decommission.");

    private final String authority;
    private final String module;
    private final String allows;
    private final String restricts;

    AuthorityCatalog(final String authority, final String module,
                     final String allows, final String restricts) {
        this.authority = Objects.requireNonNull(authority, "authority");
        this.module = Objects.requireNonNull(module, "module");
        this.allows = Objects.requireNonNull(allows, "allows");
        this.restricts = Objects.requireNonNull(restricts, "restricts");
    }

    public String authority() {
        return authority;
    }

    public String module() {
        return module;
    }

    /** Short prose describing what a role holding this authority is allowed to do. */
    public String allows() {
        return allows;
    }

    /** Short prose describing what the absence of this authority blocks (enforcement). */
    public String restricts() {
        return restricts;
    }

    /** @deprecated Use {@link #allows()}; kept for binary compatibility with
     *  older callers that treated the single description field as "allows". */
    @Deprecated(forRemoval = false)
    public String description() {
        return allows;
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
