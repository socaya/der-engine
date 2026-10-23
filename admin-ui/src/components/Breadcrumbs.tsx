import { Link, useLocation } from 'react-router-dom';

/**
 * B4: breadcrumbs for sub-screens. The horizontal nav only carries the
 * 13 primary routes; deep links like /sync/jobs/trigger or
 * /provisioning/users/new need an in-page breadcrumb trail so operators
 * know where they are.
 */

interface Crumb {
  readonly to: string;
  readonly label: string;
}

const MAP: Record<string, Crumb[]> = {
  '/': [{ to: '/', label: 'Overview' }],
  '/sync/jobs': [{ to: '/sync/jobs', label: 'Sync — jobs' }],
  '/sync/jobs/trigger': [
    { to: '/sync/jobs', label: 'Sync — jobs' },
    { to: '/sync/jobs/trigger', label: 'Trigger' },
  ],
  '/sync/drift': [
    { to: '/sync/jobs', label: 'Sync' },
    { to: '/sync/drift', label: 'Drift' },
  ],
  '/journal/conflicts': [{ to: '/journal/conflicts', label: 'Journal — conflicts' }],
  '/journal/worker': [
    { to: '/journal/conflicts', label: 'Journal' },
    { to: '/journal/worker', label: 'Worker' },
  ],
  '/approvals': [{ to: '/approvals', label: 'Approvals' }],
  '/workflows': [{ to: '/workflows', label: 'Workflows' }],
  '/metadata': [{ to: '/metadata', label: 'Metadata' }],
  '/compat': [{ to: '/compat', label: 'Compatibility' }],
  '/compat/history': [
    { to: '/compat', label: 'Compatibility' },
    { to: '/compat/history', label: 'History' },
  ],
  '/devices': [{ to: '/devices', label: 'Devices' }],
  '/analytics': [{ to: '/analytics', label: 'Analytics' }],
  '/apps': [{ to: '/apps', label: 'Apps' }],
  '/provisioning/users': [{ to: '/provisioning/users', label: 'Users' }],
  '/provisioning/users/new': [
    { to: '/provisioning/users', label: 'Users' },
    { to: '/provisioning/users/new', label: 'Create' },
  ],
  '/audit/verify': [{ to: '/audit/verify', label: 'Audit — verify' }],
  '/audit/events': [
    { to: '/audit/verify', label: 'Audit' },
    { to: '/audit/events', label: 'Events' },
  ],
  '/referral/inbox': [{ to: '/referral/inbox', label: 'Referral inbox' }],
  '/recovery': [{ to: '/recovery', label: 'Recovery tools' }],
  '/backup': [{ to: '/backup', label: 'Backup' }],
  '/restore': [{ to: '/restore', label: 'Restore' }],
  '/evaluation': [{ to: '/evaluation', label: 'Evaluation reports' }],
  '/diagnostics': [{ to: '/diagnostics', label: 'Diagnostics' }],
  '/settings': [{ to: '/settings', label: 'Settings' }],
};

export function Breadcrumbs(): JSX.Element | null {
  const location = useLocation();
  const crumbs = MAP[location.pathname];
  if (!crumbs || location.pathname === '/sign-in') return null;
  return (
    <nav className="ea-breadcrumbs" aria-label="Breadcrumbs" data-test="breadcrumbs">
      {crumbs.map((c, i) => (
        <span key={c.to}>
          {i > 0 && <span className="ea-breadcrumbs-sep" aria-hidden="true">/</span>}
          {i < crumbs.length - 1 ? (
            <Link to={c.to}>{c.label}</Link>
          ) : (
            <span className="ea-breadcrumbs-current" aria-current="page">
              {c.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
