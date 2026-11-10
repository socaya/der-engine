/**
 * Single-source navigation registry.
 *
 * Phase UI-2 reshaped this file from 10 modules / 91 items down to
 * 8 modules / ~45 items, with plain-language labels in place of the
 * ad-hoc nicknames operators were confused by ("Compat", "Attention",
 * "Hash chain", "Drift inspector", "Workspace", etc.) See
 * docs/ui/ui2-rename-map.md for the full before→after table.
 *
 * Layout:
 *   The sidebar renders a flat list of ~8 primary items with an SVG
 *   icon per item. Each primary item anchors the group's secondary
 *   routes which show in the SectionTabs strip above the main
 *   content whenever a route in that group is active.
 *
 * `status`:
 *   - 'implemented' — route serves a real screen backed by a
 *     verified server endpoint.
 *   - 'capability-gap' — spec'd but not wired yet (shown greyed).
 *   - 'contextual' — not shown in sidebar/tabs; reachable only via
 *     drill-down from another screen or direct URL.
 */

export type ScreenStatus = 'implemented' | 'capability-gap' | 'contextual';

export type TabIconId =
  | 'overview' | 'metadata' | 'data-queue' | 'attention' | 'worker'
  | 'schedule' | 'history' | 'settings' | 'drift' | 'health'
  | 'storage' | 'diagnostics' | 'analytics' | 'evaluation'
  | 'audit' | 'backup' | 'restore' | 'recovery'
  | 'wifi' | 'access-point' | 'ethernet' | 'firewall' | 'peer' | 'tei' | 'activity' | 'route'
  | 'aggregate' | 'event' | 'edit' | 'referral' | 'cog'
  | 'laptop' | 'tablet';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly status: ScreenStatus;
  readonly tabIcon?: TabIconId;
  readonly crumb?: string;
}

