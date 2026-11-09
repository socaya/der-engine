/**
 * Single-source navigation registry per docs/media/ui/.
 *
 * Layout (matching the DER mockups):
 *   The sidebar renders a FLAT list of ~10 primary items with an SVG
 *   icon per item — no all-caps section headers. Each primary item
 *   maps to one of the 10 nav groups in the DER_ADMIN_UI_NAVIGATION
 *   spec and anchors the section's secondary routes.
 *
 *   Secondary items are reached through the `SectionTabs` strip that
 *   renders above the main content whenever a route in that group is
 *   active, so all 44 routes stay navigable.
 *
 * `status`:
 *   - 'implemented' — route serves a real screen backed by a verified
 *     server endpoint.
 *   - 'capability-gap' — route in spec, not wired to a verified
 *     server endpoint (shown greyed; no routes currently use this).
 *   - 'contextual' — not shown in sidebar or tabs; reachable only via
 *     contextual actions on another screen (e.g. "Add user").
 */

export type ScreenStatus = 'implemented' | 'capability-gap' | 'contextual';

export type TabIconId =
  | 'overview' | 'metadata' | 'data-queue' | 'attention' | 'worker'
  | 'schedule' | 'history' | 'settings' | 'drift' | 'health'
  | 'storage' | 'diagnostics' | 'analytics' | 'evaluation'
  | 'audit' | 'backup' | 'restore' | 'recovery'
  | 'wifi' | 'access-point' | 'ethernet' | 'firewall' | 'peer' | 'tei' | 'activity' | 'route'
  // §2.3.119 R-AP — Data sub-tabs
  | 'aggregate' | 'event' | 'edit' | 'referral' | 'cog'
  // Administration sub-tabs
  | 'laptop' | 'tablet';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly status: ScreenStatus;
  /** Icon rendered inside the Section Tabs strip. */
  readonly tabIcon?: TabIconId;
  /** Breadcrumb label when the route is reached. */
  readonly crumb?: string;
}

