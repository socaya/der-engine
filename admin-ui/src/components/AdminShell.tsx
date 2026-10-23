import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';

/**
 * DHIS2-style administration shell: fixed header bar with brand +
 * user chip, horizontal primary navigation underneath, main area
 * for the current route. Visually mirrors DHIS2 2.44 Core apps so
 * operators moving between DHIS2 and DER feel at home.
 */
export interface AdminShellProps {
  readonly children: ReactNode;
}

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly testId: string;
}

const PRIMARY: readonly NavItem[] = [
  { to: '/', label: 'Overview', testId: 'nav-home' },
  { to: '/sync/jobs', label: 'Sync', testId: 'nav-jobs' },
  { to: '/journal/conflicts', label: 'Journal', testId: 'nav-conflicts' },
  { to: '/approvals', label: 'Approvals', testId: 'nav-approvals' },
  { to: '/workflows', label: 'Workflows', testId: 'nav-workflows' },
  { to: '/metadata', label: 'Metadata', testId: 'nav-metadata' },
  { to: '/compat', label: 'Compatibility', testId: 'nav-compat' },
  { to: '/devices', label: 'Devices', testId: 'nav-devices' },
  { to: '/analytics', label: 'Analytics', testId: 'nav-analytics' },
  { to: '/apps', label: 'Apps', testId: 'nav-apps' },
  { to: '/provisioning/users', label: 'Users', testId: 'nav-provisioning' },
  { to: '/audit/verify', label: 'Audit', testId: 'nav-audit' },
  { to: '/referral/inbox', label: 'Referral', testId: 'nav-referral' },
];

export function AdminShell({ children }: AdminShellProps): JSX.Element {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const onSignIn = location.pathname === '/sign-in';
  const authed = state.status === 'AUTHENTICATED';

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate('/sign-in', { replace: true });
  }

  return (
    <div className="ea-shell">
      <header className="ea-headerbar" data-test="headerbar">
        <div className="ea-headerbar-inner">
          <div className="ea-brand" data-test="brand">
            <span className="ea-brand-logo" aria-hidden="true">
              DER
            </span>
            <span className="ea-brand-text">
              DHIS2 Edge Runtime&nbsp;·&nbsp;Administration
            </span>
          </div>
          <div className="ea-headerbar-right">
            {authed && (
              <>
                <span
                  className="ea-headerbar-user"
                  data-test="headerbar-user"
                >
                  {state.user.displayName ?? state.user.username}
                </span>
                <button
                  type="button"
                  className="ea-headerbar-signout"
                  data-test="headerbar-signout"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {!onSignIn && (
        <nav className="ea-nav" aria-label="Primary">
          <div className="ea-nav-inner">
            {PRIMARY.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-test={item.testId}
                end={item.to === '/'}
                className={({ isActive }) =>
                  'ea-nav-item' + (isActive ? ' ea-nav-item-active' : '')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <main className="ea-main" data-der-app="admin-ui">
        <div className="ea-main-inner">
          {!onSignIn && <Breadcrumbs />}
          {children}
        </div>
      </main>
    </div>
  );
}
