/**
 * Single-source navigation registry per
 * docs/media/ui/DER_ADMIN_UI_NAVIGATION_IMPLEMENTATION.md §2.
 *
 * `status`:
 *   - 'implemented' — route serves a real screen backed by a verified
 *     server endpoint and is navigable from the sidebar.
 *   - 'capability-gap' — route exists in the spec but is not yet wired
 *     to a verified server endpoint; shown in the sidebar greyed with
 *     a "not available" badge, never silently clickable.
 *   - 'contextual' — not shown in the sidebar; reachable via contextual
 *     actions on another screen (e.g. "Add user").
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

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', to: '/dashboard', status: 'capability-gap' },
      { id: 'system-overview', label: 'System overview', to: '/', status: 'implemented' },
      { id: 'system-info', label: 'System information', to: '/system/information', status: 'capability-gap' },
    ],
  },
  {
    id: 'integration',
    label: 'DHIS2 Integration',
    items: [
      { id: 'central-conn', label: 'Central connection', to: '/integration/connection', status: 'capability-gap' },
      { id: 'ou-binding', label: 'Organisation unit', to: '/integration/organisation-unit', status: 'capability-gap' },
      { id: 'compat', label: 'Compatibility', to: '/compat', status: 'implemented' },
      { id: 'compat-history', label: 'Compat history', to: '/compat/history', status: 'implemented' },
      { id: 'metadata-mirror', label: 'Metadata mirror', to: '/metadata', status: 'implemented' },
      { id: 'drift', label: 'Metadata drift', to: '/sync/drift', status: 'implemented' },
      { id: 'program-rules', label: 'Program rules', to: '/integration/program-rules', status: 'capability-gap' },
    ],
  },
  {
    id: 'sync',
    label: 'Synchronisation',
    items: [
      { id: 'sync-overview', label: 'Sync overview', to: '/sync', status: 'capability-gap' },
      { id: 'sync-jobs', label: 'Sync jobs', to: '/sync/jobs', status: 'implemented' },
      { id: 'sync-history', label: 'Sync history', to: '/sync/history', status: 'capability-gap' },
      { id: 'queues', label: 'Data queues', to: '/sync/queues', status: 'capability-gap' },
      { id: 'conflicts', label: 'Conflicts', to: '/journal/conflicts', status: 'implemented' },
      { id: 'worker', label: 'Worker health', to: '/journal/worker', status: 'implemented' },
      { id: 'sync-metadata', label: 'Metadata sync', to: '/sync/metadata', status: 'capability-gap' },
      { id: 'data-exchange', label: 'Data exchange', to: '/sync/data', status: 'capability-gap' },
      { id: 'sync-schedule', label: 'Sync schedule', to: '/sync/schedule', status: 'capability-gap' },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows & Approvals',
    items: [
      { id: 'workflows', label: 'Workflows', to: '/workflows', status: 'implemented' },
      { id: 'runs', label: 'Runs & execution', to: '/workflows/runs', status: 'capability-gap' },
      { id: 'assignments', label: 'Step assignments', to: '/workflows/assignments', status: 'capability-gap' },
      { id: 'approvals', label: 'Approval queue', to: '/approvals', status: 'implemented' },
      { id: 'referral-inbox', label: 'Referral inbox', to: '/referral/inbox', status: 'implemented' },
      { id: 'referral-history', label: 'Referral history', to: '/referral/history', status: 'capability-gap' },
    ],
  },
  {
    id: 'data',
    label: 'Local Data',
    items: [
      { id: 'data-overview', label: 'Data overview', to: '/data', status: 'capability-gap' },
      { id: 'aggregate', label: 'Aggregate', to: '/data/aggregate', status: 'capability-gap' },
      { id: 'events', label: 'Events', to: '/data/events', status: 'capability-gap' },
      { id: 'tracker', label: 'Tracker', to: '/data/tracker', status: 'capability-gap' },
      { id: 'drafts', label: 'Drafts & pending', to: '/data/drafts', status: 'capability-gap' },
      { id: 'maintenance', label: 'Maintenance', to: '/data/maintenance', status: 'capability-gap' },
    ],
  },
  {
    id: 'access',
    label: 'Users & Access',
    items: [
      { id: 'users', label: 'Users', to: '/provisioning/users', status: 'implemented' },
      { id: 'users-new', label: 'Add user', to: '/provisioning/users/new', status: 'contextual' },
      { id: 'mappings', label: 'DHIS2 user mapping', to: '/access/mappings', status: 'capability-gap' },
      { id: 'roles', label: 'Roles & permissions', to: '/access/roles', status: 'capability-gap' },
      { id: 'sessions', label: 'User sessions', to: '/access/sessions', status: 'capability-gap' },
      { id: 'credentials', label: 'MFA & credentials', to: '/access/credentials', status: 'capability-gap' },
    ],
  },
  {
    id: 'devices',
    label: 'Devices & Clients',
    items: [
      { id: 'devices', label: 'Device fleet', to: '/devices', status: 'implemented' },
      { id: 'enrolment', label: 'Device enrolment', to: '/devices/enrolment', status: 'capability-gap' },
      { id: 'ownership', label: 'Ownership', to: '/devices/ownership', status: 'capability-gap' },
      { id: 'connections', label: 'Active connections', to: '/devices/connections', status: 'capability-gap' },
      { id: 'device-diag', label: 'Device diagnostics', to: '/devices/diagnostics', status: 'capability-gap' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring & Analytics',
    items: [
      { id: 'analytics', label: 'Facility analytics', to: '/analytics', status: 'implemented' },
      { id: 'metrics', label: 'Operator metrics', to: '/monitoring/metrics', status: 'capability-gap' },
      { id: 'health', label: 'Service health', to: '/monitoring/health', status: 'capability-gap' },
      { id: 'storage', label: 'Storage', to: '/monitoring/storage', status: 'capability-gap' },
      { id: 'activity', label: 'Alerts & activity', to: '/audit/events', status: 'implemented' },
      { id: 'diagnostics', label: 'Diagnostics', to: '/diagnostics', status: 'implemented' },
      { id: 'evaluation', label: 'Evaluation', to: '/evaluation', status: 'implemented' },
    ],
  },
  {
    id: 'security',
    label: 'Security & Recovery',
    items: [
      { id: 'audit-verify', label: 'Audit verification', to: '/audit/verify', status: 'implemented' },
      { id: 'security-events', label: 'Security events', to: '/audit/events', status: 'implemented' },
      { id: 'backup', label: 'Backups', to: '/backup', status: 'implemented' },
      { id: 'restore', label: 'Restore', to: '/restore', status: 'implemented' },
      { id: 'recovery', label: 'Recovery tools', to: '/recovery', status: 'implemented' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'settings', label: 'General', to: '/settings', status: 'implemented' },
      { id: 'provisioning', label: 'Provisioning setup', to: '/setup', status: 'capability-gap' },
      { id: 'apps', label: 'Installed apps', to: '/apps', status: 'implemented' },
      { id: 'releases', label: 'Software & releases', to: '/settings/releases', status: 'capability-gap' },
      { id: 'network', label: 'Network / TLS', to: '/settings/network', status: 'capability-gap' },
    ],
  },
];
