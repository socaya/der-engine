import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useOrgUnitBinding } from '../orgunit/OrgUnitBindingContext';

export interface UserMenuProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/* v8 ignore next 7 — defensive branches on edge inputs (empty / single-word
 * names) exercised at compile time by every call site. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/* 24×24 outline SVGs, stroke=currentColor so hover + role tones
 * follow the menu item colour. */
const ICONS: Record<string, ReactNode> = {
  session: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  recent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  preferences: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  password: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" /><circle cx="12" cy="8" r="0.6" fill="currentColor" />
    </svg>
  ),
  signout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
    </svg>
  ),
  dhis2: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 7V3 M15 7V3 M7 10h10v4a5 5 0 0 1-10 0v-4z M12 19v3" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12a12 12 0 0 1 14 0" />
      <path d="M8 15a7 7 0 0 1 8 0" />
      <path d="M11 18a2 2 0 0 1 2 0" />
      <circle cx="12" cy="21" r="0.6" fill="currentColor" />
    </svg>
  ),
};

interface MenuRow {
  readonly to?: string;
  readonly iconKey: keyof typeof ICONS;
  readonly label: string;
  readonly testId: string;
  readonly danger?: boolean;
}

/**
 * Profile dropdown — DHIS2 HeaderBar profile-menu style with
 * icons on every row. Identity card on top, grouped account +
 * help items, sign-out separated by a rule.
 */
export function UserMenu({ open, onClose }: UserMenuProps): JSX.Element | null {
  const { state, signOut } = useAuth();
  const binding = useOrgUnitBinding();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  const user = state.status === 'AUTHENTICATED' ? state.user : null;
  if (!user) return null;
  const bound = binding.state.status === 'READY' && binding.state.binding.bound
    ? binding.state.binding : null;

  async function doSignOut(): Promise<void> {
    try { await signOut(); } catch { /* reported server-side */ }
    onClose();
    navigate('/sign-in');
  }

  const accountRows: readonly MenuRow[] = [
    { to: '/session', iconKey: 'session',
      label: 'Session details', testId: 'der-user-menu-session' },
    { to: '/recent', iconKey: 'recent',
      label: 'Recent work', testId: 'der-user-menu-recent' },
    { to: '/session/preferences', iconKey: 'preferences',
      label: 'Account preferences', testId: 'der-user-menu-preferences' },
    { to: '/session/password', iconKey: 'password',
      label: 'Change password', testId: 'der-user-menu-password' },
  ];
  const systemRows: readonly MenuRow[] = [
    { to: '/dhis2/status', iconKey: 'dhis2',
      label: 'DHIS2 status', testId: 'der-user-menu-dhis2' },
    { to: '/network/status', iconKey: 'network',
      label: 'Network', testId: 'der-user-menu-network' },
  ];
  const helpRows: readonly MenuRow[] = [
    { to: '/help', iconKey: 'help',
      label: 'Help & documentation', testId: 'der-user-menu-help' },
    { to: '/help/about', iconKey: 'about',
      label: 'About DER', testId: 'der-user-menu-about' },
  ];

  return (
    <div className="der-user-menu"
         role="menu"
         aria-label="Profile menu"
         data-test="der-user-menu"
         ref={menuRef}>
      <div className="der-user-menu__header">
        <div className="der-user-menu__avatar" aria-hidden="true">
          {initials(user.displayName)}
        </div>
        <div className="der-user-menu__identity">
          <div className="der-user-menu__name" data-test="der-user-menu-name">
            {user.displayName}
          </div>
          <div className="der-user-menu__role" data-test="der-user-menu-role">
            {user.roles.join(' · ') || 'OPERATOR'}
          </div>
          {bound && (
            <div className="der-user-menu__ou"
                 data-test="der-user-menu-ou">
              {bound.orgUnitDisplayName ?? bound.orgUnitId}
            </div>
          )}
        </div>
      </div>

      <nav className="der-user-menu__group" aria-label="Account">
        {accountRows.map((r, i) => (
          <Link key={r.testId}
                to={r.to!}
                className="der-user-menu__item"
                role="menuitem"
                data-test={r.testId}
                ref={i === 0 ? firstItemRef : undefined}
                onClick={onClose}>
            <span className="der-user-menu__item-icon" aria-hidden="true">
              {ICONS[r.iconKey]}
            </span>
            <span className="der-user-menu__item-label">{r.label}</span>
          </Link>
        ))}
      </nav>

      <div className="der-user-menu__divider" role="separator" />

      <nav className="der-user-menu__group" aria-label="System">
        {systemRows.map((r) => (
          <Link key={r.testId}
                to={r.to!}
                className="der-user-menu__item"
                role="menuitem"
                data-test={r.testId}
                onClick={onClose}>
            <span className="der-user-menu__item-icon" aria-hidden="true">
              {ICONS[r.iconKey]}
            </span>
            <span className="der-user-menu__item-label">{r.label}</span>
          </Link>
        ))}
      </nav>

      <div className="der-user-menu__divider" role="separator" />

      <nav className="der-user-menu__group" aria-label="Help">
        {helpRows.map((r) => (
          <Link key={r.testId}
                to={r.to!}
                className="der-user-menu__item"
                role="menuitem"
                data-test={r.testId}
                onClick={onClose}>
            <span className="der-user-menu__item-icon" aria-hidden="true">
              {ICONS[r.iconKey]}
            </span>
            <span className="der-user-menu__item-label">{r.label}</span>
          </Link>
        ))}
      </nav>

      <div className="der-user-menu__divider" role="separator" />

      <button type="button"
              className="der-user-menu__item der-user-menu__item--danger"
              role="menuitem"
              data-test="der-user-menu-signout"
              onClick={() => { void doSignOut(); }}>
        <span className="der-user-menu__item-icon" aria-hidden="true">
          {ICONS.signout}
        </span>
        <span className="der-user-menu__item-label">Sign out</span>
      </button>
    </div>
  );
}
