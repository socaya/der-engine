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

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  readonly status: ScreenStatus;
  /** Breadcrumb label when the route is reached. */
  readonly crumb?: string;
}

export type IconId =
  | 'grid' | 'plug' | 'sync' | 'workflow'
  | 'database' | 'users' | 'device' | 'chart'
  | 'shield' | 'cog';

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  /** id of the primary item inside this group — anchors the sidebar entry. */
  readonly primaryId: string;
  readonly icon: IconId;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    primaryId: 'workspace',
    icon: 'grid',
    items: [
      { id: 'workspace', label: 'Workspace', to: '/', status: 'implemented' },
      { id: 'system-info', label: 'System info', to: '/system/information', status: 'implemented' },
      { id: 'admin-tasks', label: 'Admin tasks', to: '/admin-tasks', status: 'implemented' },
    ],
  },
  {
    id: 'integration',
    label: 'DHIS2',
    primaryId: 'dhis2-overview',
    icon: 'plug',
    items: [
      { id: 'dhis2-overview', label: 'Overview', to: '/dhis2', status: 'implemented' },
      { id: 'central-conn', label: 'Connection', to: '/dhis2/connection', status: 'implemented' },
      { id: 'ou-binding', label: 'Organisation unit', to: '/dhis2/organisation-unit', status: 'implemented' },
      { id: 'compat', label: 'Compatibility', to: '/dhis2/compat', status: 'implemented' },
      { id: 'metadata-mirror', label: 'Metadata browser', to: '/dhis2/metadata', status: 'implemented' },
      { id: 'drift', label: 'Metadata drift', to: '/dhis2/metadata-drift', status: 'implemented' },
      { id: 'program-rules', label: 'Program rules', to: '/dhis2/program-rules', status: 'implemented' },
      { id: 'metadata-sync', label: 'Metadata sync', to: '/dhis2/metadata-sync', status: 'implemented' },
    ],
  },
  {
    id: 'sync',
    label: 'Sync',
    primaryId: 'sync-overview',
    icon: 'sync',
    items: [
      { id: 'sync-overview', label: 'Overview', to: '/sync', status: 'implemented' },
      { id: 'sync-jobs', label: 'Jobs', to: '/sync/jobs', status: 'implemented' },
      { id: 'sync-history', label: 'History', to: '/sync/history', status: 'implemented' },
      { id: 'queues', label: 'Queues', to: '/sync/queues', status: 'implemented' },
      { id: 'conflicts', label: 'Conflicts', to: '/journal/conflicts', status: 'implemented' },
      { id: 'worker', label: 'Worker health', to: '/journal/worker', status: 'implemented' },
      { id: 'sync-metadata', label: 'Metadata sync', to: '/sync/metadata', status: 'implemented' },
      { id: 'data-exchange', label: 'Data exchange', to: '/sync/data', status: 'implemented' },
      { id: 'sync-schedule', label: 'Schedule', to: '/sync/schedule', status: 'implemented' },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows',
    primaryId: 'workflows',
    icon: 'workflow',
    items: [
      { id: 'workflows', label: 'Workflows', to: '/workflows', status: 'implemented' },
      { id: 'runs', label: 'Runs', to: '/workflows/runs', status: 'implemented' },
      { id: 'assignments', label: 'Assignments', to: '/workflows/assignments', status: 'implemented' },
      { id: 'approvals', label: 'Approvals', to: '/approvals', status: 'implemented' },
      { id: 'referral-inbox', label: 'Referrals', to: '/referral/inbox', status: 'implemented' },
      { id: 'referral-history', label: 'Referral history', to: '/referral/history', status: 'implemented' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    primaryId: 'data-overview',
    icon: 'database',
    items: [
      { id: 'data-overview', label: 'Overview', to: '/data', status: 'implemented' },
      { id: 'aggregate', label: 'Aggregate', to: '/data/aggregate', status: 'implemented' },
      { id: 'events', label: 'Events', to: '/data/events', status: 'implemented' },
      { id: 'tracker', label: 'Tracker', to: '/data/tracker', status: 'implemented' },
      { id: 'drafts', label: 'Drafts', to: '/data/drafts', status: 'implemented' },
      { id: 'maintenance', label: 'Maintenance', to: '/data/maintenance', status: 'implemented' },
    ],
  },
  {
    id: 'access',
    label: 'Users',
    primaryId: 'users',
    icon: 'users',
    items: [
      { id: 'users', label: 'Users', to: '/provisioning/users', status: 'implemented' },
      { id: 'users-new', label: 'Add user', to: '/provisioning/users/new', status: 'contextual' },
      { id: 'mappings', label: 'DHIS2 mapping', to: '/access/mappings', status: 'implemented' },
      { id: 'roles', label: 'Roles', to: '/access/roles', status: 'implemented' },
      { id: 'sessions', label: 'Sessions', to: '/access/sessions', status: 'implemented' },
      { id: 'credentials', label: 'Credentials', to: '/access/credentials', status: 'implemented' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices',
    primaryId: 'devices',
    icon: 'device',
    items: [
      { id: 'devices', label: 'Fleet', to: '/devices', status: 'implemented' },
      { id: 'enrolment', label: 'Enrolment', to: '/devices/enrolment', status: 'implemented' },
      { id: 'ownership', label: 'Ownership', to: '/devices/ownership', status: 'implemented' },
      { id: 'connections', label: 'Connections', to: '/devices/connections', status: 'implemented' },
      { id: 'device-diag', label: 'Diagnostics', to: '/devices/diagnostics', status: 'implemented' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    primaryId: 'health',
    icon: 'chart',
    items: [
      { id: 'health', label: 'Service health', to: '/monitoring/health', status: 'implemented' },
      { id: 'analytics', label: 'Analytics', to: '/analytics', status: 'implemented' },
      { id: 'metrics', label: 'Operator metrics', to: '/monitoring/metrics', status: 'implemented' },
      { id: 'storage', label: 'Storage', to: '/monitoring/storage', status: 'implemented' },
      { id: 'activity', label: 'Alerts', to: '/audit/events', status: 'implemented' },
      { id: 'diagnostics', label: 'Diagnostics', to: '/diagnostics', status: 'implemented' },
      { id: 'evaluation', label: 'Evaluation', to: '/evaluation', status: 'implemented' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    primaryId: 'audit-verify',
    icon: 'shield',
    items: [
      { id: 'audit-verify', label: 'Audit verify', to: '/audit/verify', status: 'implemented' },
      { id: 'security-events', label: 'Security events', to: '/audit/events', status: 'implemented' },
      { id: 'backup', label: 'Backups', to: '/backup', status: 'implemented' },
      { id: 'restore', label: 'Restore', to: '/restore', status: 'implemented' },
      { id: 'recovery', label: 'Recovery', to: '/recovery', status: 'implemented' },
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
      { id: 'apps', label: 'Apps', to: '/apps', status: 'implemented' },
      { id: 'releases', label: 'Releases', to: '/settings/releases', status: 'implemented' },
      { id: 'network', label: 'Network', to: '/settings/network', status: 'implemented' },
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
