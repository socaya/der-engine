import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';

/**
 * M0 shell — logo-aligned redesign.
 *
 * Layout:
 *   ┌──────────┬────────────────────────────────────┐
 *   │ sidebar  │ topbar  (search · bell · user)     │
 *   │ (navy)   ├────────────────────────────────────┤
 *   │          │ main (breadcrumbs + screen)        │
 *   └──────────┴────────────────────────────────────┘
 *
 * Responsive:
 *   ≥1025 px — sidebar 230 px, labels visible
 *   768–1024 — sidebar collapses to 68 px icons-only
 *   <768 px  — sidebar hidden off-canvas; hamburger opens it
 *              with backdrop
 */

export interface AdminShellProps {
  readonly children: ReactNode;
}

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly testId: string;
  readonly icon: (p: { className?: string }) => JSX.Element;
}

/* --------------- icon set (inline SVG, no deps) --------------- */
function IconOverview(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/></svg>
  );
}
function IconSync(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 019-9 9 9 0 017 3M21 5v4h-4M21 12a9 9 0 01-9 9 9 9 0 01-7-3M3 19v-4h4"/></svg>
  );
}
function IconJournal(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h14a2 2 0 012 2v14M4 4v16h14M8 8h8M8 12h8M8 16h6"/></svg>
  );
}
function IconApprovals(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12l2 2 4-4M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3z"/></svg>
  );
}
function IconWorkflows(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3a2 2 0 100 4 2 2 0 000-4zm10 14a2 2 0 100 4 2 2 0 000-4zm0-14a2 2 0 100 4 2 2 0 000-4zM7 17a2 2 0 100 4 2 2 0 000-4zM7 7v10M17 7v10M9 5h6M9 19h6"/></svg>
  );
}
function IconMetadata(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>
  );
}
function IconCompat(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>
  );
}
function IconDevices(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2"/><path d="M3 20h14M15 10h4a2 2 0 012 2v6a2 2 0 01-2 2h-4"/></svg>
  );
}
function IconAnalytics(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
  );
}
function IconApps(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>
  );
}
function IconUsers(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M3 20v-2a4 4 0 014-4h4a4 4 0 014 4v2M17 11a3 3 0 100-6M20 20v-2a4 4 0 00-3-3.9"/></svg>
  );
}
function IconAudit(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 4v5c0 5-3.6 8.5-9 10-5.4-1.5-9-5-9-10V7l9-4z"/><path d="M9 12l2 2 4-4"/></svg>
  );
}
function IconReferral(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H5l-1 2V6zM8 10h8M8 13h5"/></svg>
  );
}
function IconSettings(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.3l2.1-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2.1 1.6a7 7 0 000 2.6l-2.1 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 21h4l.4-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2.1-1.6c.1-.4.1-.9.1-1.3z"/></svg>
  );
}
function IconDiagnostics(p: { className?: string }): JSX.Element {
  return (
    <svg className={p.className} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2 7 4-14 2 7h6"/></svg>
  );
}

const PRIMARY: readonly { group: string; items: readonly NavItem[] }[] = [
  {
    group: 'Monitor',
    items: [
      { to: '/', label: 'Overview', testId: 'nav-home', icon: IconOverview },
      { to: '/analytics', label: 'Analytics', testId: 'nav-analytics', icon: IconAnalytics },
      { to: '/diagnostics', label: 'Diagnostics', testId: 'nav-diagnostics', icon: IconDiagnostics },
    ],
  },
  {
    group: 'Operate',
    items: [
      { to: '/sync/jobs', label: 'Sync', testId: 'nav-jobs', icon: IconSync },
      { to: '/journal/conflicts', label: 'Journal', testId: 'nav-conflicts', icon: IconJournal },
      { to: '/approvals', label: 'Approvals', testId: 'nav-approvals', icon: IconApprovals },
      { to: '/workflows', label: 'Workflows', testId: 'nav-workflows', icon: IconWorkflows },
      { to: '/referral/inbox', label: 'Referral', testId: 'nav-referral', icon: IconReferral },
    ],
  },
  {
    group: 'Configure',
    items: [
      { to: '/metadata', label: 'Metadata', testId: 'nav-metadata', icon: IconMetadata },
      { to: '/compat', label: 'Compatibility', testId: 'nav-compat', icon: IconCompat },
      { to: '/devices', label: 'Devices', testId: 'nav-devices', icon: IconDevices },
      { to: '/apps', label: 'Apps', testId: 'nav-apps', icon: IconApps },
      { to: '/provisioning/users', label: 'Users', testId: 'nav-provisioning', icon: IconUsers },
      { to: '/audit/verify', label: 'Audit', testId: 'nav-audit', icon: IconAudit },
      { to: '/settings', label: 'Settings', testId: 'nav-settings', icon: IconSettings },
    ],
  },
];