export type IconId =
  | 'grid' | 'plug' | 'sync' | 'workflow'
  | 'database' | 'users' | 'device' | 'chart'
  | 'shield' | 'cog' | 'wifi';

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly primaryId: string;
  readonly icon: IconId;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  /* ──────────────────────────────────────────────────────────────── */
  /* 1. Home — landing page + admin tasks + system-level info.       */
  /* Replaces the old "Overview / Workspace" top-level.              */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'home',
    label: 'Home',
    primaryId: 'home',
    icon: 'grid',
    items: [
      { id: 'home', label: 'Home', to: '/', status: 'implemented' },
      { id: 'admin-tasks', label: 'Admin tasks', to: '/admin-tasks', status: 'contextual' },
      { id: 'system-info', label: 'System info', to: '/system/information', status: 'contextual' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 2. Data — everything the capture apps wrote.                     */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'data',
    label: 'Data',
    primaryId: 'data-overview',
    icon: 'database',
    items: [
      { id: 'data-overview', label: 'Overview', to: '/data', status: 'implemented', tabIcon: 'overview' },
      { id: 'aggregate',     label: 'Aggregate', to: '/data/aggregate', status: 'implemented', tabIcon: 'aggregate' },
      { id: 'events',        label: 'Events', to: '/data/events', status: 'implemented', tabIcon: 'event' },
      { id: 'tracker',       label: 'Tracker', to: '/data/tracker', status: 'implemented', tabIcon: 'tei' },
      { id: 'data-queue',    label: 'Outbound queue', to: '/data/queue', status: 'implemented', tabIcon: 'data-queue' },
      { id: 'drafts',        label: 'Drafts', to: '/data/drafts', status: 'implemented', tabIcon: 'edit' },
      { id: 'referral-inbox', label: 'Referrals', to: '/referral/inbox', status: 'contextual', tabIcon: 'referral' },
      { id: 'referral-history', label: 'Referral history', to: '/referral/history', status: 'contextual', tabIcon: 'history' },
      { id: 'maintenance',   label: 'Maintenance', to: '/data/maintenance', status: 'implemented', tabIcon: 'cog' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 3. Sync — the sync engine surface.                               */
  /*   "Attention" renamed to "Needs review" (plain language).        */
  /*   "Sync Worker" → "Worker".                                      */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'sync',
    label: 'Sync',
    primaryId: 'sync-overview',
    icon: 'sync',
    items: [
      { id: 'sync-overview',  label: 'Overview', to: '/sync', status: 'implemented', tabIcon: 'overview' },
      { id: 'sync-attention', label: 'Needs review', to: '/sync/attention', status: 'implemented', tabIcon: 'attention' },
      { id: 'sync-worker',    label: 'Worker', to: '/sync/worker', status: 'implemented', tabIcon: 'worker' },
      { id: 'sync-policy',    label: 'Policy', to: '/sync/policy', status: 'implemented', tabIcon: 'settings' },
      { id: 'sync-schedule',  label: 'Schedule', to: '/sync/schedule', status: 'implemented', tabIcon: 'schedule' },
      { id: 'sync-history',   label: 'History', to: '/sync/history', status: 'implemented', tabIcon: 'history' },
      { id: 'sync-settings',  label: 'Settings', to: '/sync/settings', status: 'implemented', tabIcon: 'settings' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 4. DHIS2 — integration + metadata concerns.                      */
  /*   "Compat" → "Compatibility check" (no abbrev).                  */
  /*   "Metadata drift" → "Metadata changes".                         */
  /*   "Metadata sync" stays (verb+noun is clear here).               */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'dhis2',
    label: 'DHIS2',
    primaryId: 'dhis2-overview',
    icon: 'plug',
    items: [
      { id: 'dhis2-overview', label: 'Overview', to: '/dhis2', status: 'implemented', tabIcon: 'overview' },
      { id: 'metadata-mirror', label: 'Metadata catalogue', to: '/dhis2/metadata', status: 'implemented', tabIcon: 'metadata' },
      { id: 'metadata-snapshots', label: 'Snapshots', to: '/metadata/snapshots', status: 'implemented' },
      { id: 'drift', label: 'Metadata changes', to: '/dhis2/metadata-drift', status: 'contextual', tabIcon: 'drift' },
      { id: 'metadata-sync', label: 'Metadata sync', to: '/dhis2/metadata-sync', status: 'contextual' },
      { id: 'compat', label: 'Compatibility check', to: '/dhis2/compat', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'ou-binding', label: 'Organisation unit', to: '/dhis2/organisation-unit', status: 'implemented', tabIcon: 'health' },
      { id: 'central-conn', label: 'Connection', to: '/dhis2/connection', status: 'contextual' },
      { id: 'rel-type-aliases', label: 'Relationship aliases', to: '/dhis2/relationship-types', status: 'implemented', tabIcon: 'metadata' },
      { id: 'composite-kinds', label: 'Composite kinds', to: '/dhis2/composite-kinds', status: 'implemented', tabIcon: 'metadata' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 5. Devices — unified fleet + LAN mesh + network ops.             */
  /*   UI-1 landed /devices as the single-truth device view;         */
  /*   remaining Network items live here so "all the hardware"       */
  /*   is one module.                                                 */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'devices',
    label: 'Devices',
    primaryId: 'devices',
    icon: 'device',
    items: [
      { id: 'devices',          label: 'Devices', to: '/devices', status: 'implemented', tabIcon: 'tablet' },
      { id: 'network-ap',       label: 'Access point', to: '/network/access-point', status: 'implemented', tabIcon: 'access-point' },
      { id: 'network-interfaces', label: 'Interfaces', to: '/network/interfaces', status: 'implemented', tabIcon: 'ethernet' },
      { id: 'network-peers',    label: 'Peers', to: '/network/peers', status: 'implemented', tabIcon: 'peer' },
      { id: 'network-mesh',     label: 'Mesh topology', to: '/network/mesh', status: 'implemented', tabIcon: 'route' },
      { id: 'network-messaging', label: 'Device messaging', to: '/network/messaging', status: 'implemented', tabIcon: 'activity' },
      { id: 'network-security', label: 'Network security', to: '/network/security', status: 'implemented', tabIcon: 'firewall' },
      { id: 'network-diagnostics', label: 'Network diagnostics', to: '/network/diagnostics', status: 'implemented', tabIcon: 'diagnostics' },
      /* Contextual drills — kept as routes but not in sidebar strip. */
      { id: 'network-overview', label: 'Network overview', to: '/network', status: 'contextual' },
      { id: 'network-settings', label: 'Network settings', to: '/network/settings', status: 'contextual' },
      { id: 'enrolment',        label: 'Device enrolment', to: '/devices/enrolment', status: 'contextual' },
      { id: 'device-diag',      label: 'Device diagnostics', to: '/devices/diagnostics', status: 'contextual' },
      { id: 'ownership',        label: 'Ownership', to: '/devices/ownership', status: 'contextual' },
      { id: 'connections',      label: 'Connections', to: '/devices/connections', status: 'contextual' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 6. Access — users, roles, authorities, security audit.           */
  /*   Pulled the audit trail into Access so "who did what" lives     */
  /*   one click from "who are our users".                            */
  /*   "Hash chain" renamed to "Audit integrity".                     */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'access',
    label: 'Access',
    primaryId: 'users',
    icon: 'users',
    items: [
      { id: 'users',       label: 'Users', to: '/provisioning/users', status: 'implemented', tabIcon: 'laptop' },
      { id: 'roles',       label: 'Roles', to: '/access/roles', status: 'implemented', tabIcon: 'worker' },
      { id: 'authorities', label: 'Authorities', to: '/access/authorities', status: 'implemented', tabIcon: 'audit' },
      { id: 'audit-trail', label: 'Audit log', to: '/audit/trail', status: 'implemented', tabIcon: 'audit' },
      { id: 'audit-verify', label: 'Audit integrity', to: '/audit/verify', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'security-events', label: 'Security events', to: '/audit/events', status: 'implemented', tabIcon: 'attention' },
      /* Contextual drills — direct-URL + detail-screen nav only. */
      { id: 'users-new',   label: 'Add user', to: '/provisioning/users/new', status: 'contextual' },
      { id: 'mappings',    label: 'DHIS2 mappings', to: '/access/mappings', status: 'contextual' },
      { id: 'sessions',    label: 'Sessions', to: '/access/sessions', status: 'contextual' },
      { id: 'credentials', label: 'Credentials', to: '/access/credentials', status: 'contextual' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 7. Workflows — capture workflow definitions + oversight.         */
  /*   "Workflow sharing" is still in Devices (peer-to-peer surface); */
  /*   kept as contextual here so bookmarks resolve.                  */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'workflows',
    label: 'Workflows',
    primaryId: 'workflow-activity',
    icon: 'workflow',
    items: [
      { id: 'workflow-activity',   label: 'Activity',    to: '/workflows',             status: 'implemented', tabIcon: 'overview' },
      { id: 'workflows-manage',    label: 'Designer',    to: '/workflows/manage',      status: 'implemented', tabIcon: 'metadata' },
      { id: 'workflow-monitoring', label: 'Monitoring',  to: '/workflows/monitoring',  status: 'implemented', tabIcon: 'analytics' },
      { id: 'workflow-sharing',    label: 'Peer sharing', to: '/network/workflow-sharing', status: 'implemented', tabIcon: 'metadata' },
      /* Contextual drills. */
      { id: 'peer-exchange',       label: 'Peer exchange', to: '/workflows/peer-exchange', status: 'contextual' },
      { id: 'queue',               label: 'My queue', to: '/workflows/queue', status: 'contextual' },
      { id: 'peers',               label: 'Peers', to: '/workflows/peers', status: 'contextual' },
      { id: 'import-inbox',        label: 'Import inbox', to: '/workflows/import-inbox', status: 'contextual' },
      { id: 'approvals',           label: 'Approvals', to: '/approvals', status: 'contextual' },
      { id: 'runs',                label: 'Runs', to: '/workflows/runs', status: 'contextual' },
      { id: 'assignments',         label: 'Assignments', to: '/workflows/assignments', status: 'contextual' },
    ],
  },
  /* ──────────────────────────────────────────────────────────────── */
  /* 8. System — infra ops: health, settings, backup, diagnostics.    */
  /*   "Metrics" → "System metrics" to disambig from Access operators.*/
  /*   "Hardware" → "Host hardware" to disambig from Devices.         */
  /*   "Analytics" removed from sidebar (contextual) — the analytics  */
  /*   screen was duplicating what Data/Overview already shows.       */
  /* ──────────────────────────────────────────────────────────────── */
  {
    id: 'system',
    label: 'System',
    primaryId: 'health',
    icon: 'chart',
    items: [
      /* UI-7 — six primary items so the nav strip fits on one row.
       * Health rolls up Metrics / Storage / Host hardware via the
       * HealthTabBar; Backup rolls up Restore / Recovery via the
       * BackupTabBar. Both tab bars render at the top of each sub-
       * screen so operators discover the full set from any entry
       * point. */
      { id: 'health',         label: 'Health', to: '/monitoring/health', status: 'implemented', tabIcon: 'health' },
      { id: 'backup',         label: 'Backup', to: '/backup', status: 'implemented', tabIcon: 'backup' },
      { id: 'settings',       label: 'Settings', to: '/settings', status: 'implemented', tabIcon: 'settings' },
      { id: 'apps',           label: 'Apps', to: '/apps', status: 'implemented', crumb: 'Apps' },
      { id: 'diagnostics',    label: 'Diagnostics', to: '/diagnostics', status: 'implemented', tabIcon: 'diagnostics' },
      { id: 'compliance',     label: 'Compliance', to: '/compliance', status: 'implemented', tabIcon: 'audit' },
      /* Contextual — reached via the tab-bars or drill-downs, not
       * the SectionTabs strip. */
      { id: 'metrics',        label: 'System metrics', to: '/monitoring/metrics', status: 'contextual', tabIcon: 'analytics' },
      { id: 'storage',        label: 'Storage', to: '/monitoring/storage', status: 'contextual', tabIcon: 'storage' },
      { id: 'hardware',       label: 'Host hardware', to: '/system/hardware', status: 'contextual', tabIcon: 'storage' },
      { id: 'restore',        label: 'Restore', to: '/restore', status: 'contextual', tabIcon: 'restore' },
      { id: 'recovery',       label: 'Recovery', to: '/recovery', status: 'contextual', tabIcon: 'recovery' },
      { id: 'metrics-operators', label: 'Capture operators', to: '/admin/metrics/operators', status: 'contextual', tabIcon: 'activity' },
      { id: 'reldiag',        label: 'Tracker diagnostics', to: '/diagnostics/relationships', status: 'contextual', tabIcon: 'diagnostics' },
      { id: 'analytics',      label: 'Analytics', to: '/analytics', status: 'contextual' },
      { id: 'evaluation',     label: 'Evaluation', to: '/evaluation', status: 'contextual' },
      { id: 'testing',        label: 'Testing', to: '/testing', status: 'contextual' },
      { id: 'packaging',      label: 'Packaging', to: '/packaging', status: 'contextual' },
      { id: 'provisioning',   label: 'Provisioning', to: '/setup', status: 'contextual' },
      { id: 'releases',       label: 'Releases', to: '/settings/releases', status: 'contextual' },
      { id: 'network',        label: 'Networking', to: '/settings/network', status: 'contextual' },
      { id: 'login-appearance', label: 'Login page', to: '/settings/login', status: 'contextual' },
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