export type IconId =
  | 'grid' | 'plug' | 'sync' | 'workflow'
  | 'database' | 'users' | 'device' | 'chart'
  | 'shield' | 'cog' | 'wifi';

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  /** id of the primary item inside this group — anchors the sidebar entry. */
  readonly primaryId: string;
  readonly icon: IconId;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  /* UI Visibility 10/10 §28 Information Architecture — 9 logical domains. */
  {
    id: 'workspace',
    label: 'Overview',
    primaryId: 'workspace',
    icon: 'grid',
    items: [
      { id: 'workspace', label: 'Overview', to: '/', status: 'implemented' },
      { id: 'system-info', label: 'System info', to: '/system/information', status: 'contextual' },
      { id: 'admin-tasks', label: 'Admin tasks', to: '/admin-tasks', status: 'contextual' },
    ],
  },
  {
    id: 'integration',
    label: 'DHIS2',
    primaryId: 'dhis2-overview',
    icon: 'plug',
    items: [
      { id: 'dhis2-overview', label: 'Overview', to: '/dhis2', status: 'implemented', tabIcon: 'overview' },
      { id: 'central-conn', label: 'Connection', to: '/dhis2/connection', status: 'contextual' },
      { id: 'ou-binding', label: 'Organisation unit', to: '/dhis2/organisation-unit', status: 'implemented', tabIcon: 'health' },
      { id: 'compat', label: 'Compatibility', to: '/dhis2/compat', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'metadata-mirror', label: 'Metadata', to: '/dhis2/metadata', status: 'implemented', tabIcon: 'metadata' },
      { id: 'metadata-snapshots', label: 'Snapshots', to: '/metadata/snapshots', status: 'implemented' },
      { id: 'drift', label: 'Metadata drift', to: '/dhis2/metadata-drift', status: 'contextual' },
      { id: 'metadata-sync', label: 'Metadata sync', to: '/dhis2/metadata-sync', status: 'contextual' },
      { id: 'rel-type-aliases', label: 'Relationship aliases',
        to: '/dhis2/relationship-types',
        status: 'implemented', tabIcon: 'metadata' },
    ],
  },
  {
    id: 'sync',
    label: 'Synchronisation',
    primaryId: 'sync-overview',
    icon: 'sync',
    items: [
      /* §9.2 operator terminology */
      { id: 'sync-overview', label: 'Overview', to: '/sync', status: 'implemented', tabIcon: 'overview' },
      /* §2.3.117 R-AN — Metadata Sync moved under DHIS2 Integration
       * group (/dhis2/metadata-sync). The /sync/metadata route still
       * works but redirects to the canonical path. */
      /* §2.3.106 R-AA — Data Queue moved to the Data group where
       * operators look for data records. /sync/data redirects to
       * /data/queue. */
      { id: 'sync-attention', label: 'Attention', to: '/sync/attention', status: 'implemented', tabIcon: 'attention' },
      { id: 'sync-worker', label: 'Sync Worker', to: '/sync/worker', status: 'implemented', tabIcon: 'worker' },
      { id: 'sync-schedule', label: 'Schedule', to: '/sync/schedule', status: 'implemented', tabIcon: 'schedule' },
      { id: 'sync-history', label: 'History', to: '/sync/history', status: 'implemented', tabIcon: 'history' },
      { id: 'sync-settings', label: 'Settings', to: '/sync/settings', status: 'implemented', tabIcon: 'settings' },
      /* Legacy routes retained for existing bookmarks; not shown in sidebar. */
      { id: 'sync-jobs', label: 'Jobs', to: '/sync/jobs', status: 'contextual' },
      { id: 'sync-queues-legacy', label: 'Queues', to: '/sync/queues', status: 'contextual' },
      { id: 'conflicts-legacy', label: 'Conflicts', to: '/journal/conflicts', status: 'contextual' },
      { id: 'worker-legacy', label: 'Worker health', to: '/journal/worker', status: 'contextual' },
    ],
  },
  /* Network module per docs/requirements/DER_Network_Module_Design_Specification.md §24. */
  {
    id: 'network',
    label: 'Network',
    primaryId: 'network-overview',
    icon: 'wifi',
    items: [
      { id: 'network-overview', label: 'Overview', to: '/network', status: 'implemented', tabIcon: 'overview' },
      { id: 'network-ap', label: 'Access Point', to: '/network/access-point', status: 'implemented', tabIcon: 'access-point' },
      { id: 'network-clients', label: 'Connected Devices', to: '/network/clients', status: 'implemented', tabIcon: 'tei' },
      { id: 'network-interfaces', label: 'Interfaces', to: '/network/interfaces', status: 'implemented', tabIcon: 'ethernet' },
      { id: 'network-peers', label: 'Peers', to: '/network/peers', status: 'implemented', tabIcon: 'peer' },
      /* Workflow-definition sharing between DER edges — fleet-admin
       * concern surfaced here (ADR §2.3.59) because it's independent
       * of the workflow runtime and sits naturally next to transport-
       * level peer management. */
      { id: 'workflow-sharing', label: 'Workflow sharing', to: '/network/workflow-sharing', status: 'implemented', tabIcon: 'metadata' },
      { id: 'network-mesh', label: 'Mesh topology', to: '/network/mesh', status: 'implemented', tabIcon: 'route' },
      { id: 'network-fleet', label: 'Fleet', to: '/fleet', status: 'implemented', tabIcon: 'peer' },
      { id: 'network-security', label: 'Security', to: '/network/security', status: 'implemented', tabIcon: 'firewall' },
      { id: 'network-diagnostics', label: 'Diagnostics', to: '/network/diagnostics', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'network-messaging', label: 'Device messaging', to: '/network/messaging', status: 'implemented', tabIcon: 'activity' },
      { id: 'network-settings', label: 'Settings', to: '/network/settings', status: 'implemented', tabIcon: 'settings' },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    /* der-2.3.58 scope cleanup: the admin UI is for configuration +
     * oversight. Operator surfaces (My queue, Approvals, Referrals)
     * live on the device-side client UI and are only reachable as
     * contextual drill-down routes from the Activity dashboard. */
    primaryId: 'workflow-activity',
    icon: 'workflow',
    items: [
      { id: 'workflow-activity',   label: 'Activity overview',   to: '/workflows',                 status: 'implemented', tabIcon: 'overview' },
      { id: 'workflows-manage',    label: 'Workflow management', to: '/workflows/manage',          status: 'implemented', tabIcon: 'metadata' },
      { id: 'workflow-monitoring', label: 'Monitoring',          to: '/workflows/monitoring',      status: 'implemented', tabIcon: 'analytics' },
      /* Peer exchange moved out of Workflows (ADR §2.3.59):
       * Workflows is transport-agnostic. Sharing workflow definitions
       * between edges is a fleet-admin concern surfaced under Network
       * alongside the WireGuard peers list. Route kept alive here as
       * contextual for existing bookmarks. */
      { id: 'peer-exchange',       label: 'Peer exchange',       to: '/workflows/peer-exchange',   status: 'contextual' },
      /* Operator-work routes kept alive for drill-down from the
       * Activity overview + external bookmarks. Not shown in sidebar. */
      { id: 'queue',               label: 'My queue',            to: '/workflows/queue',           status: 'contextual' },
      { id: 'peers',               label: 'Peers',               to: '/workflows/peers',           status: 'contextual' },
      { id: 'import-inbox',        label: 'Import inbox',        to: '/workflows/import-inbox',    status: 'contextual' },
      { id: 'approvals',           label: 'Approvals',           to: '/approvals',                 status: 'contextual' },
      { id: 'runs',                label: 'Runs',                to: '/workflows/runs',            status: 'contextual' },
      { id: 'assignments',         label: 'Assignments',         to: '/workflows/assignments',     status: 'contextual' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    primaryId: 'data-overview',
    icon: 'database',
    items: [
      /* §2.3.119 R-AP — every Data sub-tab now carries a DER glyph
       * so the sub-nav strip reads as a visual legend rather than
       * labels only. Icons match the entity vocabulary used across
       * the Data detail screens. */
      { id: 'data-overview', label: 'Overview', to: '/data', status: 'implemented', tabIcon: 'overview' },
      { id: 'aggregate', label: 'Aggregate', to: '/data/aggregate', status: 'implemented', tabIcon: 'aggregate' },
      { id: 'events', label: 'Events', to: '/data/events', status: 'implemented', tabIcon: 'event' },
      { id: 'tracker', label: 'Tracker', to: '/data/tracker', status: 'implemented', tabIcon: 'tei' },
      /* §2.3.106 R-AA — the outbound queue is still data; it just
       * shows per-row sync state alongside the record. Lives here
       * rather than under Sync. */
      { id: 'data-queue', label: 'Queue', to: '/data/queue', status: 'implemented', tabIcon: 'data-queue' },
      { id: 'drafts', label: 'Drafts', to: '/data/drafts', status: 'implemented', tabIcon: 'edit' },
      /* Referrals are patient data flowing between facilities (DHIS2
       * Tracker relationship pattern, ADR-0027) — belongs with
       * Tracker data, not with workflow definitions. */
      { id: 'referral-inbox', label: 'Referrals', to: '/referral/inbox', status: 'contextual', tabIcon: 'referral' },
      { id: 'referral-history', label: 'Referral history', to: '/referral/history', status: 'contextual', tabIcon: 'history' },
      { id: 'maintenance', label: 'Maintenance', to: '/data/maintenance', status: 'implemented', tabIcon: 'cog' },
    ],
  },
  /* Administration — merges Users + Devices + DHIS2 mappings per §28. */
  {
    id: 'access',
    label: 'Administration',
    primaryId: 'users',
    icon: 'users',
    items: [
      /* Permissions-first ordering: Authorities are the atomic capabilities,
       * Roles bundle authorities, Users are assigned roles.  Devices is
       * the only other first-class sub-module — everything user-adjacent
       * (DHIS2 mappings, Sessions, Credentials) surfaces from Users;
       * everything device-adjacent (Device enrolment, Device diagnostics,
       * Ownership, Connections) surfaces from Devices. */
      { id: 'authorities', label: 'Authorities', to: '/access/authorities', status: 'implemented', tabIcon: 'audit' },
      { id: 'roles', label: 'Roles', to: '/access/roles', status: 'implemented', tabIcon: 'worker' },
      { id: 'users', label: 'Users', to: '/provisioning/users', status: 'implemented', tabIcon: 'laptop' },
      { id: 'devices', label: 'Devices', to: '/devices', status: 'implemented', tabIcon: 'tablet' },
      /* Contextual drills — kept as routes so direct URLs work but
       * hidden from the Administration SectionTabs strip; reached from
       * the Users / Devices dashboards. */
      { id: 'users-new', label: 'Add user', to: '/provisioning/users/new', status: 'contextual' },
      { id: 'mappings', label: 'DHIS2 mappings', to: '/access/mappings', status: 'contextual' },
      { id: 'sessions', label: 'Sessions', to: '/access/sessions', status: 'contextual' },
      { id: 'credentials', label: 'Credentials', to: '/access/credentials', status: 'contextual' },
      { id: 'enrolment', label: 'Device enrolment', to: '/devices/enrolment', status: 'contextual' },
      { id: 'device-diag', label: 'Device diagnostics', to: '/devices/diagnostics', status: 'contextual' },
      { id: 'ownership', label: 'Ownership', to: '/devices/ownership', status: 'contextual' },
      { id: 'connections', label: 'Connections', to: '/devices/connections', status: 'contextual' },
    ],
  },
  /* System — renamed from Monitoring per §28. Internals live here, not Overview. */
  {
    id: 'monitoring',
    label: 'System',
    primaryId: 'health',
    icon: 'chart',
    items: [
      { id: 'health', label: 'Health', to: '/monitoring/health', status: 'implemented', tabIcon: 'health' },
      { id: 'hardware', label: 'Hardware', to: '/system/hardware', status: 'implemented', tabIcon: 'storage' },
      { id: 'metrics', label: 'Metrics', to: '/monitoring/metrics', status: 'implemented', tabIcon: 'analytics' },
      { id: 'metrics-operators', label: 'Operators', to: '/admin/metrics/operators', status: 'implemented', tabIcon: 'activity' },
      { id: 'storage', label: 'Storage', to: '/monitoring/storage', status: 'implemented', tabIcon: 'storage' },
      { id: 'diagnostics', label: 'Diagnostics', to: '/diagnostics', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'reldiag', label: 'Relationships', to: '/diagnostics/relationships',
        status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'analytics', label: 'Analytics', to: '/analytics', status: 'implemented', tabIcon: 'analytics' },
      { id: 'evaluation', label: 'Evaluation', to: '/evaluation', status: 'implemented', tabIcon: 'evaluation' },
      { id: 'testing', label: 'Testing', to: '/testing', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'packaging', label: 'Packaging', to: '/packaging', status: 'implemented', tabIcon: 'storage' },
      /* Alerts moved to Security & Audit → Security events. */
      { id: 'activity', label: 'Alerts', to: '/audit/events', status: 'contextual' },
    ],
  },
  /* Security & Audit — renamed per §28. */
  {
    id: 'security',
    label: 'Security & Audit',
    primaryId: 'audit-verify',
    icon: 'shield',
    items: [
      { id: 'audit-trail', label: 'Audit trail', to: '/audit/trail', status: 'implemented', tabIcon: 'audit' },
      { id: 'audit-verify', label: 'Hash chain', to: '/audit/verify', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'security-events', label: 'Security events', to: '/audit/events', status: 'implemented', tabIcon: 'attention' },
      { id: 'compliance', label: 'Compliance', to: '/compliance', status: 'implemented', tabIcon: 'audit' },
      { id: 'backup', label: 'Backup', to: '/backup', status: 'implemented', tabIcon: 'backup' },
      { id: 'restore', label: 'Restore', to: '/restore', status: 'implemented', tabIcon: 'restore' },
      { id: 'recovery', label: 'Recovery', to: '/recovery', status: 'implemented', tabIcon: 'recovery' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    primaryId: 'settings',
    icon: 'cog',
    items: [
      { id: 'settings', label: 'General', to: '/settings', status: 'implemented' },
      { id: 'provisioning', label: 'Provisioning', to: '/setup', status: 'implemented' },
      { id: 'apps', label: 'Apps', to: '/apps',
        status: 'implemented', crumb: 'Apps' },
      { id: 'releases', label: 'Releases', to: '/settings/releases', status: 'implemented' },
      { id: 'network', label: 'Network', to: '/settings/network', status: 'implemented' },
      { id: 'login-appearance', label: 'Login page', to: '/settings/login',
        status: 'implemented', tabIcon: 'settings',
        crumb: 'Login appearance' },
    ],
  },
];

/** Pure helper — find the group a route belongs to. Returns null if none. */
export function groupForRoute(pathname: string): NavGroup | null {
  let best: { grp: NavGroup; len: number } | null = null;
  for (const grp of NAV_GROUPS) {
    for (const item of grp.items) {
      if (item.status === 'contextual') continue;
      if (item.to === '/' && pathname === '/') {
        if (!best || best.len < 1) best = { grp, len: 1 };
      } else if (item.to !== '/' && (pathname === item.to || pathname.startsWith(item.to + '/'))) {
        if (!best || item.to.length > best.len) best = { grp, len: item.to.length };
      }
    }
  }
  return best?.grp ?? null;
}

/** Pure helper — find the group that a nav item id belongs to. */
export function groupForItemId(id: string): NavGroup | null {
  for (const grp of NAV_GROUPS) {
    if (grp.items.some((it) => it.id === id)) return grp;
  }
  return null;
}