function initials(nameOrUsername: string): string {
  const parts = nameOrUsername.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function AdminShell({ children }: AdminShellProps): JSX.Element {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const onSignIn = location.pathname === '/sign-in';
  const authed = state.status === 'AUTHENTICATED';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function handleSignOut(): Promise<void> {
    await signOut();
    navigate('/sign-in', { replace: true });
  }

  const shellCls =
    'ea-shell' +
    (onSignIn ? ' ea-shell--signin' : '') +
    (mobileOpen ? ' ea-shell--mobile-open' : '');

  return (
    <div className={shellCls}>
      {!onSignIn && (
        <aside className="ea-sidebar" data-test="sidebar">
          <div className="ea-sidebar-brand">
            <div className="ea-sidebar-logo" aria-hidden="true" />
            <div>
              <div className="ea-sidebar-title">DER</div>
              <div className="ea-sidebar-sub">Edge Runtime</div>
            </div>
          </div>
          <nav className="ea-sidebar-nav" aria-label="Primary">
            {PRIMARY.map((grp) => (
              <div key={grp.group}>
                <div className="ea-sidebar-section-title">{grp.group}</div>
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      data-test={item.testId}
                      className={({ isActive }) =>
                        'ea-sidebar-item' + (isActive ? ' ea-sidebar-item-active' : '')
                      }
                    >
                      <Icon className="ea-sidebar-icon" />
                      <span className="ea-sidebar-label">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="ea-sidebar-footer">
            <span className="ea-sidebar-footer-dot" aria-hidden="true" />
            <span className="ea-sidebar-footer-text">DER server · online</span>
          </div>
        </aside>
      )}
      {!onSignIn && (
        <div
          className="ea-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="ea-topbar" data-test="headerbar">
        {!onSignIn && (
          <button
            type="button"
            className="ea-topbar-toggle"
            aria-label="Toggle navigation"
            data-test="topbar-toggle"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        )}
        {onSignIn && (
          <Link to="/" className="ea-brand" data-test="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div className="ea-sidebar-logo" style={{ width: 36, height: 36 }} aria-hidden="true" />
            <span style={{ fontWeight: 700, color: 'var(--der-ink-900)', fontSize: 15 }}>
              DHIS2 Edge Runtime · Administration
            </span>
          </Link>
        )}
        {!onSignIn && (
          <>
            <div className="ea-topbar-search" role="search">
              <svg className="ea-topbar-search-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search routes, jobs, users…"
                aria-label="Search"
                data-test="topbar-search"
              />
            </div>
            <div data-test="brand" style={{ display: 'none' }}>DER</div>
          </>
        )}
        <div className="ea-topbar-right">
          {authed && !onSignIn && (
            <>
              <button
                type="button"
                className="ea-topbar-icon-btn"
                aria-label="Notifications"
                data-test="topbar-bell"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5" />
                  <path d="M10 21a2 2 0 004 0" />
                </svg>
              </button>
              <div className="ea-user-chip" data-test="headerbar-user">
                <span className="ea-user-avatar" aria-hidden="true">
                  {initials(state.user.displayName ?? state.user.username)}
                </span>
                <div className="ea-user-chip-info">
                  <span className="ea-user-chip-name">
                    {state.user.displayName ?? state.user.username}
                  </span>
                  <span className="ea-user-chip-role">
                    {state.user.roles.join(' · ')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="ea-headerbar-signout"
                data-test="headerbar-signout"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <main className="ea-main" data-der-app="admin-ui">
        <div className="ea-main-inner">
          {!onSignIn && <Breadcrumbs />}
          {children}
        </div>
      </main>
    </div>
  );
}
